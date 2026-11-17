"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { account, session, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertAdmin } from "@/lib/session";
import { createCredentialUser } from "@/lib/user-service";
import {
  adminCreateUserSchema,
  adminUserSchema,
  signUpSchema,
  type AdminCreateUserInput,
  type AdminUserInput,
} from "@/lib/validators";
import { z } from "zod";

type Result = { ok: true } | { ok: false; error: string };

// Every action re-checks the role: Server Actions can be called directly with a POST request.

function isUniqueViolation(e: unknown) {
  const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

const DUPLICATE = "That username or email is already in use";

export async function createUserAction(input: AdminCreateUserInput): Promise<Result> {
  await assertAdmin();
  const parsed = adminCreateUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  try {
    await createCredentialUser(parsed.data);
  } catch (e) {
    return { ok: false, error: isUniqueViolation(e) ? DUPLICATE : "Could not create the user" };
  }
  revalidatePath("/admin");
  return { ok: true };
}

const updateSchema = adminUserSchema.extend({
  // Optional: leave empty to keep the current password.
  password: z.union([z.literal(""), signUpSchema.shape.password]).optional(),
});

export async function updateUserAction(id: string, input: AdminUserInput & { password?: string }): Promise<Result> {
  const admin = await assertAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const { password, ...d } = parsed.data;
  if (id === admin.id && d.role !== "admin") return { ok: false, error: "You cannot remove your own admin role" };

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({
          name: `${d.firstName} ${d.lastName}`,
          email: d.email.toLowerCase(),
          username: d.username.toLowerCase(),
          displayUsername: d.username,
          firstName: d.firstName,
          lastName: d.lastName,
          phone: d.phone,
          address: d.address,
          birthDate: d.birthDate,
          role: d.role,
        })
        .where(eq(user.id, id));
      if (password) {
        const hash = await (await auth.$context).password.hash(password);
        await tx.update(account).set({ password: hash }).where(eq(account.userId, id));
      }
    });
  } catch (e) {
    return { ok: false, error: isUniqueViolation(e) ? DUPLICATE : "Could not update the user" };
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function setBanAction(id: string, banned: boolean, reason?: string): Promise<Result> {
  const admin = await assertAdmin();
  if (id === admin.id) return { ok: false, error: "You cannot ban yourself" };
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ banned, banReason: banned ? reason?.slice(0, 200) || "Banned by an administrator" : null, banExpires: null })
      .where(eq(user.id, id));
    if (banned) await tx.delete(session).where(eq(session.userId, id)); // log them out everywhere
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteUserAction(id: string): Promise<Result> {
  const admin = await assertAdmin();
  if (id === admin.id) return { ok: false, error: "You cannot delete your own account" };
  // Sessions, accounts, trips and memberships are removed by ON DELETE CASCADE.
  await db.delete(user).where(eq(user.id, id));
  revalidatePath("/admin");
  return { ok: true };
}

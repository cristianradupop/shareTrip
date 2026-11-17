import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { account, session, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { checkSameOrigin, isUniqueViolation, jsonError, readJson, requireApiAdmin, requireJson } from "@/lib/api-auth";
import { adminUserSchema, signUpSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = adminUserSchema.extend({
  // Optional: leave empty to keep the current password.
  password: z.union([z.literal(""), signUpSchema.shape.password]).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiAdmin(req);
  if (!guard.ok) return guard.response;
  const notJson = requireJson(req);
  if (notJson) return notJson;
  const { id } = await ctx.params;

  const parsed = updateSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);
  const { password, ...d } = parsed.data;
  if (id === guard.user.id && d.role !== "admin") return jsonError("You cannot remove your own admin role", 400);

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
        await tx.delete(session).where(eq(session.userId, id)); // a new password logs the user out everywhere
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) return jsonError("That username or email is already in use", 409);
    return jsonError("Could not update the user", 400);
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiAdmin(req);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;

  if (id === guard.user.id) return jsonError("You cannot delete your own account", 400);
  // Sessions, accounts, trips and memberships are removed by ON DELETE CASCADE.
  await db.delete(user).where(eq(user.id, id));
  return Response.json({ ok: true });
}

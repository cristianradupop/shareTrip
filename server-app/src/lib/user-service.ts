// Creates a user + credential account directly in the DB, hashing the password the same way
// Better Auth does. Used by the admin "create user" action and by the seed scripts.
// (No "server-only" import on purpose: seed scripts run outside Next.js.)
import { db } from "@/db/client";
import { account, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { accountSubject, buildEvent, recordEvent } from "@/lib/audit";

export type NewUserData = {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  birthDate: string;
  gender: "male" | "female";
  role: "admin" | "user";
  image?: string | null;
};

/** Pass `actor` (the admin creating the account) to log an account.created event; seed scripts don't. */
export async function createCredentialUser(
  u: NewUserData,
  opts?: { actor?: { id: string; name: string } },
): Promise<string> {
  const ctx = await auth.$context;
  const id = crypto.randomUUID();
  const passwordHash = await ctx.password.hash(u.password);

  await db.transaction(async (tx) => {
    await tx.insert(user).values({
      id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email.toLowerCase(),
      emailVerified: true,
      image: u.image ?? null,
      username: u.username.toLowerCase(),
      displayUsername: u.username,
      role: u.role,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      address: u.address,
      birthDate: u.birthDate,
      gender: u.gender,
    });
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: passwordHash,
    });
    if (opts?.actor) {
      const subject = accountSubject({ id, name: `${u.firstName} ${u.lastName}`, email: u.email.toLowerCase() });
      await recordEvent(tx, buildEvent("account.created", { ...opts.actor, role: "admin" }, subject));
    }
  });
  return id;
}

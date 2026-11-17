// Creates a user + credential account directly in the DB, hashing the password the same way
// Better Auth does. Used by the admin "create user" action and by the seed scripts.
// (No "server-only" import on purpose: seed scripts run outside Next.js.)
import { db } from "@/db/client";
import { account, user } from "@/db/schema";
import { auth } from "@/lib/auth";

export type NewUserData = {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  birthDate: string;
  role: "admin" | "user";
  image?: string | null;
};

export async function createCredentialUser(u: NewUserData): Promise<string> {
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
    });
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: passwordHash,
    });
  });
  return id;
}

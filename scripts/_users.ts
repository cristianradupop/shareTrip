// Shared helper for seed scripts. Idempotent by email.
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { createCredentialUser, type NewUserData } from "@/lib/user-service";

export type SeedUser = NewUserData;

export async function ensureUser(u: SeedUser): Promise<string> {
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, u.email.toLowerCase()));
  if (existing[0]) return existing[0].id;
  return createCredentialUser(u);
}

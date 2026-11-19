import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { accountSubject, buildEvent, recordEvent } from "@/lib/audit";
import { ACCOUNT_GENDERS } from "@/lib/validators";

const isAccountGender = (g: unknown) => (ACCOUNT_GENDERS as readonly unknown[]).includes(g);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: true },
      lastName: { type: "string", required: true },
      phone: { type: "string", required: true },
      address: { type: "string", required: true },
      // ISO date string (YYYY-MM-DD)
      birthDate: { type: "string", required: true },
      // "male" | "female". Not `required` here so a CLI regeneration keeps the column nullable (ADR 0003);
      // the create hook below enforces it.
      gender: { type: "string", required: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // The public sign-up endpoint can be called directly, so enforce the "photo required" rule here too.
        before: async (newUser) => {
          const prefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_PHOTOS_BUCKET || "profile-photos"}/`;
          if (!newUser.image || !newUser.image.startsWith(prefix)) {
            throw new APIError("BAD_REQUEST", { message: "A profile photo is required" });
          }
          if (!isAccountGender(newUser.gender)) {
            throw new APIError("BAD_REQUEST", { message: "Choose your gender" });
          }
          return { data: newUser };
        },
        // Better Auth creates the user, so the sign-up event is written here (after its own transaction).
        // A logging failure must never fail the sign-up, and the log line carries no personal data.
        after: async (created) => {
          try {
            const actor = { id: created.id, name: created.name, role: "holder" as const };
            await recordEvent(db, buildEvent("account.created", actor, accountSubject(created)));
          } catch {
            console.error("audit: could not record the sign-up event");
          }
        },
      },
      update: {
        before: async (changes) => {
          if ("gender" in changes && !isAccountGender(changes.gender)) {
            throw new APIError("BAD_REQUEST", { message: "Choose your gender" });
          }
          return { data: changes };
        },
      },
    },
  },
  // In-memory rate limiting does not work on serverless, so store it in the DB.
  rateLimit: { storage: "database" },
  // nextCookies() must stay last so Server Actions can set cookies.
  plugins: [username(), admin(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

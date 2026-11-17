import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

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
    },
  },
  databaseHooks: {
    user: {
      create: {
        // The public sign-up endpoint can be called directly, so enforce the "photo required" rule here too.
        before: async (newUser) => {
          const prefix = `${process.env.SUPABASE_URL}/storage/`;
          if (!newUser.image || !newUser.image.startsWith(prefix)) {
            throw new APIError("BAD_REQUEST", { message: "A profile photo is required" });
          }
          return { data: newUser };
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

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimit } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";

export const SIGNUP_LIMIT_MAX = 10;
export const SIGNUP_LIMIT_WINDOW_SECONDS = 3600;
export const SIGNUP_LIMIT_PATH = "/signup";
export const SIGNUP_LIMIT_MESSAGE = "Too many sign-up attempts. Try again later.";

const WINDOW_MS = SIGNUP_LIMIT_WINDOW_SECONDS * 1000;

export type SignupWindow = { count: number; windowStart: number };
export type SignupVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function signupLimitKey(ip: string | null): string {
  return `${ip ?? "unknown"}|${SIGNUP_LIMIT_PATH}`;
}

/** Fixed window: the count resets once the window is `SIGNUP_LIMIT_WINDOW_SECONDS` old. The SQL below mirrors this. */
export function nextSignupWindow(previous: SignupWindow | null, now: number): SignupWindow {
  if (!previous || now - previous.windowStart >= WINDOW_MS) return { count: 1, windowStart: now };
  return { count: previous.count + 1, windowStart: previous.windowStart };
}

export function signupVerdict(w: SignupWindow, now: number): SignupVerdict {
  if (w.count <= SIGNUP_LIMIT_MAX) return { allowed: true };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((w.windowStart + WINDOW_MS - now) / 1000)) };
}

/**
 * Counts one sign-up attempt for the caller's IP in a single atomic upsert on the `rate_limit` table.
 * Better Auth only reads keys of its own paths, so for `|/signup` keys `last_request` is the window start.
 */
export async function consumeSignupAttempt(req: Request, now = Date.now()): Promise<SignupVerdict> {
  const first = nextSignupWindow(null, now);
  const [row] = await db
    .insert(rateLimit)
    .values({ id: crypto.randomUUID(), key: signupLimitKey(clientIp(req)), count: first.count, lastRequest: first.windowStart })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`CASE WHEN ${rateLimit.lastRequest} <= ${now}::bigint - ${WINDOW_MS}::bigint THEN 1 ELSE ${rateLimit.count} + 1 END`,
        lastRequest: sql`CASE WHEN ${rateLimit.lastRequest} <= ${now}::bigint - ${WINDOW_MS}::bigint THEN ${now}::bigint ELSE ${rateLimit.lastRequest} END`,
      },
    })
    .returning({ count: rateLimit.count, lastRequest: rateLimit.lastRequest });
  return signupVerdict({ count: row.count, windowStart: row.lastRequest }, now);
}

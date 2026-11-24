import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimit } from "@/db/schema";
import { hashIp } from "@/lib/analytics";
import { clientIp } from "@/lib/client-ip";

export const ANALYTICS_LIMIT_MAX = 300;
export const ANALYTICS_LIMIT_WINDOW_SECONDS = 60;
export const ANALYTICS_GLOBAL_DAILY_MAX = 10000;
export const ANALYTICS_LIMIT_PATH = "/analytics";

const WINDOW_MS = ANALYTICS_LIMIT_WINDOW_SECONDS * 1000;

export type AnalyticsVerdict =
  | { allowed: true }
  | { allowed: false; scope: "ip"; retryAfterSeconds: number }
  | { allowed: false; scope: "global" };

/** IPv6 clients rotate freely inside their /64, so that prefix is the key; IPv4 keeps the full address. */
function limitKey(ip: string | null): string {
  if (!ip) return "unknown";
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = ip.includes("::") && tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...headGroups, ...Array<string>(Math.max(0, 8 - headGroups.length - tailGroups.length)).fill("0"), ...tailGroups] : headGroups;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/**
 * Counts `eventCount` events for the caller's IP (per-minute window) and for the UTC day (global budget), each in one
 * atomic upsert on `rate_limit`. The IP key is a hash salted per UTC day, so no raw IP is stored. The IP budget is checked first, so a throttled client does not burn the global one.
 */
export async function consumeAnalyticsAttempt(req: Request, eventCount: number, { salt, now = Date.now() }: { salt: string; now?: number }): Promise<AnalyticsVerdict> {
  const [row] = await db
    .insert(rateLimit)
    .values({ id: crypto.randomUUID(), key: `${hashIp(limitKey(clientIp(req)), salt)}|${ANALYTICS_LIMIT_PATH}`, count: eventCount, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`CASE WHEN ${rateLimit.lastRequest} <= ${now}::bigint - ${WINDOW_MS}::bigint THEN ${eventCount}::integer ELSE ${rateLimit.count} + ${eventCount}::integer END`,
        lastRequest: sql`CASE WHEN ${rateLimit.lastRequest} <= ${now}::bigint - ${WINDOW_MS}::bigint THEN ${now}::bigint ELSE ${rateLimit.lastRequest} END`,
      },
    })
    .returning({ count: rateLimit.count, lastRequest: rateLimit.lastRequest });
  if (row.count > ANALYTICS_LIMIT_MAX) {
    return { allowed: false, scope: "ip", retryAfterSeconds: Math.max(1, Math.ceil((row.lastRequest + WINDOW_MS - now) / 1000)) };
  }

  const day = new Date(now).toISOString().slice(0, 10);
  const [global] = await db
    .insert(rateLimit)
    .values({ id: crypto.randomUUID(), key: `global|${ANALYTICS_LIMIT_PATH}|${day}`, count: eventCount, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { count: sql`${rateLimit.count} + ${eventCount}::integer`, lastRequest: sql`${now}::bigint` },
    })
    .returning({ count: rateLimit.count });
  if (global.count > ANALYTICS_GLOBAL_DAILY_MAX) return { allowed: false, scope: "global" };
  return { allowed: true };
}

import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { analyticsEvents, analyticsSalts, rateLimit, type AnalyticsEventInsert } from "@/db/schema";
import { WEB_VITALS, vitalRating, type AnalyticsRange, type AnalyticsReport, type WebVital } from "@/shared/analytics";

export const ANALYTICS_RETENTION_DAYS = 30;
const PRUNE_BATCH = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/** The salt of the UTC day of `now`; created by the first call of the day, so concurrent calls agree on one row. */
export async function getDailySalt(now: Date): Promise<string> {
  const day = utcDay(now);
  await db.insert(analyticsSalts).values({ day, salt: randomBytes(32).toString("hex") }).onConflictDoNothing();
  const [row] = await db.select({ salt: analyticsSalts.salt }).from(analyticsSalts).where(eq(analyticsSalts.day, day)).limit(1);
  return row.salt;
}

export async function insertAnalyticsEvents(rows: AnalyticsEventInsert[]) {
  if (rows.length === 0) return;
  await db.insert(analyticsEvents).values(rows);
}

/** Deletes salts of earlier days, events past the retention and rate-limit rows idle for 24 hours, at most 500 of each per call. */
export async function pruneAnalytics(now: Date) {
  await db.delete(analyticsSalts).where(lt(analyticsSalts.day, utcDay(now)));
  const cutoff = new Date(now.getTime() - ANALYTICS_RETENTION_DAYS * DAY_MS);
  await db
    .delete(analyticsEvents)
    .where(
      sql`${analyticsEvents.id} in (select ${analyticsEvents.id} from ${analyticsEvents} where ${lt(analyticsEvents.createdAt, cutoff)} limit ${PRUNE_BATCH})`,
    );
  await db
    .delete(rateLimit)
    .where(
      sql`${rateLimit.id} in (select ${rateLimit.id} from ${rateLimit} where ${lt(rateLimit.lastRequest, now.getTime() - DAY_MS)} limit ${PRUNE_BATCH})`,
    );
}

const REPORT_LIMIT = 10;
const num = (expr: SQL) => expr.mapWith(Number);
const round = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

/** Start of the range: the UTC midnight of today, or of 6 / 29 days earlier. */
function rangeStart(range: AnalyticsRange, now: Date): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const back = range === "today" ? 0 : range === "7d" ? 6 : 29;
  return new Date(midnight - back * DAY_MS);
}

type DailyRow = AnalyticsReport["daily"][number];

/** One row per UTC day of the range, ending today and oldest first; days without events are zeros. */
export function fillDailyDays(rows: DailyRow[], range: AnalyticsRange, now: Date): DailyRow[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
  const start = rangeStart(range, now).getTime();
  return Array.from({ length: days }, (_, i) => {
    const day = utcDay(new Date(start + i * DAY_MS));
    return byDay.get(day) ?? { day, visitors: 0, uniqueIps: 0, pageviews: 0 };
  });
}

export async function getAnalyticsReport(range: AnalyticsRange, now: Date): Promise<AnalyticsReport> {
  const e = analyticsEvents;
  const inRange = (type: string) => and(eq(e.type, type), gte(e.createdAt, rangeStart(range, now)));
  const label = (expr: SQL, fallback: string) => sql<string>`coalesce(nullif(${expr}, ''), ${fallback})`;
  // Group and order by position (1 = the label): drizzle binds `fallback` as a new parameter each time the
  // expression is rendered, so `group by coalesce(..., $4)` would not match `select coalesce(..., $1)` in Postgres.
  const counted = (column: SQL, fallback: string, type: string) =>
    db
      .select({ label: label(column, fallback), count: num(sql`count(*)`) })
      .from(e)
      .where(inRange(type))
      .groupBy(sql`1`)
      .orderBy(desc(sql`count(*)`), sql`1`)
      .limit(REPORT_LIMIT);
  const day = sql<string>`to_char(${e.createdAt}, 'YYYY-MM-DD')`;

  const [[totals], daily, pages, durations, [overall], referrers, devices, browsers, clicks, interactions, api, vitals] = await Promise.all([
    db
      .select({
        visitors: num(sql`count(distinct ${e.visitorId})`),
        sessions: num(sql`count(distinct ${e.sessionId})`),
        pageviews: num(sql`count(*)`),
        signedIn: num(sql`count(*) filter (where ${e.signedIn})`),
      })
      .from(e)
      .where(inRange("pageview")),
    db
      .select({
        day,
        visitors: num(sql`count(distinct ${e.visitorId})`),
        uniqueIps: num(sql`count(distinct ${e.ipHash})`),
        pageviews: num(sql`count(*)`),
      })
      .from(e)
      .where(inRange("pageview"))
      .groupBy(day)
      .orderBy(day),
    db
      .select({ path: e.path, views: num(sql`count(*)`), visitors: num(sql`count(distinct ${e.visitorId})`) })
      .from(e)
      .where(inRange("pageview"))
      .groupBy(e.path)
      .orderBy(desc(sql`count(*)`), e.path)
      .limit(REPORT_LIMIT),
    db
      .select({ path: e.path, avg: num(sql`avg(${e.value})`) })
      .from(e)
      .where(inRange("leave"))
      .groupBy(e.path),
    db
      .select({ avg: sql<string | null>`avg(${e.value})`.mapWith((v) => (v === null ? null : Number(v))) })
      .from(e)
      .where(inRange("leave")),
    counted(sql`${e.referrer}`, "direct", "pageview"),
    counted(sql`${e.device}`, "unknown", "pageview"),
    counted(sql`${e.browser}`, "unknown", "pageview"),
    counted(sql`${e.name}`, "unknown", "click"),
    counted(sql`${e.name}`, "unknown", "interaction"),
    db
      .select({
        name: sql<string>`coalesce(${e.name}, '')`,
        calls: num(sql`count(*)`),
        errors: num(sql`count(*) filter (where ${e.status} = 0 or ${e.status} >= 400)`),
        p50: sql<number | null>`percentile_cont(0.5) within group (order by ${e.value})`.mapWith((v) => (v === null ? null : Number(v))),
        p95: sql<number | null>`percentile_cont(0.95) within group (order by ${e.value})`.mapWith((v) => (v === null ? null : Number(v))),
      })
      .from(e)
      .where(inRange("api"))
      .groupBy(e.name)
      .orderBy(desc(sql`count(*)`), e.name)
      .limit(REPORT_LIMIT),
    db
      .select({
        name: sql<string>`coalesce(${e.name}, '')`,
        samples: num(sql`count(*)`),
        p75: sql<number | null>`percentile_cont(0.75) within group (order by ${e.value})`.mapWith((v) => (v === null ? null : Number(v))),
      })
      .from(e)
      .where(inRange("vital"))
      .groupBy(e.name),
  ]);

  const avgByPath = new Map(durations.map((d) => [d.path, d.avg]));
  const vitalByName = new Map(vitals.map((v) => [v.name, v]));
  const pageviews = totals?.pageviews ?? 0;

  return {
    range,
    totals: {
      visitors: totals?.visitors ?? 0,
      sessions: totals?.sessions ?? 0,
      pageviews,
      signedInShare: pageviews === 0 ? 0 : (totals?.signedIn ?? 0) / pageviews,
      avgDurationMs: overall?.avg == null ? null : Math.round(overall.avg),
    },
    daily: fillDailyDays(daily, range, now),
    topPages: pages.map((p) => ({ ...p, avgDurationMs: avgByPath.has(p.path) ? Math.round(avgByPath.get(p.path)!) : null })),
    referrers,
    devices,
    browsers,
    clicks,
    interactions,
    api: api.map((a) => {
      const space = a.name.indexOf(" ");
      return {
        method: space === -1 ? "" : a.name.slice(0, space),
        apiPath: space === -1 ? a.name : a.name.slice(space + 1),
        calls: a.calls,
        errors: a.errors,
        p50Ms: round(a.p50),
        p95Ms: round(a.p95),
      };
    }),
    vitals: WEB_VITALS.map((name: WebVital) => {
      const v = vitalByName.get(name);
      const p75 = round(v?.p75 ?? null);
      return { name, samples: v?.samples ?? 0, p75, rating: p75 === null ? null : vitalRating(name, p75) };
    }),
  };
}

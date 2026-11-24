import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Data-layer checks for the ingest side: the salt upsert and the opportunistic prune, rendered to SQL.
const seen = vi.hoisted(() => ({ deletes: [] as unknown[], wheres: [] as unknown[], conflict: 0, rows: [] as unknown[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => {
  const p: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (res: (v: unknown) => unknown) => Promise.resolve(seen.rows).then(res);
      if (prop === "where") return (w: unknown) => (seen.wheres.push(w), p);
      if (prop === "onConflictDoNothing") return () => (seen.conflict++, p);
      return () => p;
    },
    apply: () => p,
  });
  return { db: { select: () => p, insert: () => p, delete: (t: unknown) => (seen.deletes.push(t), p) } };
});

const { fillDailyDays, getDailySalt, pruneAnalytics } = await import("./analytics");
const { analyticsEvents, analyticsSalts, rateLimit } = await import("@/db/schema");
const dialect = new PgDialect();
const sqlOf = (x: unknown) => dialect.sqlToQuery(x as never);

const NOW = new Date("2026-11-24T10:00:00.000Z");

beforeEach(() => {
  seen.deletes.length = 0;
  seen.wheres.length = 0;
  seen.conflict = 0;
  seen.rows = [{ salt: "s1" }];
});

describe("getDailySalt", () => {
  it("inserts with on conflict do nothing, then returns the stored salt", async () => {
    const salt = await getDailySalt(NOW);
    expect(seen.conflict).toBe(1);
    expect(salt).toBe("s1");
  });
});

describe("pruneAnalytics rate_limit (F10)", () => {
  it("deletes from rate_limit rows whose last request is older than 24 hours", async () => {
    await pruneAnalytics(NOW);
    expect(seen.deletes).toContain(rateLimit);
    const cutoff = NOW.getTime() - 24 * 60 * 60 * 1000;
    const rendered = seen.wheres.map((w) => sqlOf(w));
    expect(rendered.some((q) => q.sql.includes("last_request") && q.params.includes(cutoff))).toBe(true);
  });
});

describe("pruneAnalytics", () => {
  it("deletes old salts and old events", async () => {
    await pruneAnalytics(NOW);
    expect(seen.deletes).toContain(analyticsSalts);
    expect(seen.deletes).toContain(analyticsEvents);
  });

  it("keeps today's salt: only days before 2026-11-24 are removed", async () => {
    await pruneAnalytics(NOW);
    const all = seen.wheres.map((w) => sqlOf(w));
    expect(all.some((q) => q.params.includes("2026-11-24"))).toBe(true);
  });
});

// F8. Assumed pure helper: fillDailyDays(rows, range, now) returns one row per UTC day ending today
// (1 for "today", 7 for "7d", 30 for "30d"), oldest first, zeros for days with no events.
describe("fillDailyDays", () => {
  const row = (day: string, visitors: number, uniqueIps: number, pageviews: number) => ({ day, visitors, uniqueIps, pageviews });

  it("returns 7 days ending today, keeping real rows and zeroing the gaps", () => {
    const out = fillDailyDays([row("2026-11-24", 2, 3, 9), row("2026-11-20", 1, 1, 4)], "7d", NOW);
    expect(out.map((d) => d.day)).toEqual([
      "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24",
    ]);
    expect(out[2]).toEqual(row("2026-11-20", 1, 1, 4));
    expect(out[6]).toEqual(row("2026-11-24", 2, 3, 9));
    expect(out[0]).toEqual(row("2026-11-18", 0, 0, 0));
  });

  it("returns 30 days for 30d and 1 for today", () => {
    expect(fillDailyDays([], "30d", NOW)).toHaveLength(30);
    expect(fillDailyDays([], "today", NOW)).toEqual([row("2026-11-24", 0, 0, 0)]);
  });
});

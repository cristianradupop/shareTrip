import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake db: every insert(rateLimit).values(v).onConflictDoUpdate(c).returning() is recorded; the returned row
// is looked up by key prefix ("global|" for the daily budget, anything else for the per-IP bucket).
const fake = vi.hoisted(() => ({
  calls: [] as Array<{ values: Record<string, unknown>; set: Record<string, unknown> }>,
  ip: { count: 1, lastRequest: 0 },
  global: { count: 1, lastRequest: 0 },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({
  db: {
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: (c: { set: Record<string, unknown> }) => {
          fake.calls.push({ values, set: c.set });
          return { returning: async () => [String(values.key).startsWith("global|") ? fake.global : fake.ip] };
        },
      }),
    }),
  },
}));

// Assumed API: consumeAnalyticsAttempt(req, eventCount, { salt, now }) (salt = the daily salt) and constants ANALYTICS_LIMIT_MAX (300 events per
// 60 s per IP) and ANALYTICS_GLOBAL_DAILY_MAX (10000 events per UTC day, rate_limit key "global|/analytics|<day>").
const lim = await import("./analytics-limit");

const NOW = Date.UTC(2026, 10, 24, 10, 0, 0);
const SALT = "daily-salt-a";
const HASHED = /^[0-9a-f]{64}\|\/analytics$/;
const req = (xff: string) => new Request("http://app.test/api/analytics", { method: "POST", headers: { "x-forwarded-for": xff } });
const ipCall = () => fake.calls.find((c) => !String(c.values.key).startsWith("global|"));
const globalCall = () => fake.calls.find((c) => String(c.values.key).startsWith("global|"));
const dialect = new PgDialect();

beforeEach(() => {
  fake.calls.length = 0;
  fake.ip = { count: 1, lastRequest: NOW };
  fake.global = { count: 1, lastRequest: NOW };
});

describe("analytics limit constants", () => {
  it("are 300 events per minute per IP and 10000 events per day", () => {
    expect(lim.ANALYTICS_LIMIT_MAX).toBe(300);
    expect(lim.ANALYTICS_LIMIT_WINDOW_SECONDS).toBe(60);
    expect(lim.ANALYTICS_GLOBAL_DAILY_MAX).toBe(10000);
  });
});

describe("consumeAnalyticsAttempt counts events", () => {
  it("starts the IP bucket at the event count and the global bucket for the UTC day", async () => {
    await lim.consumeAnalyticsAttempt(req("203.0.113.5"), 7, { salt: SALT, now: NOW });
    expect(ipCall()?.values).toMatchObject({ count: 7 });
    expect(globalCall()?.values.key).toContain("2026-11-24");
    expect(globalCall()?.values.count).toBe(7);
  });

  it("increments by the event count, not by one", async () => {
    await lim.consumeAnalyticsAttempt(req("203.0.113.5"), 50, { salt: SALT, now: NOW });
    const q = dialect.sqlToQuery(ipCall()!.set.count as never);
    expect(q.params).toContain(50);
  });

  it("allows up to 300 events in the window, denies the 301st with scope ip", async () => {
    fake.ip = { count: 300, lastRequest: NOW };
    expect(await lim.consumeAnalyticsAttempt(req("203.0.113.5"), 50, { salt: SALT, now: NOW })).toEqual({ allowed: true });
    fake.ip = { count: 301, lastRequest: NOW - 20_000 };
    expect(await lim.consumeAnalyticsAttempt(req("203.0.113.5"), 1, { salt: SALT, now: NOW })).toEqual({ allowed: false, scope: "ip", retryAfterSeconds: 40 });
  });

  it("denies with scope global once the daily budget is exceeded", async () => {
    fake.global = { count: 10001, lastRequest: NOW };
    expect(await lim.consumeAnalyticsAttempt(req("203.0.113.5"), 1, { salt: SALT, now: NOW })).toMatchObject({ allowed: false, scope: "global" });
    fake.global = { count: 10000, lastRequest: NOW };
    expect(await lim.consumeAnalyticsAttempt(req("203.0.113.5"), 1, { salt: SALT, now: NOW })).toEqual({ allowed: true });
  });
});

describe("IPv6 keying", () => {
  const keyOf = async (ip: string) => {
    fake.calls.length = 0;
    await lim.consumeAnalyticsAttempt(req(ip), 1, { salt: SALT, now: NOW });
    return String(ipCall()?.values.key);
  };

  it("addresses in the same /64 share one key", async () => {
    const a = await keyOf("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    const b = await keyOf("2001:db8:1:2:1111:2222:3333:4444");
    expect(a).toBe(b);
    expect(a).not.toContain("aaaa");
  });

  it("addresses in different /64 prefixes get different keys", async () => {
    expect(await keyOf("2001:db8:1:2::1")).not.toBe(await keyOf("2001:db8:1:3::1"));
  });

  it("IPv4 different addresses get different keys", async () => {
    expect(await keyOf("203.0.113.9")).not.toBe(await keyOf("203.0.113.10"));
  });
});

// Fix round 3 F9: the per-IP key is a salted hash, never the raw IP or the /64 prefix.
describe("hashed per-IP key (F9)", () => {
  const keyFor = async (ip: string, salt: string) => {
    fake.calls.length = 0;
    await lim.consumeAnalyticsAttempt(req(ip), 1, { salt, now: NOW });
    return String(ipCall()?.values.key);
  };

  it("never contains the raw IPv4 address and ends with |/analytics", async () => {
    const key = await keyFor("203.0.113.5", SALT);
    expect(key).not.toContain("203.0.113.5");
    expect(key).toMatch(HASHED);
  });

  it("never contains the IPv6 /64 prefix", async () => {
    const key = await keyFor("2001:db8:1:2:aaaa:bbbb:cccc:dddd", SALT);
    expect(key).not.toContain("2001");
    expect(key).not.toContain("db8");
    expect(key).toMatch(HASHED);
  });

  it("same IP and same salt give the same key", async () => {
    expect(await keyFor("203.0.113.5", SALT)).toBe(await keyFor("203.0.113.5", SALT));
  });

  it("a different salt gives a different key", async () => {
    expect(await keyFor("203.0.113.5", SALT)).not.toBe(await keyFor("203.0.113.5", "daily-salt-b"));
  });

  it("the global key stays global|/analytics|<day>", async () => {
    await keyFor("203.0.113.5", SALT);
    expect(globalCall()?.values.key).toBe("global|/analytics|2026-11-24");
  });
});

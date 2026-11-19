import { beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "@/db/schema";

// Own fake db: captures insert(table).values(v).onConflictDoUpdate(c).returning(r) and resolves to `returned`.
const fake = vi.hoisted(() => ({
  returned: [] as Array<{ count: number; lastRequest: number }>,
  table: undefined as unknown,
  values: undefined as Record<string, unknown> | undefined,
  conflict: undefined as { target: unknown; set: Record<string, unknown> } | undefined,
  returning: undefined as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({
  db: {
    insert: (table: unknown) => {
      fake.table = table;
      return {
        values: (v: Record<string, unknown>) => {
          fake.values = v;
          return {
            onConflictDoUpdate: (c: { target: unknown; set: Record<string, unknown> }) => {
              fake.conflict = c;
              return {
                returning: async (r: unknown) => {
                  fake.returning = r;
                  return fake.returned;
                },
              };
            },
          };
        },
      };
    },
  },
}));

const {
  SIGNUP_LIMIT_MAX,
  SIGNUP_LIMIT_MESSAGE,
  SIGNUP_LIMIT_PATH,
  SIGNUP_LIMIT_WINDOW_SECONDS,
  consumeSignupAttempt,
  nextSignupWindow,
  signupLimitKey,
  signupVerdict,
} = await import("./signup-limit");

const HOUR = 3_600_000;
const NOW = 1_800_000_000_000;
const req = (xff?: string) => new Request("http://app.test/api/signup", { method: "POST", headers: xff ? { "x-forwarded-for": xff } : {} });

beforeEach(() => {
  fake.returned = [{ count: 1, lastRequest: NOW }];
  fake.values = undefined;
  fake.conflict = undefined;
  fake.table = undefined;
});

describe("constants", () => {
  it("match the plan", () => {
    expect(SIGNUP_LIMIT_MAX).toBe(10);
    expect(SIGNUP_LIMIT_WINDOW_SECONDS).toBe(3600);
    expect(SIGNUP_LIMIT_PATH).toBe("/signup");
    expect(SIGNUP_LIMIT_MESSAGE).toBe("Too many sign-up attempts. Try again later.");
  });
});

describe("signupLimitKey", () => {
  it("joins ip and path", () => expect(signupLimitKey("1.2.3.4")).toBe("1.2.3.4|/signup"));
  it("uses one shared bucket for an unknown ip", () => expect(signupLimitKey(null)).toBe("unknown|/signup"));
});

describe("nextSignupWindow", () => {
  it("starts a window on the first attempt", () => {
    expect(nextSignupWindow(null, NOW)).toEqual({ count: 1, windowStart: NOW });
  });
  it("increments inside the window and keeps its start", () => {
    expect(nextSignupWindow({ count: 4, windowStart: NOW - 1000 }, NOW)).toEqual({ count: 5, windowStart: NOW - 1000 });
  });
  it("does not reset just before 3600 s", () => {
    expect(nextSignupWindow({ count: 10, windowStart: NOW - HOUR + 1 }, NOW)).toEqual({ count: 11, windowStart: NOW - HOUR + 1 });
  });
  it("resets exactly at 3600 s", () => {
    expect(nextSignupWindow({ count: 10, windowStart: NOW - HOUR }, NOW)).toEqual({ count: 1, windowStart: NOW });
  });
  it("resets after 3600 s", () => {
    expect(nextSignupWindow({ count: 99, windowStart: NOW - HOUR - 5 }, NOW)).toEqual({ count: 1, windowStart: NOW });
  });
});

describe("signupVerdict", () => {
  it("allows the 10th attempt", () => {
    expect(signupVerdict({ count: 10, windowStart: NOW }, NOW)).toEqual({ allowed: true });
  });
  it("blocks the 11th with the seconds left", () => {
    expect(signupVerdict({ count: 11, windowStart: NOW - HOUR + 120_000 }, NOW)).toEqual({ allowed: false, retryAfterSeconds: 120 });
  });
  it("rounds Retry-After up", () => {
    expect(signupVerdict({ count: 11, windowStart: NOW - HOUR + 120_001 }, NOW)).toEqual({ allowed: false, retryAfterSeconds: 121 });
  });
  it("never returns less than 1 second", () => {
    expect(signupVerdict({ count: 11, windowStart: NOW - HOUR }, NOW)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(signupVerdict({ count: 50, windowStart: NOW - HOUR - 9000 }, NOW)).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });
});

describe("consumeSignupAttempt", () => {
  it("upserts into rate_limit under <ip>|/signup taken from x-forwarded-for", async () => {
    await consumeSignupAttempt(req("1.2.3.4"), NOW);
    expect(fake.table).toBe(rateLimit);
    expect(fake.values).toMatchObject({ key: "1.2.3.4|/signup", count: 1, lastRequest: NOW });
    expect(typeof fake.values?.id).toBe("string");
    expect(fake.conflict?.target).toBe(rateLimit.key);
    expect(Object.keys(fake.conflict?.set ?? {}).sort()).toEqual(["count", "lastRequest"]);
  });

  it("gives two IPs two keys", async () => {
    await consumeSignupAttempt(req("1.2.3.4"), NOW);
    const first = fake.values?.key;
    await consumeSignupAttempt(req("5.6.7.8"), NOW);
    expect(first).toBe("1.2.3.4|/signup");
    expect(fake.values?.key).toBe("5.6.7.8|/signup");
  });

  it("allows while the returned row is within the limit", async () => {
    fake.returned = [{ count: 10, lastRequest: NOW }];
    expect(await consumeSignupAttempt(req("1.2.3.4"), NOW)).toEqual({ allowed: true });
  });

  it("blocks when the returned row is over the limit", async () => {
    fake.returned = [{ count: 11, lastRequest: NOW - HOUR + 90_000 }];
    expect(await consumeSignupAttempt(req("1.2.3.4"), NOW)).toEqual({ allowed: false, retryAfterSeconds: 90 });
  });
});

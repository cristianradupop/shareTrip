import { describe, expect, it } from "vitest";
import {
  ANALYTICS_MAX_BATCH,
  CONSENT_COOKIE,
  analyticsBatchSchema,
  formatConsent,
  isTrackedPath,
  normalizePath,
  parseConsent,
  readCookie,
  vitalRating,
} from "@/shared/analytics";
import { hashIp, parseUserAgent, toEventRows } from "./analytics";

const UUID = "3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b";
const UUID2 = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";

describe("normalizePath", () => {
  it.each([
    ["/", "/"],
    ["/trips?x=1#top", "/trips"],
    ["/trips/3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b", "/trips/:id"],
    ["/users/42/edit", "/users/:id/edit"],
    ["/t/a1b2c3d4e5f6a7b8c9d0", "/t/:id"],
    ["/organizer/trips", "/organizer/trips"],
    ["/aaaaaaaaaaaaaaaaaaaa", "/aaaaaaaaaaaaaaaaaaaa"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
});

describe("isTrackedPath", () => {
  it.each(["/admin", "/admin/trips", "/admin/analytics"])("%s is not tracked", (p) => expect(isTrackedPath(p)).toBe(false));
  it.each(["/", "/privacy", "/administrator", "/organizer"])("%s is tracked", (p) => expect(isTrackedPath(p)).toBe(true));
});

describe("consent cookie", () => {
  it("uses the tt_consent cookie name", () => expect(CONSENT_COOKIE).toBe("tt_consent"));

  it("round-trips granted and denied", () => {
    expect(formatConsent(true)).toBe("1.granted");
    expect(formatConsent(false)).toBe("1.denied");
    expect(parseConsent(formatConsent(true))).toEqual({ analytics: true });
    expect(parseConsent(formatConsent(false))).toEqual({ analytics: false });
  });

  it.each([undefined, "", "2.granted", "0.granted", "garbage", "1.maybe"])("parseConsent(%j) is null", (raw) => {
    expect(parseConsent(raw)).toBeNull();
  });
});

describe("readCookie", () => {
  it("finds a cookie among several", () => {
    expect(readCookie("a=1; tt_consent=1.granted; b=2", "tt_consent")).toBe("1.granted");
  });
  it("returns undefined/null-ish for a missing cookie or header", () => {
    expect(readCookie("a=1", "tt_consent") ?? null).toBeNull();
    expect(readCookie(null, "tt_consent") ?? null).toBeNull();
  });
  it("does not match a cookie whose name only ends with the name", () => {
    expect(readCookie("x_tt_consent=1.granted", "tt_consent") ?? null).toBeNull();
  });
});

describe("vitalRating", () => {
  it.each([
    ["LCP", 2500, "good"],
    ["LCP", 2501, "needs-improvement"],
    ["LCP", 4000, "needs-improvement"],
    ["LCP", 4001, "poor"],
    ["CLS", 0.1, "good"],
    ["CLS", 0.3, "poor"],
    ["INP", 200, "good"],
    ["TTFB", 1000, "needs-improvement"],
    ["FCP", 3001, "poor"],
  ] as const)("%s %s is %s", (name, value, rating) => {
    expect(vitalRating(name, value)).toBe(rating);
  });
});

describe("analyticsBatchSchema", () => {
  const ev = { type: "pageview", path: "/" };
  const batch = (events: unknown[]) => ({ visitorId: UUID, sessionId: UUID2, events });

  it("accepts a valid batch with every event type", () => {
    const events = [
      ev,
      { type: "leave", path: "/", durationMs: 1200 },
      { type: "click", path: "/", target: "nav-login" },
      { type: "interaction", path: "/", name: "login" },
      { type: "api", path: "/", method: "GET", apiPath: "/api/feed", status: 200, durationMs: 40 },
      { type: "vital", path: "/", name: "LCP", value: 1800 },
    ];
    expect(analyticsBatchSchema.safeParse(batch(events)).success).toBe(true);
  });

  it("accepts exactly the maximum batch size and rejects one more", () => {
    expect(ANALYTICS_MAX_BATCH).toBe(50);
    expect(analyticsBatchSchema.safeParse(batch(Array.from({ length: 50 }, () => ev))).success).toBe(true);
    expect(analyticsBatchSchema.safeParse(batch(Array.from({ length: 51 }, () => ev))).success).toBe(false);
  });

  it.each([
    ["a non-uuid visitor id", { visitorId: "nope", sessionId: UUID2, events: [ev] }],
    ["an unknown event type", batch([{ type: "keylog", path: "/" }])],
    ["an unknown interaction name", batch([{ type: "interaction", path: "/", name: "hack" }])],
    ["an unknown web vital", batch([{ type: "vital", path: "/", name: "XYZ", value: 1 }])],
  ])("rejects %s", (_n, body) => {
    expect(analyticsBatchSchema.safeParse(body).success).toBe(false);
  });
});

describe("hashIp", () => {
  it("is a stable sha256 hex string per salt", () => {
    const h = hashIp("203.0.113.9", "salt-a");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("203.0.113.9", "salt-a")).toBe(h);
  });
  it("changes with the salt and with the ip", () => {
    expect(hashIp("203.0.113.9", "salt-b")).not.toBe(hashIp("203.0.113.9", "salt-a"));
    expect(hashIp("203.0.113.10", "salt-a")).not.toBe(hashIp("203.0.113.9", "salt-a"));
  });
  it("never contains the IP", () => {
    expect(hashIp("203.0.113.9", "salt-a")).not.toContain("203");
  });
});

describe("parseUserAgent", () => {
  const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  it.each([
    [CHROME, "desktop", "Chrome"],
    [CHROME + " Edg/126.0.0.0", "desktop", "Edge"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0", "desktop", "Firefox"],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "mobile",
      "Safari",
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "tablet",
      "Safari",
    ],
    [CHROME + " OPR/110.0.0.0", "desktop", "Opera"],
    [
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
      "mobile",
      "Samsung",
    ],
    ["curl/8.4.0", "desktop", "Other"],
  ])("%s", (ua, device, browser) => {
    expect(parseUserAgent(ua)).toMatchObject({ device, browser, bot: false });
  });

  it.each(["Googlebot/2.1 (+http://www.google.com/bot.html)", "Mozilla/5.0 (compatible; bingbot/2.0)"])("flags a bot: %s", (ua) => {
    expect(parseUserAgent(ua).bot).toBe(true);
  });
});

describe("toEventRows", () => {
  const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  const meta = { ipHash: "h".repeat(64), signedIn: true, ua: CHROME };
  const batch = (events: unknown[]) => analyticsBatchSchema.parse({ visitorId: UUID, sessionId: UUID2, events });

  it("builds one row per event with the server-side fields and no raw ip or user agent", () => {
    const rows = toEventRows(
      batch([
        { type: "pageview", path: "/", referrer: "example.org", language: "en", screen: "1920x1080" },
        { type: "api", path: "/", method: "GET", apiPath: "/api/feed", status: 200, durationMs: 40 },
      ]),
      meta,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "pageview", visitorId: UUID, sessionId: UUID2, ipHash: meta.ipHash, signedIn: true, path: "/", device: "desktop", browser: "Chrome" });
    for (const row of rows) {
      const keys = Object.keys(row).map((k) => k.toLowerCase());
      expect(keys).not.toContain("ip");
      expect(keys).not.toContain("useragent");
      expect(keys).not.toContain("ua");
      expect(JSON.stringify(row)).not.toContain("Mozilla");
    }
  });

  it("drops events on /admin paths", () => {
    const rows = toEventRows(
      batch([
        { type: "pageview", path: "/admin/trips" },
        { type: "click", path: "/admin", target: "x" },
        { type: "pageview", path: "/privacy" },
      ]),
      meta,
    );
    expect(rows.map((r) => r.path)).toEqual(["/privacy"]);
  });

  it("normalizes paths", () => {
    const rows = toEventRows(batch([{ type: "pageview", path: `/trips/${UUID}?x=1` }]), meta);
    expect(rows[0].path).toBe("/trips/:id");
  });
});

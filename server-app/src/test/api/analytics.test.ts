import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsEvents } from "@/db/schema";
import { reset, state } from "../helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
const limit = vi.hoisted(() => vi.fn());
// Assumed export name of the limit module (the plan names only the file): consumeAnalyticsAttempt(req) -> verdict.
vi.mock("@/lib/analytics-limit", () => ({ consumeAnalyticsAttempt: limit }));

const route = await import("../../app/api/analytics/route");
const POST = route.POST as (r: Request) => Promise<Response>;

const UUID = "3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b";
const UUID2 = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const IP = "203.0.113.77";

const body = (n = 1) => ({
  visitorId: UUID,
  sessionId: UUID2,
  events: Array.from({ length: n }, () => ({ type: "pageview", path: "/" })),
});

function req(opts: { body?: unknown; cookie?: string; headers?: Record<string, string>; raw?: string } = {}) {
  return new Request("http://app.test/api/analytics", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": CHROME,
      "x-forwarded-for": IP,
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...opts.headers,
    },
    body: opts.raw ?? JSON.stringify(opts.body ?? body()),
  });
}

const GRANTED = "tt_consent=1.granted";
const eventInserts = () => state.inserts.filter((i) => i.table === analyticsEvents);

beforeEach(() => {
  reset();
  limit.mockReset();
  limit.mockResolvedValue({ allowed: true });
  vi.stubEnv("BETTER_AUTH_URL", "http://app.test");
  state.result = [{ salt: "daily-salt" }];
});

describe("POST /api/analytics guards", () => {
  it("403 for a foreign Origin, before anything else", async () => {
    const res = await POST(req({ cookie: GRANTED, headers: { origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
    expect(eventInserts()).toHaveLength(0);
    expect(limit).not.toHaveBeenCalled();
  });

  it("415 when the body is not JSON", async () => {
    const res = await POST(req({ cookie: GRANTED, headers: { "content-type": "text/plain" } }));
    expect(res.status).toBe(415);
    expect(eventInserts()).toHaveLength(0);
  });

  it("413 when content-length is over 65536", async () => {
    const res = await POST(req({ cookie: GRANTED, headers: { "content-length": "70000" } }));
    expect(res.status).toBe(413);
    expect(eventInserts()).toHaveLength(0);
  });

  it.each([
    ["no consent cookie", undefined],
    ["a denied consent cookie", "tt_consent=1.denied"],
    ["a consent cookie of another version", "tt_consent=2.granted"],
  ])("204 and nothing stored with %s", async (_n, cookie) => {
    const res = await POST(req({ cookie }));
    expect(res.status).toBe(204);
    expect(eventInserts()).toHaveLength(0);
    expect(state.inserts).toHaveLength(0);
    expect(limit).not.toHaveBeenCalled();
  });

  it("429 when the rate limit denies, with nothing stored", async () => {
    limit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    const res = await POST(req({ cookie: GRANTED }));
    expect(res.status).toBe(429);
    expect(eventInserts()).toHaveLength(0);
  });

  it.each([
    ["an invalid body", { nope: true }],
    ["51 events", body(51)],
    ["a non-uuid visitor id", { ...body(), visitorId: "x" }],
  ])("400 for %s", async (_n, b) => {
    const res = await POST(req({ cookie: GRANTED, body: b }));
    expect(res.status).toBe(400);
    expect(eventInserts()).toHaveLength(0);
  });

  it("400 for malformed JSON", async () => {
    const res = await POST(req({ cookie: GRANTED, raw: "{not json" }));
    expect(res.status).toBe(400);
  });

  it("204 and nothing stored for a bot user agent", async () => {
    const res = await POST(req({ cookie: GRANTED, headers: { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" } }));
    expect(res.status).toBe(204);
    expect(eventInserts()).toHaveLength(0);
  });
});

describe("POST /api/analytics with consent", () => {
  it("answers 204 and inserts the events with a hashed ip and no raw ip or user agent", async () => {
    const res = await POST(req({ cookie: GRANTED, body: body(2) }));
    expect(res.status).toBe(204);
    const inserts = eventInserts();
    expect(inserts.length).toBeGreaterThan(0);
    const rows = inserts.flatMap((i) => (Array.isArray(i.values) ? i.values : [i.values])) as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "pageview", visitorId: UUID, sessionId: UUID2, path: "/", signedIn: false, device: "desktop", browser: "Chrome" });
    expect(rows[0].ipHash).toMatch(/^[0-9a-f]{64}$/);
    const json = JSON.stringify(inserts.map((i) => i.values));
    expect(json).not.toContain(IP);
    expect(json).not.toContain("Mozilla");
  });

  it("marks signedIn true when the session cookie is present", async () => {
    await POST(req({ cookie: `${GRANTED}; better-auth.session_token=abc.def` }));
    const rows = eventInserts().flatMap((i) => (Array.isArray(i.values) ? i.values : [i.values])) as Record<string, unknown>[];
    expect(rows[0]).toMatchObject({ signedIn: true });
  });

  it("does not store events for /admin paths", async () => {
    const b = { ...body(), events: [{ type: "pageview", path: "/admin/trips" }] };
    const res = await POST(req({ cookie: GRANTED, body: b }));
    expect(res.status).toBe(204);
    const rows = eventInserts().flatMap((i) => (Array.isArray(i.values) ? i.values : [i.values]));
    expect(rows).toHaveLength(0);
  });
});

// Fix round 2. Assumed: consumeAnalyticsAttempt(req, eventCount) -> { allowed: true }
//   | { allowed: false, scope: "ip", retryAfterSeconds } | { allowed: false, scope: "global" }.
describe("POST /api/analytics fix round 2", () => {
  const rows = () => eventInserts().flatMap((i) => (Array.isArray(i.values) ? i.values : [i.values])) as Record<string, unknown>[];
  const withReferrer = (referrer: unknown) => ({ ...body(), events: [{ type: "pageview", path: "/", referrer }] });

  it.each([
    ["https://example.com/a/b?token=1#x", "example.com"],
    ["http://sub.example.org:8080/path", "sub.example.org"],
    ["example.net", "example.net"],
  ])("F4 stores only the hostname of %s", async (input, host) => {
    await POST(req({ cookie: GRANTED, body: withReferrer(input) }));
    expect(rows()[0].referrer).toBe(host);
  });

  it.each(["javascript:alert(1)", "not a url !!", "https://", "/just/a/path"])("F4 stores null for the junk referrer %j", async (input) => {
    await POST(req({ cookie: GRANTED, body: withReferrer(input) }));
    expect(rows()).toHaveLength(1);
    expect(rows()[0].referrer).toBeNull();
  });

  it("F5 413 for a body over 65536 characters without content-length", async () => {
    const raw = JSON.stringify({ visitorId: UUID, sessionId: UUID2, events: [], pad: "x".repeat(70000) });
    const r = req({ cookie: GRANTED, raw });
    expect(r.headers.get("content-length")).toBeNull();
    const res = await POST(r);
    expect(res.status).toBe(413);
    expect(eventInserts()).toHaveLength(0);
  });

  it("F3 counts events, not requests: the limiter gets the number of events", async () => {
    await POST(req({ cookie: GRANTED, body: body(3) }));
    expect(limit).toHaveBeenCalledTimes(1);
    expect(limit.mock.calls[0][1]).toBe(3);
  });

  it("F3 global cap answers 204 and stores nothing", async () => {
    limit.mockResolvedValue({ allowed: false, scope: "global" });
    const res = await POST(req({ cookie: GRANTED, body: body(2) }));
    expect(res.status).toBe(204);
    expect(eventInserts()).toHaveLength(0);
  });

  it("F3 per-IP over budget answers 429 with Retry-After and stores nothing", async () => {
    limit.mockResolvedValue({ allowed: false, scope: "ip", retryAfterSeconds: 42 });
    const res = await POST(req({ cookie: GRANTED, body: body(2) }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(eventInserts()).toHaveLength(0);
  });
});

// Fix round 3. F9: the limiter receives the daily salt ({ salt, now }), so getDailySalt runs before it.
// F11: an empty batch is a 400.
describe("POST /api/analytics fix round 3", () => {
  it("F9 passes the daily salt to the limiter as the third argument", async () => {
    await POST(req({ cookie: GRANTED, body: body(2) }));
    expect(limit).toHaveBeenCalledTimes(1);
    expect(limit.mock.calls[0][2]).toMatchObject({ salt: "daily-salt" });
  });

  it("F11 400 for a batch with no events, nothing stored and the limiter untouched", async () => {
    const res = await POST(req({ cookie: GRANTED, body: body(0) }));
    expect(res.status).toBe(400);
    expect(limit).not.toHaveBeenCalled();
    expect(eventInserts()).toHaveLength(0);
  });
});

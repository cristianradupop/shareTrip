import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeClickTarget, endPageView, flush, setAnalyticsEnabled, startPageView, track, trackVital } from "./analytics";

// Contract assumed: track(event) takes an event of the shared batch schema (e.g. { type: "click", path, target });
// flush({ keepalive }) POSTs { visitorId, sessionId, events } as JSON to /api/analytics. The test stubs fetch,
// location and document (node environment) to observe what would be sent.
const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
let cookie = "";

function stubBrowser(pathname: string) {
  vi.stubGlobal("location", { pathname, search: "", hash: "" });
  vi.stubGlobal("document", {
    get cookie() {
      return cookie;
    },
    set cookie(v: string) {
      cookie = [cookie, v.split(";")[0]].filter(Boolean).join("; ");
    },
    referrer: "",
    visibilityState: "visible",
  });
  vi.stubGlobal("fetch", fetchMock);
}

const click = (n = 0) => ({ type: "click" as const, path: "/", target: `t${n}` });
const sentEvents = () => fetchMock.mock.calls.flatMap((c) => JSON.parse(String((c as unknown as [string, RequestInit])[1].body)).events as unknown[]);

beforeEach(() => {
  vi.useFakeTimers();
  cookie = "";
  fetchMock.mockClear();
  stubBrowser("/");
});

afterEach(() => {
  setAnalyticsEnabled(false);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("describeClickTarget", () => {
  it("prefers data-track over href and text", () => {
    expect(describeClickTarget({ tag: "a", dataTrack: "nav-login", href: "/login", text: "Log in" })).toBe("nav-login");
  });

  it("uses tag plus the href path when there is no data-track", () => {
    const out = describeClickTarget({ tag: "a", href: "/trips?x=1#y", text: "Trips" });
    expect(out).toContain("a");
    expect(out).toContain("/trips");
    expect(out).not.toContain("x=1");
  });

  it("falls back to tag plus the visible label", () => {
    expect(describeClickTarget({ tag: "button", text: "Save" })).toContain("Save");
  });

  it("truncates a long label to 40 characters", () => {
    const out = describeClickTarget({ tag: "button", text: "x".repeat(100) });
    expect(out).not.toContain("x".repeat(41));
    expect(out).toContain("x".repeat(40));
  });
});

describe("collection gate", () => {
  it("queues nothing while analytics is disabled", async () => {
    setAnalyticsEnabled(false);
    track(click());
    await flush({ keepalive: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queues nothing on /admin pages even when enabled", async () => {
    stubBrowser("/admin/trips");
    setAnalyticsEnabled(true);
    track(click());
    await flush({ keepalive: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a queued event as a JSON batch to /api/analytics when enabled", async () => {
    setAnalyticsEnabled(true);
    track(click());
    await flush({ keepalive: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/analytics");
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    const body = JSON.parse(String(init.body));
    expect(body.events).toHaveLength(1);
    expect(body.visitorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.sessionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("flushes by itself at 20 events and never sends more than 50 per batch", async () => {
    setAnalyticsEnabled(true);
    for (let i = 0; i < 20; i++) track(click(i));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalled();
    expect(sentEvents()).toHaveLength(20);
    for (const c of fetchMock.mock.calls) {
      expect(JSON.parse(String((c as unknown as [string, RequestInit])[1].body)).events.length).toBeLessThanOrEqual(50);
    }
  });

  it("flushes after 5 seconds", async () => {
    setAnalyticsEnabled(true);
    track(click());
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(sentEvents()).toHaveLength(1);
  });

  it("drops queued events when analytics is switched off", async () => {
    setAnalyticsEnabled(true);
    track(click());
    setAnalyticsEnabled(false);
    await flush({ keepalive: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// Fix round 2. Assumed API: startPageView(path) records the path and start time of the current page view;
// endPageView() queues ONE { type: "leave", path, durationMs } for it and forgets it (a second call is a no-op,
// so route cleanup and pagehide never both send). It does not flush: the caller then runs flush({ keepalive: true }).
describe("leave once per page view (F1)", () => {
  const leaves = () => sentEvents().filter((e) => (e as { type: string }).type === "leave");

  it("queues one leave with the elapsed time, even when endPageView is called twice", async () => {
    setAnalyticsEnabled(true);
    startPageView("/");
    await vi.advanceTimersByTimeAsync(3000);
    endPageView();
    endPageView();
    await flush({ keepalive: true });
    expect(leaves()).toEqual([{ type: "leave", path: "/", durationMs: 3000 }]);
  });

  it("queues nothing when no page view was started", async () => {
    setAnalyticsEnabled(true);
    endPageView();
    await flush({ keepalive: true });
    expect(leaves()).toHaveLength(0);
  });

  it("a new segment for the same path starts after the page becomes visible again", async () => {
    setAnalyticsEnabled(true);
    startPageView("/privacy");
    await vi.advanceTimersByTimeAsync(2000);
    endPageView();
    startPageView("/privacy");
    await vi.advanceTimersByTimeAsync(1500);
    endPageView();
    await flush({ keepalive: true });
    expect(leaves().map((e) => (e as { durationMs: number }).durationMs)).toEqual([2000, 1500]);
  });

  it("sends nothing while analytics is off", async () => {
    startPageView("/");
    endPageView();
    await flush({ keepalive: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("vitals deduped by metric name (F2)", () => {
  const vital = (name: "LCP" | "INP" | "CLS", value: number) => ({ type: "vital" as const, path: "/", name, value });
  const vitals = () => sentEvents().filter((e) => (e as { type: string }).type === "vital");

  it("a second copy of the same metric name with another id is dropped after the flush", async () => {
    setAnalyticsEnabled(true);
    trackVital("id-a", vital("LCP", 1200));
    await flush({ keepalive: false });
    trackVital("id-b", vital("LCP", 1200));
    await flush({ keepalive: false });
    expect(vitals().filter((e) => (e as { name: string }).name === "LCP")).toHaveLength(1);
  });

  it("two ids for the same name before the flush send the latest value once", async () => {
    setAnalyticsEnabled(true);
    trackVital("id-a", vital("INP", 100));
    trackVital("id-b", vital("INP", 150));
    await flush({ keepalive: false });
    expect(vitals().filter((e) => (e as { name: string }).name === "INP")).toEqual([vital("INP", 150)]);
  });

  it("different metric names are all sent", async () => {
    setAnalyticsEnabled(true);
    trackVital("x", { type: "vital", path: "/", name: "TTFB", value: 80 });
    trackVital("y", { type: "vital", path: "/", name: "FCP", value: 900 });
    await flush({ keepalive: false });
    expect(vitals().map((e) => (e as { name: string }).name).sort()).toEqual(["FCP", "TTFB"]);
  });
});

describe("describeClickTarget normalization (F6)", () => {
  it("replaces ids in link paths", () => {
    expect(describeClickTarget({ tag: "a", href: "/trips/3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b" })).toBe("a /trips/:id");
    expect(describeClickTarget({ tag: "a", href: "/users/42/edit?x=1" })).toBe("a /users/:id/edit");
  });

  it("reduces mailto and tel to the scheme", () => {
    expect(describeClickTarget({ tag: "a", href: "mailto:someone@example.com" })).toBe("a mailto:");
    expect(describeClickTarget({ tag: "a", href: "tel:+40123456789" })).toBe("a tel:");
  });

  it("reduces an external link to its host", () => {
    const out = describeClickTarget({ tag: "a", href: "https://example.org/secret/path?token=abc" });
    expect(out).toBe("a example.org");
  });
});

// Fix round 3. F12: a leave is judged by its own path, so the last page before /admin is still timed.
describe("track by event path (F12)", () => {
  it("keeps a leave for a tracked path while the browser is already on /admin", async () => {
    stubBrowser("/admin/x");
    setAnalyticsEnabled(true);
    track({ type: "leave", path: "/trips", durationMs: 1200 });
    await flush({ keepalive: true });
    expect(sentEvents()).toEqual([{ type: "leave", path: "/trips", durationMs: 1200 }]);
  });

  it("drops a leave whose own path is /admin", async () => {
    setAnalyticsEnabled(true);
    track({ type: "leave", path: "/admin/x", durationMs: 1200 });
    await flush({ keepalive: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops a click whose own path is /admin", async () => {
    setAnalyticsEnabled(true);
    track({ type: "click", path: "/admin/x", target: "t" });
    await flush({ keepalive: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// F13: every non-http(s) scheme is reduced to the scheme.
describe("describeClickTarget schemes (F13)", () => {
  it.each([
    ["sms:+40700000000", "a sms:"],
    ["whatsapp://send?phone=1", "a whatsapp:"],
    ["javascript:void(0)", "a javascript:"],
  ])("reduces %s to its scheme", (href, out) => {
    expect(describeClickTarget({ tag: "a", href })).toBe(out);
  });
});

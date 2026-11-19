import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, reset, state, userSession } from "../helpers";
import { encodeFeedCursor } from "@/lib/feed-params";

// Approach: @/data/trips is mocked so we can assert exactly what the handlers pass to the data layer
// (excludeOrganizerId); @/lib/auth uses the shared fake session from helpers.
const getFeed = vi.fn();
const getTripsSince = vi.fn();
const getActiveCities = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
vi.mock("@/data/trips", () => ({
  FEED_PAGE_SIZE: 20,
  getFeed: (...a: unknown[]) => getFeed(...a),
  getTripsSince: (...a: unknown[]) => getTripsSince(...a),
  getActiveCities: (...a: unknown[]) => getActiveCities(...a),
}));

const feed = await import("../../app/api/feed/route");
const feedSince = await import("../../app/api/feed/since/route");
const feedCities = await import("../../app/api/feed/cities/route");

type Handler = (req: Request) => Promise<Response>;
const GET_FEED = feed.GET as Handler;
const GET_SINCE = feedSince.GET as Handler;
const GET_CITIES = feedCities.GET as Handler;

const SINCE = "/api/feed/since?since=2026-01-01T00:00:00.000Z";
const trip = { id: "t1", city: "Lisbon", organizerName: "Ana P.", organizerImage: null };

beforeEach(() => {
  reset();
  getFeed.mockReset().mockResolvedValue({ trips: [trip], nextCursor: null, now: "2026-11-19T10:00:00.000Z" });
  getTripsSince.mockReset().mockResolvedValue([trip]);
  getActiveCities.mockReset().mockResolvedValue(["Lisbon"]);
});

// getTripsSince/getActiveCities argument shapes are not fixed by the plan, so look at the serialized call.
const calls = (fn: typeof getFeed) => JSON.stringify(fn.mock.calls);

describe("without a session", () => {
  it("GET /api/feed is public: 200 and no exclusion", async () => {
    const res = await GET_FEED(new Request("http://app.test/api/feed"));
    expect(res.status).toBe(200);
    expect(getFeed).toHaveBeenCalledTimes(1);
    expect(getFeed.mock.calls[0][0]).toMatchObject({ excludeOrganizerId: undefined });
    const body = await res.json();
    expect(body).toMatchObject({ trips: [{ id: "t1" }], nextCursor: null });
    expect(typeof body.now).toBe("string");
  });

  it("GET /api/feed/since is public: 200 and no exclusion", async () => {
    const res = await GET_SINCE(new Request(`http://app.test${SINCE}`));
    expect(res.status).toBe(200);
    expect(getTripsSince).toHaveBeenCalledTimes(1);
    expect(calls(getTripsSince)).not.toContain("excludeOrganizerId\":\"");
    const body = await res.json();
    expect(body.trips).toHaveLength(1);
    expect(typeof body.now).toBe("string");
  });

  it("GET /api/feed/cities is public: 200 and no exclusion", async () => {
    const res = await GET_CITIES(new Request("http://app.test/api/feed/cities"));
    expect(res.status).toBe(200);
    expect(calls(getActiveCities)).not.toContain("excludeOrganizerId\":\"");
    expect(await res.json()).toEqual({ cities: ["Lisbon"] });
  });
});

describe("with a user session", () => {
  beforeEach(() => {
    state.session = userSession("user-7");
  });

  it("GET /api/feed excludes the caller's trips", async () => {
    const res = await GET_FEED(get("/api/feed"));
    expect(res.status).toBe(200);
    expect(getFeed.mock.calls[0][0]).toMatchObject({ excludeOrganizerId: "user-7" });
  });

  it("GET /api/feed/since excludes the caller's trips", async () => {
    const res = await GET_SINCE(get(SINCE));
    expect(res.status).toBe(200);
    expect(calls(getTripsSince)).toContain('"excludeOrganizerId":"user-7"');
  });

  it("GET /api/feed/cities excludes the caller's trips", async () => {
    const res = await GET_CITIES(get("/api/feed/cities"));
    expect(res.status).toBe(200);
    expect(calls(getActiveCities)).toContain('"excludeOrganizerId":"user-7"');
  });

  it("never puts the caller's email in the response", async () => {
    const res = await GET_FEED(get("/api/feed"));
    expect(JSON.stringify(await res.json())).not.toContain("@");
  });
});

// Assumed shape: the data layer gets `viewer: { id, gender }` next to excludeOrganizerId (first arg of getFeed,
// the scope argument of getTripsSince), and ONLY when there is a session.
describe("viewer for the join state", () => {
  const sessionWith = (id: string, role: "user" | "admin", gender: unknown) => {
    const s = userSession(id);
    state.session = { ...s!, user: { ...s!.user, role, gender } };
  };

  it("GET /api/feed passes no viewer without a session", async () => {
    await GET_FEED(new Request("http://app.test/api/feed"));
    expect(getFeed.mock.calls[0][0].viewer).toBeUndefined();
  });

  it("GET /api/feed/since passes no viewer without a session", async () => {
    await GET_SINCE(new Request(`http://app.test${SINCE}`));
    expect(calls(getTripsSince)).not.toContain("viewer");
  });

  it("GET /api/feed passes the session user's id and gender", async () => {
    sessionWith("user-7", "user", "female");
    await GET_FEED(get("/api/feed"));
    expect(getFeed.mock.calls[0][0]).toMatchObject({ viewer: { id: "user-7", gender: "female" } });
  });

  it("GET /api/feed/since passes the session user's id and gender", async () => {
    sessionWith("user-7", "user", "male");
    await GET_SINCE(get(SINCE));
    expect(calls(getTripsSince)).toContain('"viewer":{"id":"user-7","gender":"male"}');
  });

  it("passes a null gender as null", async () => {
    sessionWith("user-7", "user", null);
    await GET_FEED(get("/api/feed"));
    expect(getFeed.mock.calls[0][0]).toMatchObject({ viewer: { id: "user-7", gender: null } });
  });

  it("an admin session also gets a viewer", async () => {
    sessionWith("admin-1", "admin", "male");
    await GET_FEED(get("/api/feed"));
    expect(getFeed.mock.calls[0][0]).toMatchObject({ viewer: { id: "admin-1", gender: "male" } });
  });

  it("the cities endpoint does not need a viewer", async () => {
    sessionWith("user-7", "user", "female");
    await GET_CITIES(get("/api/feed/cities"));
    expect(calls(getActiveCities)).not.toContain("viewer");
  });
});

// Regression: responses depend on the optional session, so no shared cache may store them.
describe("cache headers", () => {
  it("GET /api/feed sends Cache-Control: private, no-store", async () => {
    const res = await GET_FEED(new Request("http://app.test/api/feed"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("GET /api/feed/since sends Cache-Control: private, no-store", async () => {
    const res = await GET_SINCE(new Request(`http://app.test${SINCE}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("GET /api/feed/cities sends Cache-Control: private, no-store", async () => {
    const res = await GET_CITIES(new Request("http://app.test/api/feed/cities"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("query validation", () => {
  it("passes a valid cursor and city to getFeed", async () => {
    const cursor = encodeFeedCursor("2026-11-19T10:20:30.123456", "3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b");
    const res = await GET_FEED(new Request(`http://app.test/api/feed?city=Lisbon&cursor=${encodeURIComponent(cursor)}`));
    expect(res.status).toBe(200);
    expect(getFeed.mock.calls[0][0]).toMatchObject({ city: "Lisbon" });
    expect(getFeed.mock.calls[0][0].cursor).toBeTruthy();
  });

  it.each(["garbage", "2026-11-19|3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b", "2026-11-19T10:20:30.123456|x"])(
    "GET /api/feed rejects the bad cursor %s with 400",
    async (cursor) => {
      const res = await GET_FEED(new Request(`http://app.test/api/feed?cursor=${encodeURIComponent(cursor)}`));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
      expect(getFeed).not.toHaveBeenCalled();
    },
  );

  it("GET /api/feed rejects a city over 100 characters with 400", async () => {
    const res = await GET_FEED(new Request(`http://app.test/api/feed?city=${"a".repeat(101)}`));
    expect(res.status).toBe(400);
    expect(getFeed).not.toHaveBeenCalled();
  });

  it("GET /api/feed/since rejects a bad date with 400", async () => {
    const res = await GET_SINCE(new Request("http://app.test/api/feed/since?since=not-a-date"));
    expect(res.status).toBe(400);
    expect(getTripsSince).not.toHaveBeenCalled();
  });

  it("GET /api/feed/since rejects a missing since with 400", async () => {
    const res = await GET_SINCE(new Request("http://app.test/api/feed/since"));
    expect(res.status).toBe(400);
    expect(getTripsSince).not.toHaveBeenCalled();
  });

  it("GET /api/feed/since rejects a city over 100 characters with 400", async () => {
    const res = await GET_SINCE(new Request(`http://app.test${SINCE}&city=${"a".repeat(101)}`));
    expect(res.status).toBe(400);
    expect(getTripsSince).not.toHaveBeenCalled();
  });
});

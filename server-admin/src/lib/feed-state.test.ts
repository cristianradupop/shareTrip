import { describe, expect, it } from "vitest";
import type { FeedTrip } from "server-app/shared";
import { feedQuery, feedReducer, mergeTrips, type FeedState } from "./feed-state";

const t = (id: string): FeedTrip =>
  ({
    id,
    city: "Lisbon",
    country: "Portugal",
    departureDate: "2027-03-05",
    returnDate: null,
    budget: "500",
    currency: "EUR",
    transport: "plane",
    gender: "mixed",
    theme: "x",
    maxTravelers: 4,
    createdAt: "2026-11-19T10:00:00.000Z",
    joined: 0,
    organizerName: "Ana P.",
    organizerImage: null,
    status: "active",
  }) satisfies FeedTrip;
const ids = (xs: FeedTrip[]) => xs.map((x) => x.id);

describe("feedQuery", () => {
  const parse = (q: string) => new URLSearchParams(q.replace(/^\?/, ""));

  it("is empty with no params", () => {
    expect(parse(feedQuery({})).toString()).toBe("");
  });

  it("includes only the given params", () => {
    const p = parse(feedQuery({ city: "Rome", cursor: "c1" }));
    expect(p.get("city")).toBe("Rome");
    expect(p.get("cursor")).toBe("c1");
    expect(p.has("since")).toBe(false);
  });

  it("skips empty and undefined values", () => {
    const p = parse(feedQuery({ city: "", cursor: undefined, since: "2026-01-01T00:00:00.000Z" }));
    expect(p.has("city")).toBe(false);
    expect(p.has("cursor")).toBe(false);
    expect(p.get("since")).toBe("2026-01-01T00:00:00.000Z");
  });

  it("encodes special characters so they round-trip", () => {
    expect(parse(feedQuery({ city: "São Paulo & Co" })).get("city")).toBe("São Paulo & Co");
  });
});

describe("mergeTrips", () => {
  it("appends new trips after the existing ones", () => {
    expect(ids(mergeTrips([t("a"), t("b")], [t("c"), t("d")], "append"))).toEqual(["a", "b", "c", "d"]);
  });

  it("prepends new trips before the existing ones", () => {
    expect(ids(mergeTrips([t("a"), t("b")], [t("c"), t("d")], "prepend"))).toEqual(["c", "d", "a", "b"]);
  });

  it("drops incoming trips whose id already exists, keeping the existing one", () => {
    expect(ids(mergeTrips([t("a"), t("b")], [t("b"), t("c")], "append"))).toEqual(["a", "b", "c"]);
    expect(ids(mergeTrips([t("a"), t("b")], [t("b"), t("c")], "prepend"))).toEqual(["c", "a", "b"]);
  });

  it("does not mutate its inputs", () => {
    const existing = [t("a")];
    mergeTrips(existing, [t("b")], "append");
    expect(ids(existing)).toEqual(["a"]);
  });
});

// Contract assumed: FeedState has (at least) trips, cursor, done, gen, city, since, error.
const state = (o: Partial<FeedState> = {}): FeedState =>
  ({ trips: [t("a")], cursor: "c1", done: false, gen: 0, city: undefined, since: "2026-11-19T09:00:00.000Z", error: false, ...o }) as FeedState;

describe("feedReducer reset", () => {
  it("sets the city, clears the list and cursor, bumps gen, clears error and done", () => {
    const s = feedReducer(state({ gen: 3, done: true, error: true }), { type: "reset", city: "Rome" });
    expect(s.city).toBe("Rome");
    expect(s.trips).toEqual([]);
    expect(s.cursor).toBeNull();
    expect(s.gen).toBe(4);
    expect(s.done).toBe(false);
    expect(s.error).toBe(false);
  });

  it("accepts undefined to clear the city filter", () => {
    expect(feedReducer(state({ city: "Rome" }), { type: "reset", city: undefined }).city).toBeUndefined();
  });
});

describe("feedReducer pageLoaded", () => {
  it("appends the page and stores the next cursor", () => {
    const s = feedReducer(state({ gen: 2 }), { type: "pageLoaded", gen: 2, page: { trips: [t("b")], nextCursor: "c2" } });
    expect(ids(s.trips)).toEqual(["a", "b"]);
    expect(s.cursor).toBe("c2");
    expect(s.done).toBe(false);
  });

  it("is done when nextCursor is null", () => {
    const s = feedReducer(state({ gen: 2 }), { type: "pageLoaded", gen: 2, page: { trips: [t("b")], nextCursor: null } });
    expect(s.done).toBe(true);
    expect(s.cursor).toBeNull();
  });

  it("does not duplicate a trip that is already listed", () => {
    const s = feedReducer(state({ gen: 2 }), { type: "pageLoaded", gen: 2, page: { trips: [t("a"), t("b")], nextCursor: null } });
    expect(ids(s.trips)).toEqual(["a", "b"]);
  });

  it("ignores a page from a stale generation", () => {
    const before = state({ gen: 2 });
    const s = feedReducer(before, { type: "pageLoaded", gen: 1, page: { trips: [t("z")], nextCursor: null } });
    expect(ids(s.trips)).toEqual(["a"]);
    expect(s.cursor).toBe("c1");
    expect(s.done).toBe(false);
  });

  it("clears a previous error", () => {
    const s = feedReducer(state({ gen: 2, error: true }), { type: "pageLoaded", gen: 2, page: { trips: [], nextCursor: null } });
    expect(s.error).toBe(false);
  });

  it("takes since from page.now when the server sends it", () => {
    const s = feedReducer(state({ gen: 2, trips: [] }), {
      type: "pageLoaded",
      gen: 2,
      page: { trips: [t("b")], nextCursor: null, now: "2026-11-19T12:00:00.000Z" },
    });
    expect(s.since).toBe("2026-11-19T12:00:00.000Z");
  });

  it("leaves since unchanged for a later page (state already has trips)", () => {
    const s = feedReducer(state({ gen: 2 }), {
      type: "pageLoaded",
      gen: 2,
      page: { trips: [t("b")], nextCursor: "c2", now: "2026-11-19T12:00:00.000Z" },
    });
    expect(ids(s.trips)).toEqual(["a", "b"]);
    expect(s.since).toBe("2026-11-19T09:00:00.000Z");
  });
});

describe("feedReducer refreshed", () => {
  it("prepends new trips without duplicates and moves since to now", () => {
    const s = feedReducer(state({ gen: 2 }), { type: "refreshed", gen: 2, trips: [t("n"), t("a")], now: "2026-11-19T12:00:00.000Z" });
    expect(ids(s.trips)).toEqual(["n", "a"]);
    expect(s.since).toBe("2026-11-19T12:00:00.000Z");
    expect(s.cursor).toBe("c1");
  });

  it("ignores a refresh from a stale generation", () => {
    const before = state({ gen: 2 });
    const s = feedReducer(before, { type: "refreshed", gen: 1, trips: [t("n")], now: "2026-11-19T12:00:00.000Z" });
    expect(s).toEqual(before);
    expect(ids(s.trips)).toEqual(["a"]);
    expect(s.since).toBe("2026-11-19T09:00:00.000Z");
  });
});

// Contract assumed: { type: "tripPatched"; id: string; patch: Partial<FeedTrip> }
describe("feedReducer tripPatched", () => {
  const patch = { viewerState: "requested", joined: 2 } as unknown as Partial<FeedTrip>;
  const patched = (id: string) => ({ type: "tripPatched", id, patch }) as unknown as Parameters<typeof feedReducer>[1];

  it("merges the patch into that trip only", () => {
    const s = feedReducer(state({ trips: [t("a"), t("b")] }), patched("b"));
    expect(s.trips[1]).toMatchObject({ id: "b", city: "Lisbon", joined: 2, viewerState: "requested" });
    expect(s.trips[0]).toEqual(t("a"));
    expect(ids(s.trips)).toEqual(["a", "b"]);
  });

  it("leaves since, cursor, gen, done and error unchanged", () => {
    const before = state({ trips: [t("a")], gen: 5, done: true, error: true, cursor: "c9" });
    const s = feedReducer(before, patched("a"));
    expect(s.since).toBe(before.since);
    expect(s.cursor).toBe("c9");
    expect(s.gen).toBe(5);
    expect(s.done).toBe(true);
    expect(s.error).toBe(true);
    expect(s.city).toBe(before.city);
  });

  it("leaves the state unchanged for an unknown id", () => {
    const before = state({ trips: [t("a")] });
    expect(feedReducer(before, patched("zzz"))).toEqual(before);
  });

  it("does not mutate the previous state", () => {
    const before = state({ trips: [t("a")] });
    feedReducer(before, patched("a"));
    expect(before.trips[0]).toEqual(t("a"));
  });
});

describe("feedReducer failed", () => {
  it("sets error for the current generation", () => {
    expect(feedReducer(state({ gen: 2 }), { type: "failed", gen: 2 }).error).toBe(true);
  });

  it("ignores a stale generation", () => {
    expect(feedReducer(state({ gen: 2 }), { type: "failed", gen: 1 }).error).toBe(false);
  });
});

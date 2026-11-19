import { beforeEach, describe, expect, it, vi } from "vitest";

// Audit events written by the data layer. The shared fake in test/helpers.ts returns the same rows for every
// query, but approve needs a trip row and a request row with different `status`, so this file has its own db
// fake: queued results per kind of query (select / update / delete), writes recorded per table.
const q = vi.hoisted(() => ({
  select: [] as unknown[][],
  update: [] as unknown[][],
  delete: [] as unknown[][],
  inserts: [] as { table: unknown; values: unknown }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => {
  const chain = (next: () => unknown[], onValues?: (v: unknown) => void): unknown => {
    const p: unknown = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(next()).then(res, rej);
        if (prop === "values") return (v: unknown) => (onValues?.(v), p);
        return () => p;
      },
      apply: () => p,
    });
    return p;
  };
  const tx = {
    select: () => chain(() => q.select.shift() ?? []),
    update: () => chain(() => q.update.shift() ?? []),
    delete: () => chain(() => q.delete.shift() ?? []),
    insert: (table: unknown) => chain(() => [], (values) => q.inserts.push({ table, values })),
  };
  return { db: { ...tx, transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } };
});

const { auditEvents, tripRequests } = await import("@/db/schema");
const { approveRequest, createJoinRequest, declineRequest, leaveTrip, withdrawRequest } = await import("./requests");

const ACTOR = { id: "org-1", name: "Olga Organizer", role: "user" as const };
const TRIP = "3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b";
const TRIP_SUBJECT = { id: TRIP, destinationCity: "Lisbon", destinationCountry: "Portugal" };

const events = () => q.inserts.filter((i) => i.table === auditEvents).map((i) => i.values as Record<string, unknown>);
const base = {
  actorId: "org-1",
  actorRole: "user",
  actorName: "Olga Organizer",
  subjectType: "trip",
  subjectId: TRIP,
  subjectLabel: "Lisbon, Portugal",
};

beforeEach(() => {
  q.select.length = q.update.length = q.delete.length = q.inserts.length = 0;
});

describe("createJoinRequest event", () => {
  it("inserts the request and a trip.requested event for the trip", async () => {
    q.select.push([TRIP_SUBJECT]);
    expect(await createJoinRequest(TRIP, "u-1", { ...ACTOR, id: "u-1", name: "Una" })).toEqual({ ok: true });
    expect(q.inserts.some((i) => i.table === tripRequests)).toBe(true);
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ ...base, action: "trip.requested", category: "trip", actorId: "u-1", actorName: "Una" });
  });
});

describe("withdrawRequest event", () => {
  it("logs trip.withdrawn when a pending request was deleted", async () => {
    q.delete.push([{ userId: "u-1" }]);
    q.select.push([TRIP_SUBJECT]);
    expect(await withdrawRequest(TRIP, "u-1", ACTOR)).toBe(true);
    expect(events()[0]).toMatchObject({ ...base, action: "trip.withdrawn" });
  });

  it("logs nothing when no pending request matched", async () => {
    q.delete.push([]);
    expect(await withdrawRequest(TRIP, "u-1", ACTOR)).toBe(false);
    expect(events()).toHaveLength(0);
  });
});

describe("leaveTrip event", () => {
  it("logs trip.left when a member row was removed", async () => {
    q.delete.push([{ userId: "u-1" }], []);
    q.select.push([TRIP_SUBJECT]);
    await leaveTrip(TRIP, "u-1", ACTOR);
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({ ...base, action: "trip.left" });
  });

  it("logs nothing when there was no member row", async () => {
    q.delete.push([], []);
    await leaveTrip(TRIP, "u-1", ACTOR);
    expect(events()).toHaveLength(0);
  });
});

describe("approveRequest event", () => {
  const trip = (over: object = {}) => ({
    organizerId: "org-1",
    destinationCity: "Lisbon",
    destinationCountry: "Portugal",
    status: "active",
    departureDate: "2099-01-01",
    maxTravelers: 5,
    tripGender: "mixed",
    ...over,
  });
  const request = { status: "pending", gender: "female", name: "Ana Barbu" };

  it("logs trip.approved with autoDeclined 0 and the applicant as related", async () => {
    q.select.push([trip()], [request], [{ joined: 1 }]);
    q.update.push([{ userId: "app-1" }]);
    expect(await approveRequest(TRIP, "app-1", "2026-11-19", ACTOR)).toEqual({ ok: true, autoDeclined: 0 });
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({
      ...base,
      action: "trip.approved",
      autoDeclined: 0,
      relatedId: "app-1",
      relatedLabel: "Ana Barbu",
    });
  });

  it("records how many pending requests were auto-declined when the last seat is taken", async () => {
    // The organizer holds a seat: max 3 with 1 joined leaves one seat, and approving fills it.
    q.select.push([trip({ maxTravelers: 3 })], [request], [{ joined: 1 }]);
    q.update.push([{ userId: "app-1" }], [{ userId: "x" }, { userId: "y" }]);
    expect(await approveRequest(TRIP, "app-1", "2026-11-19", ACTOR)).toEqual({ ok: true, autoDeclined: 2 });
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({ action: "trip.approved", autoDeclined: 2, relatedId: "app-1" });
  });

  it.each([
    ["the trip is missing", [[]], 404],
    ["the request is missing", [[trip()], []], 404],
    ["the request was already decided", [[trip()], [{ ...request, status: "approved" }]], 409],
    ["the trip is full", [[trip()], [request], [{ joined: 5 }]], 409],
  ])("logs nothing when %s", async (_n, selects, status) => {
    q.select.push(...(selects as unknown[][]));
    const res = await approveRequest(TRIP, "app-1", "2026-11-19", ACTOR);
    expect(res).toMatchObject({ ok: false, status });
    expect(events()).toHaveLength(0);
  });
});

describe("declineRequest event", () => {
  it("logs trip.declined with the applicant as related", async () => {
    q.update.push([{ userId: "app-1" }]);
    q.select.push([{ name: "Ana Barbu" }], [TRIP_SUBJECT]);
    expect(await declineRequest(TRIP, "app-1", ACTOR)).toBe(true);
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ ...base, action: "trip.declined", relatedId: "app-1", relatedLabel: "Ana Barbu" });
  });

  it("logs nothing when no pending request matched", async () => {
    q.update.push([]);
    expect(await declineRequest(TRIP, "app-1", ACTOR)).toBe(false);
    expect(events()).toHaveLength(0);
  });
});

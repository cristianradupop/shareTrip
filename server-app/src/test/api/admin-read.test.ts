import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminSession, get, reset, state, userSession } from "../helpers";

// Admin read API. @/data/admin and @/data/audit are mocked, so these pin what the handlers ask and answer.
// Assumed signatures (plan leaves the shapes open):
//   getAdminStats(): Promise<AdminStats>
//   listAllTrips({ q?: string; status?: "active" | "full" | "cancelled"; page: number }): Promise<{ trips: AdminTripRow[]; total: number; page: number; pageSize: number }>
//     (same shape idea as listUsers; the handler returns it as is)
//   listEvents(view: "account" | "activity" | "audit"): Promise<AuditEventRow[]>
// Responses: stats -> the AdminStats object itself; trips -> what listAllTrips returns; events -> { events: AuditEventRow[] }.
const data = vi.hoisted(() => ({
  getAdminStats: vi.fn(),
  listAllTrips: vi.fn(),
  listEvents: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
vi.mock("@/data/admin", () => ({ getAdminStats: data.getAdminStats, listAllTrips: data.listAllTrips }));
vi.mock("@/data/audit", () => ({ listEvents: data.listEvents }));

const stats = await import("../../app/api/admin/stats/route");
const adminTrips = await import("../../app/api/admin/trips/route");
const eventsRoute = await import("../../app/api/admin/events/route");

type Handler = (req: Request) => Promise<Response>;

const STATS = {
  users: { total: 10, active: 8, banned: 2, admins: 1, last7Days: 3, last30Days: 6 },
  trips: { active: 4, full: 1, cancelled: 2, upcoming: 4, departed: 1 },
  requests: { pending: 5, approved: 7, declined: 2 },
  members: 12,
};
const TRIPS = { trips: [{ id: "t1", city: "Lisbon" }], total: 1, page: 1, pageSize: 10 };
const EVENTS = [{ id: "e1", action: "trip.created", category: "trip" }];

beforeEach(() => {
  reset();
  for (const fn of Object.values(data)) fn.mockReset();
  data.getAdminStats.mockResolvedValue(STATS);
  data.listAllTrips.mockResolvedValue(TRIPS);
  data.listEvents.mockResolvedValue(EVENTS);
  state.session = adminSession();
});

describe("GET /api/admin/stats", () => {
  it("returns the stats for an admin", async () => {
    const res = await (stats.GET as Handler)(get("/api/admin/stats"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(STATS);
  });

  it.each([
    ["no session", () => null, 401],
    ["a non-admin", () => userSession(), 403],
  ])("%s: %i and the data layer is not touched", async (_n, sess, status) => {
    state.session = sess();
    expect((await (stats.GET as Handler)(get("/api/admin/stats"))).status).toBe(status);
    expect(data.getAdminStats).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/trips", () => {
  const list = (qs = "") => (adminTrips.GET as Handler)(get(`/api/admin/trips${qs}`));

  it("returns what listAllTrips returns", async () => {
    const res = await list("?page=1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(TRIPS);
  });

  it("passes q, status and page through", async () => {
    await list("?q=lisbon&status=full&page=3");
    expect(data.listAllTrips).toHaveBeenCalledWith({ q: "lisbon", status: "full", page: 3 });
  });

  it("defaults the page to 1, clamps a huge page and drops an unknown status", async () => {
    await list("?status=bogus");
    expect(data.listAllTrips).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: undefined }));
    await list("?page=99999999999");
    expect(data.listAllTrips.mock.calls.at(-1)![0].page).toBeLessThanOrEqual(10_000);
  });

  it("401 without a session, 403 for a non-admin", async () => {
    state.session = null;
    expect((await list()).status).toBe(401);
    state.session = userSession();
    expect((await list()).status).toBe(403);
    expect(data.listAllTrips).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/events", () => {
  const list = (qs: string) => (eventsRoute.GET as Handler)(get(`/api/admin/events${qs}`));

  it.each(["account", "activity", "audit"])("view=%s returns { events } from listEvents(view)", async (view) => {
    const res = await list(`?view=${view}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: EVENTS });
    expect(data.listEvents).toHaveBeenCalledWith(view);
  });

  it.each(["", "?view=", "?view=bogus", "?view=ACCOUNT", "?view=account,audit", "?other=1"])(
    "400 for %j and nothing is read",
    async (qs) => {
      const res = await list(qs);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
      expect(data.listEvents).not.toHaveBeenCalled();
    },
  );

  it("401 without a session, 403 for a non-admin (before the view is checked)", async () => {
    state.session = null;
    expect((await list("?view=bogus")).status).toBe(401);
    state.session = userSession();
    expect((await list("?view=bogus")).status).toBe(403);
    expect(data.listEvents).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminSession, ctx, get, reset, send, state, userSession } from "../helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());

const session = await import("../../app/api/session/route");
const trips = await import("../../app/api/trips/route");
const trip = await import("../../app/api/trips/[id]/route");
const orgTrips = await import("../../app/api/organizer/trips/route");
const orgStats = await import("../../app/api/organizer/stats/route");
const feed = await import("../../app/api/feed/route");
const feedSince = await import("../../app/api/feed/since/route");
const feedCities = await import("../../app/api/feed/cities/route");
const adminUsers = await import("../../app/api/admin/users/route");
const adminUser = await import("../../app/api/admin/users/[id]/route");
const adminBan = await import("../../app/api/admin/users/[id]/ban/route");

type Handler = (req: Request, c?: unknown) => Promise<Response>;
type Endpoint = { name: string; call: () => Promise<Response> };

const validTrip = () => {
  const d = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  return {
    destinationCity: "Lisbon",
    destinationCountry: "Portugal",
    departureDate: d,
    maxTravelers: 4,
    gender: "mixed",
    budgetEstimate: 500,
    currency: "EUR",
    transport: "plane",
    theme: "Surfing and pastel de nata",
  };
};

const userEndpoints: Endpoint[] = [
  { name: "POST /api/trips", call: () => (trips.POST as Handler)(send("POST", "/api/trips", validTrip())) },
  {
    name: "PATCH /api/trips/[id]",
    call: () =>
      (trip.PATCH as Handler)(
        send("PATCH", "/api/trips/3f2b8a52-6c1d-4e0a-9d6b-0a1b2c3d4e5f", validTrip()),
        ctx("3f2b8a52-6c1d-4e0a-9d6b-0a1b2c3d4e5f"),
      ),
  },
  { name: "GET /api/organizer/trips", call: () => (orgTrips.GET as Handler)(get("/api/organizer/trips?limit=5")) },
  { name: "GET /api/organizer/stats", call: () => (orgStats.GET as Handler)(get("/api/organizer/stats")) },
  { name: "GET /api/feed", call: () => (feed.GET as Handler)(get("/api/feed?sort=asc")) },
  {
    name: "GET /api/feed/since",
    call: () => (feedSince.GET as Handler)(get("/api/feed/since?since=2026-01-01T00:00:00.000Z")),
  },
  { name: "GET /api/feed/cities", call: () => (feedCities.GET as Handler)(get("/api/feed/cities")) },
];

const adminEndpoints: Endpoint[] = [
  { name: "GET /api/admin/users", call: () => (adminUsers.GET as Handler)(get("/api/admin/users?page=1")) },
  { name: "POST /api/admin/users", call: () => (adminUsers.POST as Handler)(send("POST", "/api/admin/users", {})) },
  {
    name: "PATCH /api/admin/users/[id]",
    call: () => (adminUser.PATCH as Handler)(send("PATCH", "/api/admin/users/u2", {}), ctx("u2")),
  },
  {
    name: "DELETE /api/admin/users/[id]",
    call: () => (adminUser.DELETE as Handler)(send("DELETE", "/api/admin/users/u2"), ctx("u2")),
  },
  {
    name: "POST /api/admin/users/[id]/ban",
    call: () => (adminBan.POST as Handler)(send("POST", "/api/admin/users/u2/ban", { banned: true }), ctx("u2")),
  },
];

beforeEach(reset);

describe("401 without a session", () => {
  it.each([...userEndpoints, ...adminEndpoints])("$name", async ({ call }) => {
    state.session = null;
    const res = await call();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
    expect(state.inserts).toHaveLength(0);
    expect(state.deletes).toHaveLength(0);
  });
});

describe("403 for a non-admin session on admin endpoints", () => {
  it.each(adminEndpoints)("$name", async ({ call }) => {
    state.session = userSession();
    const res = await call();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
    expect(state.deletes).toHaveLength(0);
  });
});

describe("GET /api/session", () => {
  it("returns { user: null } without a session", async () => {
    state.session = null;
    const res = await (session.GET as Handler)(new Request("http://app.test/api/session"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it("returns the user (and no secrets) with a session", async () => {
    state.session = userSession("u9");
    const res = await (session.GET as Handler)(get("/api/session"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.user).toMatchObject({ id: "u9", role: "user" });
    expect(JSON.stringify(body)).not.toMatch(/password|token/i);
  });
});

describe("POST /api/trips", () => {
  it("ignores a body organizerId and uses the session user id", async () => {
    state.session = userSession("real-user");
    const res = await (trips.POST as Handler)(send("POST", "/api/trips", { ...validTrip(), organizerId: "evil" }));
    expect(res.ok).toBe(true);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0].values).toMatchObject({ organizerId: "real-user" });
    expect(JSON.stringify(state.inserts[0].values)).not.toContain("evil");
  });

  it("returns 400 with the validation message for invalid trip data", async () => {
    state.session = userSession();
    const res = await (trips.POST as Handler)(send("POST", "/api/trips", { ...validTrip(), maxTravelers: 1 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "At least 2 travelers" });
    expect(state.inserts).toHaveLength(0);
  });
});

describe("admin self-protection", () => {
  it("DELETE own account returns 400", async () => {
    state.session = adminSession("admin-1");
    const res = await (adminUser.DELETE as Handler)(send("DELETE", "/api/admin/users/admin-1"), ctx("admin-1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "You cannot delete your own account" });
    expect(state.deletes).toHaveLength(0);
  });

  it("banning yourself returns 400", async () => {
    state.session = adminSession("admin-1");
    const res = await (adminBan.POST as Handler)(
      send("POST", "/api/admin/users/admin-1/ban", { banned: true }),
      ctx("admin-1"),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "You cannot ban yourself" });
    expect(state.updates).toHaveLength(0);
  });

  it("removing your own admin role returns 400", async () => {
    state.session = adminSession("admin-1");
    const body = {
      username: "admin.one",
      email: "admin1@test.dev",
      firstName: "Ada",
      lastName: "Min",
      phone: "+40721000111",
      address: "Cluj",
      birthDate: "1990-01-01",
      role: "user",
    };
    const res = await (adminUser.PATCH as Handler)(send("PATCH", "/api/admin/users/admin-1", body), ctx("admin-1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "You cannot remove your own admin role" });
    expect(state.updates).toHaveLength(0);
  });

  it("an admin can delete another user", async () => {
    state.session = adminSession("admin-1");
    const res = await (adminUser.DELETE as Handler)(send("DELETE", "/api/admin/users/u2"), ctx("u2"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.deletes).toHaveLength(1);
  });
});

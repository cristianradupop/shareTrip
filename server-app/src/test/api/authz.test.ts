import { beforeEach, describe, expect, it, vi } from "vitest";
import { user as userTable } from "@/db/schema";
import { adminSession, ctx, get, reset, send, state, userSession } from "../helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());

const session = await import("../../app/api/session/route");
const trips = await import("../../app/api/trips/route");
const orgTrips = await import("../../app/api/organizer/trips/route");
const orgStats = await import("../../app/api/organizer/stats/route");
const adminUsers = await import("../../app/api/admin/users/route");
const adminUser = await import("../../app/api/admin/users/[id]/route");
const adminBan = await import("../../app/api/admin/users/[id]/ban/route");
const profile = await import("../../app/api/profile/route");
const tripRequest = await import("../../app/api/trips/[id]/request/route");
const tripMembership = await import("../../app/api/trips/[id]/membership/route");
const orgRequests = await import("../../app/api/organizer/trips/[id]/requests/route");
const orgDecide = await import("../../app/api/organizer/trips/[id]/requests/[userId]/route");

const TRIP_ID = "3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b";
const tripCtx = () => ctx(TRIP_ID);
const decideCtx = () => ({ params: Promise.resolve({ id: TRIP_ID, userId: "applicant-1" }) });

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

// The feed endpoints are public reads with an optional session: see feed.test.ts.
const userEndpoints: Endpoint[] = [
  { name: "POST /api/trips", call: () => (trips.POST as Handler)(send("POST", "/api/trips", validTrip())) },
  { name: "GET /api/organizer/trips", call: () => (orgTrips.GET as Handler)(get("/api/organizer/trips?limit=5")) },
  { name: "GET /api/organizer/stats", call: () => (orgStats.GET as Handler)(get("/api/organizer/stats")) },
  { name: "PATCH /api/profile", call: () => (profile.PATCH as Handler)(send("PATCH", "/api/profile", { gender: "male" })) },
  {
    name: "POST /api/trips/[id]/request",
    call: () => (tripRequest.POST as Handler)(send("POST", `/api/trips/${TRIP_ID}/request`), tripCtx()),
  },
  {
    name: "DELETE /api/trips/[id]/request",
    call: () => (tripRequest.DELETE as Handler)(send("DELETE", `/api/trips/${TRIP_ID}/request`), tripCtx()),
  },
  {
    name: "DELETE /api/trips/[id]/membership",
    call: () => (tripMembership.DELETE as Handler)(send("DELETE", `/api/trips/${TRIP_ID}/membership`), tripCtx()),
  },
  {
    name: "GET /api/organizer/trips/[id]/requests",
    call: () => (orgRequests.GET as Handler)(get(`/api/organizer/trips/${TRIP_ID}/requests`), tripCtx()),
  },
  {
    name: "PATCH /api/organizer/trips/[id]/requests/[userId]",
    call: () =>
      (orgDecide.PATCH as Handler)(
        send("PATCH", `/api/organizer/trips/${TRIP_ID}/requests/applicant-1`, { action: "approve" }),
        decideCtx(),
      ),
  },
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

  it("includes the user's gender", async () => {
    const s = userSession("u9");
    state.session = { ...s!, user: { ...s!.user, gender: "female" } };
    const res = await (session.GET as Handler)(get("/api/session"));
    expect((await res.json()).user).toMatchObject({ id: "u9", gender: "female" });
  });
});

describe("PATCH /api/profile", () => {
  const patch = (body: unknown) => (profile.PATCH as Handler)(send("PATCH", "/api/profile", body));

  it("updates the caller's own row and answers ok", async () => {
    state.session = userSession("real-user");
    const res = await patch({ gender: "male", id: "evil-user" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    // The fake records the table once per chained call (.set, .where), so only check that the user table was written.
    expect(state.updates.length).toBeGreaterThan(0);
    expect(state.updates.every((t) => t === userTable)).toBe(true);
  });

  it.each([{ gender: "mixed" }, { gender: "robot" }, {}])("returns 400 for %j and writes nothing", async (body) => {
    state.session = userSession();
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
    expect(state.updates).toHaveLength(0);
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
      gender: "female",
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

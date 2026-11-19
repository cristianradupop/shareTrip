import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminSession, ctx, reset, send, state, userSession } from "../helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());

const route = await import("../../app/api/trips/[id]/route");

type Handler = (req: Request, c?: unknown) => Promise<Response>;
const PATCH = route.PATCH as Handler;

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
const ID = "3f2b8a52-6c1d-4e0a-9d6b-0a1b2c3d4e5f";

const body = (extra: object = {}) => ({
  destinationCity: "Mirissa",
  destinationCountry: "Sri Lanka",
  departureDate: iso(30),
  returnDate: iso(37),
  maxTravelers: 4,
  gender: "mixed",
  budgetEstimate: 900,
  currency: "EUR",
  transport: "plane",
  theme: "Whales, beaches and surf.",
  ...extra,
});
const row = (over: object = {}) => ({ id: ID, status: "active", departureDate: iso(30), joined: 0, ...over });
const call = (b: unknown = body(), id = ID) => PATCH(send("PATCH", `/api/trips/${id}`, b), ctx(id));

beforeEach(() => {
  reset();
  state.session = userSession("org-1");
  state.result = [row()];
});

describe("PATCH /api/trips/[id]", () => {
  it("returns 401 without a session", async () => {
    state.session = null;
    expect((await call()).status).toBe(401);
    expect(state.updates).toHaveLength(0);
  });

  it.each([
    ["user", () => userSession("other")],
    ["admin", () => adminSession("admin-1")],
  ])("returns 404 and writes nothing when no row matches (%s session)", async (_n, sess) => {
    state.session = sess();
    state.result = [];
    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
    expect(state.updates).toHaveLength(0);
  });

  it("returns 404 for a malformed id without writing", async () => {
    const res = await call(body(), "not-a-uuid");
    expect(res.status).toBe(404);
    expect(state.updates).toHaveLength(0);
  });

  it("returns 409 for a cancelled trip", async () => {
    state.result = [row({ status: "cancelled" })];
    expect((await call()).status).toBe(409);
    expect(state.updates).toHaveLength(0);
  });

  it("returns 409 for a trip whose departure has passed", async () => {
    state.result = [row({ departureDate: iso(-2) })];
    expect((await call()).status).toBe(409);
    expect(state.updates).toHaveLength(0);
  });

  it("returns 400 naming N when maxTravelers is below the joined count", async () => {
    state.result = [row({ joined: 3 })];
    const res = await call(body({ maxTravelers: 2 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("3");
    expect(state.updates).toHaveLength(0);
  });

  it("allows maxTravelers equal to the joined count", async () => {
    state.result = [row({ joined: 3 })];
    expect((await call(body({ maxTravelers: 3 }))).status).toBe(200);
  });

  it("returns the tripSchema message for an invalid body", async () => {
    const res = await call(body({ maxTravelers: 1 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "At least 2 travelers" });
    expect(state.updates).toHaveLength(0);
  });

  it("returns 200 { ok: true } for a valid edit", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.sets).toHaveLength(1);
  });

  it("never writes organizerId, status, id or createdAt, even if the body has them", async () => {
    await call(body({ organizerId: "evil", status: "cancelled", id: "x", createdAt: "2000-01-01" }));
    expect(state.sets).toHaveLength(1);
    const set = state.sets[0] as Record<string, unknown>;
    for (const k of ["organizerId", "status", "id", "createdAt"]) expect(set).not.toHaveProperty(k);
    expect(set).toMatchObject({ destinationCity: "Mirissa", maxTravelers: 4 });
    expect(JSON.stringify(set)).not.toContain("evil");
  });
});

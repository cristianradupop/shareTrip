import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditEvents } from "@/db/schema";
import { ctx, jpgFile, reset, sendForm, state, type TestSession } from "../helpers";

// Trip events written by POST /api/trips and PATCH /api/trips/[id] (data layer is real, db is the fake).
// The fake returns `state.result` for every select/returning, so `state.result = [row]` is both the id the
// insert returns and the "before" row the edit reads (select ... for update).
// The actor role is the capacity, not the account: an admin creating or editing a trip is logged as "user".

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  uploadTripPhoto: vi.fn(async () => ({ ok: true as const, url: "https://x.supabase.co/storage/v1/object/public/b/trips/p.jpg" })),
  deleteTripPhoto: vi.fn(async () => undefined),
}));

const trips = await import("../../app/api/trips/route");
const tripById = await import("../../app/api/trips/[id]/route");

type Handler = (req: Request, c?: unknown) => Promise<Response>;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
const ID = "3f2b8a52-6c1d-4e0a-9d6b-0a1b2c3d4e5f";

const sessionFor = (id: string, role: "user" | "admin", name: string): TestSession => ({
  user: { id, role, name, email: `${id}@test.dev` },
  session: { id: "s1" },
});

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
// The stored row matching body().
const stored = (over: object = {}) => ({
  id: ID,
  organizerId: "org-1",
  status: "active",
  destinationCity: "Mirissa",
  destinationCountry: "Sri Lanka",
  departureDate: iso(30),
  returnDate: iso(37),
  maxTravelers: 4,
  gender: "mixed",
  budgetEstimate: "900.00",
  currency: "EUR",
  transport: "plane",
  theme: "Whales, beaches and surf.",
  joined: 0,
  ...over,
});

const events = () => state.inserts.filter((i) => i.table === auditEvents).map((i) => i.values as Record<string, unknown>);

beforeEach(() => {
  reset();
  state.session = sessionFor("org-1", "user", "Olga Organizer");
});

describe("POST /api/trips event", () => {
  const create = (b: unknown = body()) => (trips.POST as Handler)(sendForm("POST", "/api/trips", b as Record<string, unknown>, jpgFile()));

  it("logs trip.created with the trip snapshot and the organizer as actor", async () => {
    state.result = [{ id: "trip-9" }];
    const res = await create();
    expect(res.status).toBe(200);
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({
      action: "trip.created",
      actorId: "org-1",
      actorRole: "user",
      actorName: "Olga Organizer",
      subjectType: "trip",
      subjectId: "trip-9",
      subjectLabel: "Mirissa, Sri Lanka",
    });
  });

  it("logs an admin account creating a trip as 'user'", async () => {
    state.session = sessionFor("admin-1", "admin", "Ada Admin");
    await create();
    expect(events()[0]).toMatchObject({ actorId: "admin-1", actorRole: "user" });
  });

  it("writes no event when the data is invalid", async () => {
    expect((await create(body({ maxTravelers: 1 }))).status).toBe(400);
    expect(events()).toHaveLength(0);
  });
});

describe("PATCH /api/trips/[id] event", () => {
  const edit = (b: unknown = body()) => (tripById.PATCH as Handler)(sendForm("PATCH", `/api/trips/${ID}`, b as Record<string, unknown>), ctx(ID));

  beforeEach(() => {
    state.result = [stored()];
  });

  it("logs trip.edited with the changed field names only", async () => {
    const res = await edit(body({ budgetEstimate: 950, theme: "Whales only." }));
    expect(res.status).toBe(200);
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({
      action: "trip.edited",
      actorId: "org-1",
      actorRole: "user",
      actorName: "Olga Organizer",
      subjectType: "trip",
      subjectId: ID,
      subjectLabel: "Mirissa, Sri Lanka",
    });
    expect([...(evs[0].changedFields as string[])].sort()).toEqual(["budgetEstimate", "theme"]);
    const json = JSON.stringify(evs[0]);
    expect(json).not.toContain("950");
    expect(json).not.toContain("Whales only.");
  });

  it("compares normalised values: 900 vs '900.00' and an empty returnDate vs null are not changes", async () => {
    state.result = [stored({ returnDate: null })];
    await edit(body({ returnDate: "" }));
    expect(events()).toHaveLength(0);
  });

  it("writes no event when nothing changed", async () => {
    expect((await edit()).status).toBe(200);
    expect(events()).toHaveLength(0);
  });

  it("writes no event when the trip is not found", async () => {
    state.result = [];
    expect((await edit(body({ theme: "Other theme." }))).status).toBe(404);
    expect(events()).toHaveLength(0);
  });
});

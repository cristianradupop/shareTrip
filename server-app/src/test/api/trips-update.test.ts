import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { auditEvents } from "@/db/schema";
import { adminSession, ctx, jpgFile, reset, sendForm, state, userSession } from "../helpers";

const sb = vi.hoisted(() => ({
  upload: vi.fn(async (_path: string, _bytes: Uint8Array, _opts?: unknown) => ({ error: null as unknown })),
  remove: vi.fn(async (_paths: string[]) => ({ error: null as unknown })),
}));
// Lets one test make the (otherwise real) data-layer update report "no row".
const upd = vi.hoisted(() => ({ forceNull: false }));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
vi.mock("@/data/trips", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/trips")>();
  return {
    ...actual,
    updateOrganizerTrip: (...args: Parameters<typeof actual.updateOrganizerTrip>) =>
      upd.forceNull ? Promise.resolve(null) : actual.updateOrganizerTrip(...args),
  };
});
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: sb.upload,
        remove: sb.remove,
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://abc.supabase.co/storage/v1/object/public/${bucket}/${path}` },
        }),
      }),
    },
  }),
}));

const route = await import("../../app/api/trips/[id]/route");

type Handler = (req: Request, c?: unknown) => Promise<Response>;
const PATCH = route.PATCH as Handler;
const { PHOTO_MAX_BYTES } = await import("@/lib/validators");

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
const call = (b: unknown = body(), id = ID, photo?: File) =>
  PATCH(sendForm("PATCH", `/api/trips/${id}`, b as Record<string, unknown>, photo), ctx(id));
const BASE = "https://abc.supabase.co/storage/v1/object/public/profile-photos";
const events = () => state.inserts.filter((i) => i.table === auditEvents).map((i) => i.values as Record<string, unknown>);

beforeEach(() => {
  reset();
  state.session = userSession("org-1");
  state.result = [row()];
  upd.forceNull = false;
  sb.upload.mockClear();
  sb.remove.mockClear();
  sb.upload.mockResolvedValue({ error: null });
  sb.remove.mockResolvedValue({ error: null });
  vi.stubEnv("SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "secret");
});

afterEach(() => vi.restoreAllMocks());

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

describe("PATCH /api/trips/[id] photo", () => {
  const OLD = `${BASE}/trips/old.jpg`;

  it("keeps the photo when none is sent: photoUrl is absent from the update", async () => {
    state.result = [row({ photoUrl: OLD })];
    expect((await call()).status).toBe(200);
    expect(sb.upload).not.toHaveBeenCalled();
    expect(sb.remove).not.toHaveBeenCalled();
    expect(state.sets[0] as object).not.toHaveProperty("photoUrl");
  });

  it("stores a new photo, sets photoUrl and removes the previous trips/ file", async () => {
    state.result = [row({ photoUrl: OLD })];
    expect((await call(body(), ID, jpgFile())).status).toBe(200);
    const path = sb.upload.mock.calls[0][0];
    expect(path).toMatch(/^trips\/[0-9a-f-]{36}\.jpg$/);
    expect(state.sets[0]).toMatchObject({ photoUrl: `${BASE}/${path}` });
    expect(sb.remove).toHaveBeenCalledWith(["trips/old.jpg"]);
  });

  it("removes nothing when the previous photo URL is null", async () => {
    state.result = [row({ photoUrl: null })];
    expect((await call(body(), ID, jpgFile())).status).toBe(200);
    expect(sb.upload).toHaveBeenCalledTimes(1);
    expect(sb.remove).not.toHaveBeenCalled();
  });

  it("never deletes a previous URL that is not under trips/", async () => {
    state.result = [row({ photoUrl: `${BASE}/profile-1.jpg` })];
    await call(body(), ID, jpgFile());
    expect(sb.remove).not.toHaveBeenCalled();
  });

  it("lists photo (not photoUrl) in changedFields of the single trip.edited event", async () => {
    state.result = [row({ photoUrl: OLD })];
    await call(body(), ID, jpgFile());
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ action: "trip.edited" });
    expect(evs[0].changedFields as string[]).toContain("photo");
    expect(evs[0].changedFields as string[]).not.toContain("photoUrl");
  });

  it("ignores a photoUrl form field", async () => {
    await call(body({ photoUrl: "https://evil.test/x.jpg" }));
    expect(JSON.stringify(state.sets)).not.toContain("evil");
    expect(state.sets[0] as object).not.toHaveProperty("photoUrl");
  });

  it("returns 400 for an over-2 MB photo without writing", async () => {
    const res = await call(body(), ID, jpgFile(PHOTO_MAX_BYTES + 1));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Photo must be 2 MB or smaller");
    expect(sb.upload).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
  });

  it("returns 400 for a spoofed (GIF) photo without writing", async () => {
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], "a.jpg", { type: "image/jpeg" });
    expect((await call(body(), ID, gif)).status).toBe(400);
    expect(sb.upload).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
  });

  it("uploads nothing on 404, 409 and 400 (maxTravelers)", async () => {
    state.result = [];
    expect((await call(body(), ID, jpgFile())).status).toBe(404);
    state.result = [row({ status: "cancelled" })];
    expect((await call(body(), ID, jpgFile())).status).toBe(409);
    state.result = [row({ joined: 3 })];
    expect((await call(body({ maxTravelers: 2 }), ID, jpgFile())).status).toBe(400);
    expect((await call(body(), "not-a-uuid", jpgFile())).status).toBe(404);
    expect(sb.upload).not.toHaveBeenCalled();
  });

  it("deletes the new upload when the update finds no row", async () => {
    upd.forceNull = true;
    const res = await call(body(), ID, jpgFile());
    expect(res.status).toBe(404);
    expect(sb.remove).toHaveBeenCalledWith([sb.upload.mock.calls[0][0]]);
  });

  it("returns 500 and deletes the new upload when the transaction fails", async () => {
    vi.spyOn(db, "transaction").mockRejectedValue(new Error("db down"));
    const res = await call(body(), ID, jpgFile());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "Could not update the trip. Try again." });
    const path = sb.upload.mock.calls[0][0];
    expect(path).toMatch(/^trips\//);
    expect(sb.remove).toHaveBeenCalledWith([path]);
  });

  it("returns 415 for a JSON body", async () => {
    const req = new Request(`http://app.test/api/trips/${ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: "better-auth.session_token=x" },
      body: JSON.stringify(body()),
    });
    expect((await PATCH(req, ctx(ID))).status).toBe(415);
    expect(state.updates).toHaveLength(0);
  });
});

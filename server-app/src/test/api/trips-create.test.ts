import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { auditEvents, trips as tripsTable } from "@/db/schema";
import { jpgFile, pngFile, reset, send, sendForm, state, userSession } from "../helpers";

const sb = vi.hoisted(() => ({
  upload: vi.fn(async (_path: string, _bytes: Uint8Array, _opts?: unknown) => ({ error: null as unknown })),
  remove: vi.fn(async (_paths: string[]) => ({ error: null as unknown })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
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

const route = await import("../../app/api/trips/route");
const { TRIP_PHOTO_REQUIRED, PHOTO_MAX_BYTES } = await import("@/lib/validators");

type Handler = (req: Request, c?: unknown) => Promise<Response>;
const POST = route.POST as Handler;

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
const fields = (extra: Record<string, unknown> = {}) => ({
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
const create = (f: Record<string, unknown> = fields(), photo?: File) => POST(sendForm("POST", "/api/trips", f, photo));
const tripInserts = () => state.inserts.filter((i) => i.table === tripsTable);
const events = () => state.inserts.filter((i) => i.table === auditEvents).map((i) => i.values as Record<string, unknown>);
const URL_RE = /^https:\/\/abc\.supabase\.co\/storage\/v1\/object\/public\/[^/]+\/trips\/[0-9a-f-]{36}\.(jpg|png)$/;

beforeEach(() => {
  reset();
  sb.upload.mockClear();
  sb.remove.mockClear();
  sb.upload.mockResolvedValue({ error: null });
  sb.remove.mockResolvedValue({ error: null });
  vi.stubEnv("SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "secret");
  state.session = userSession("org-1");
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/trips with a photo", () => {
  it("returns 400 TRIP_PHOTO_REQUIRED without a photo and inserts no trip", async () => {
    const res = await create();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: TRIP_PHOTO_REQUIRED });
    expect(tripInserts()).toHaveLength(0);
    expect(sb.upload).not.toHaveBeenCalled();
  });

  it("treats a 0-byte photo as missing", async () => {
    const res = await create(fields(), new File([], "e.jpg", { type: "image/jpeg" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(TRIP_PHOTO_REQUIRED);
    expect(tripInserts()).toHaveLength(0);
  });

  it("returns 400 for a photo over 2 MB, with no upload and no insert", async () => {
    const res = await create(fields(), jpgFile(PHOTO_MAX_BYTES + 1));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Photo must be 2 MB or smaller");
    expect(sb.upload).not.toHaveBeenCalled();
    expect(tripInserts()).toHaveLength(0);
  });

  it("returns 400 for GIF bytes declared as image/jpeg, with no upload and no insert", async () => {
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], "a.jpg", { type: "image/jpeg" });
    const res = await create(fields(), gif);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Photo must be a JPG or PNG image");
    expect(sb.upload).not.toHaveBeenCalled();
    expect(tripInserts()).toHaveLength(0);
  });

  it("validates the fields before uploading", async () => {
    const res = await create(fields({ maxTravelers: 1 }), jpgFile());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("At least 2 travelers");
    expect(sb.upload).not.toHaveBeenCalled();
  });

  it("stores a valid JPG and inserts photoUrl equal to the public URL under trips/", async () => {
    state.result = [{ id: "trip-9" }];
    const res = await create(fields(), jpgFile());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: "trip-9" });
    const path = sb.upload.mock.calls[0][0];
    expect(path).toMatch(/^trips\/[0-9a-f-]{36}\.jpg$/);
    const values = tripInserts()[0].values as Record<string, unknown>;
    expect(values.photoUrl).toMatch(URL_RE);
    expect(String(values.photoUrl).endsWith(`/${path}`)).toBe(true);
    expect(values).toMatchObject({ organizerId: "org-1", destinationCity: "Mirissa", maxTravelers: 4 });
  });

  it("accepts a PNG", async () => {
    expect((await create(fields(), pngFile())).status).toBe(200);
    expect(tripInserts()[0].values).toMatchObject({ photoUrl: expect.stringMatching(/\/trips\/[0-9a-f-]{36}\.png$/) });
  });

  it("ignores a photoUrl form field", async () => {
    await create(fields({ photoUrl: "https://evil.test/x.jpg" }), jpgFile());
    const values = tripInserts()[0].values as Record<string, unknown>;
    expect(values.photoUrl).toMatch(URL_RE);
    expect(JSON.stringify(values)).not.toContain("evil");
  });

  it("still logs trip.created in the same request", async () => {
    await create(fields(), jpgFile());
    expect(events()[0]).toMatchObject({ action: "trip.created", actorId: "org-1" });
  });

  it("returns 500 and deletes the uploaded file when the transaction fails", async () => {
    vi.spyOn(db, "transaction").mockRejectedValue(new Error("db down"));
    const res = await create(fields(), jpgFile());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "Could not create the trip. Try again." });
    expect(sb.remove).toHaveBeenCalledWith([sb.upload.mock.calls[0][0]]);
  });
});

describe("POST /api/trips guards", () => {
  it("returns 401 without a session and uploads nothing", async () => {
    state.session = null;
    expect((await create(fields(), jpgFile())).status).toBe(401);
    expect(sb.upload).not.toHaveBeenCalled();
    expect(tripInserts()).toHaveLength(0);
  });

  it("returns 415 for a JSON body", async () => {
    const res = await POST(send("POST", "/api/trips", fields()));
    expect(res.status).toBe(415);
    expect((await res.json()).error).toBe("Content-Type must be multipart/form-data");
    expect(tripInserts()).toHaveLength(0);
  });

  it("returns 415 for text/plain", async () => {
    const req = new Request("http://app.test/api/trips", {
      method: "POST",
      headers: { "content-type": "text/plain", cookie: "better-auth.session_token=x" },
      body: "hello",
    });
    expect((await POST(req)).status).toBe(415);
  });

  it("returns 400 for an unparsable multipart body", async () => {
    const req = new Request("http://app.test/api/trips", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=abc", cookie: "better-auth.session_token=x" },
      body: "not multipart",
    });
    expect((await POST(req)).status).toBe(400);
    expect(sb.upload).not.toHaveBeenCalled();
  });

  it("returns 403 for a foreign Origin and uploads nothing", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://app.example");
    const base = sendForm("POST", "/api/trips", fields(), jpgFile());
    const headers = new Headers(base.headers);
    headers.set("origin", "https://evil.example");
    const req = new Request(base.url, { method: "POST", headers, body: await base.formData() });
    expect((await POST(req)).status).toBe(403);
    expect(sb.upload).not.toHaveBeenCalled();
  });
});

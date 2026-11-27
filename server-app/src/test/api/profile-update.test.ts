import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { auditEvents } from "@/db/schema";
import { jpgFile, reset, send, sendForm, state } from "../helpers";

const storage = vi.hoisted(() => ({
  upload: vi.fn(async (): Promise<{ ok: true; url: string } | { ok: false; error: string }> => ({
    ok: true,
    url: "https://abc.supabase.co/storage/v1/object/public/profile-photos/new.jpg",
  })),
  remove: vi.fn(async () => undefined),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
vi.mock("@/lib/storage", () => ({
  uploadProfilePhoto: storage.upload,
  deleteProfilePhoto: storage.remove,
}));

const profile = await import("../../app/api/profile/route");
type Handler = (req: Request) => Promise<Response>;
const patch = profile.PATCH as Handler;

const OLD_PHOTO = "https://abc.supabase.co/storage/v1/object/public/profile-photos/old.jpg";
const row = (over: object = {}) => ({
  id: "profile-owner",
  name: "Jamie Traveler",
  firstName: "Jamie",
  lastName: "Traveler",
  email: "jamie@example.test",
  username: "jamie",
  phone: "+12025550101",
  address: "Sample City",
  birthDate: "1995-05-12",
  gender: "female",
  image: OLD_PHOTO,
  role: "user",
  ...over,
});
const events = () => state.inserts.filter((i) => i.table === auditEvents).map((i) => i.values as Record<string, unknown>);

function withOrigin(req: Request, origin: string) {
  const headers = new Headers(req.headers);
  headers.set("origin", origin);
  return new Request(req.url, {
    method: req.method,
    headers,
    body: req.body,
    duplex: "half",
  } as RequestInit);
}

beforeEach(() => {
  reset();
  state.session = {
    user: { id: "profile-owner", name: "Jamie Traveler", email: "jamie@example.test", role: "user" },
    session: { id: "session-1" },
  };
  state.result = [row()];
  storage.upload.mockReset();
  storage.upload.mockResolvedValue({
    ok: true,
    url: "https://abc.supabase.co/storage/v1/object/public/profile-photos/new.jpg",
  });
  storage.remove.mockReset();
  storage.remove.mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("PATCH /api/profile", () => {
  it("preserves the gender-only JSON contract", async () => {
    const res = await patch(send("PATCH", "/api/profile", { gender: "male" }));
    expect(res.status).toBe(200);
    expect(state.sets).toContainEqual({ gender: "male" });
    expect(events()[0]).toMatchObject({ action: "account.edited", changedFields: ["gender"] });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("updates basic fields and audits only changed field names", async () => {
    const res = await patch(sendForm("PATCH", "/api/profile", {
      firstName: "  Alex ",
      lastName: " Popescu ",
      phone: "+40721000111",
      address: "Cluj",
      gender: "male",
      username: "attacker",
      email: "attacker@example.test",
    }));
    expect(res.status).toBe(200);
    expect(state.sets).toContainEqual({
      firstName: "Alex",
      lastName: "Popescu",
      name: "Alex Popescu",
      phone: "+40721000111",
      address: "Cluj",
      gender: "male",
    });
    expect(events()).toHaveLength(1);
    expect([...(events()[0].changedFields as string[])].sort()).toEqual([
      "address",
      "firstName",
      "gender",
      "lastName",
      "phone",
    ]);
    expect(JSON.stringify(events())).not.toContain("Alex");
    expect(state.sets[0]).not.toHaveProperty("username");
    expect(state.sets[0]).not.toHaveProperty("email");
  });

  it("rejects invalid profile fields without uploading or writing", async () => {
    const res = await patch(sendForm("PATCH", "/api/profile", { phone: "not a phone" }, jpgFile()));
    expect(res.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
    expect(events()).toHaveLength(0);
  });

  it("allows uploading a photo without changing text fields", async () => {
    const res = await patch(sendForm("PATCH", "/api/profile", {}, jpgFile()));
    expect(res.status).toBe(200);
    expect(state.sets).toContainEqual({ image: "https://abc.supabase.co/storage/v1/object/public/profile-photos/new.jpg" });
    expect(events()[0]).toMatchObject({ action: "account.edited", changedFields: ["photo"] });
    expect(storage.remove).toHaveBeenCalledWith(OLD_PHOTO);
  });

  it("does not write when photo validation or upload fails", async () => {
    storage.upload.mockResolvedValue({ ok: false, error: "Photo must be a JPG or PNG image" });
    const res = await patch(sendForm("PATCH", "/api/profile", {}, jpgFile()));
    expect(res.status).toBe(400);
    expect(state.updates).toHaveLength(0);
    expect(events()).toHaveLength(0);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("returns 404 and removes the new upload when the session user row is missing", async () => {
    state.result = [];
    const res = await patch(sendForm("PATCH", "/api/profile", {}, jpgFile()));
    expect(res.status).toBe(404);
    expect(state.updates).toHaveLength(0);
    expect(events()).toHaveLength(0);
    expect(storage.remove).toHaveBeenCalledWith("https://abc.supabase.co/storage/v1/object/public/profile-photos/new.jpg");
  });

  it("cleans up the new upload and returns an error when the database update fails", async () => {
    vi.spyOn(db, "transaction").mockRejectedValue(new Error("db down"));
    const res = await patch(sendForm("PATCH", "/api/profile", {}, jpgFile()));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
    expect(storage.remove).toHaveBeenCalledWith("https://abc.supabase.co/storage/v1/object/public/profile-photos/new.jpg");
  });

  it("keeps a successful update successful if old-photo cleanup fails", async () => {
    storage.remove.mockRejectedValue(new Error("storage unavailable"));
    const res = await patch(sendForm("PATCH", "/api/profile", {}, jpgFile()));
    expect(res.status).toBe(200);
    expect(state.sets).toContainEqual({ image: "https://abc.supabase.co/storage/v1/object/public/profile-photos/new.jpg" });
  });

  it("rejects unauthenticated and cross-origin updates before uploading", async () => {
    state.session = null;
    expect((await patch(sendForm("PATCH", "/api/profile", {}, jpgFile()))).status).toBe(401);
    state.session = {
      user: { id: "profile-owner", name: "Jamie Traveler", email: "jamie@example.test", role: "user" },
      session: { id: "session-1" },
    };
    const foreign = withOrigin(sendForm("PATCH", "/api/profile", {}, jpgFile()), "https://evil.example");
    expect((await patch(foreign)).status).toBe(403);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { reset, signUpEmail } from "../helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
const limit = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
vi.mock("@/lib/signup-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/signup-limit")>()),
  consumeSignupAttempt: limit,
}));
// Spy on the real storage module: the photo-rule tests below still use its real validation.
vi.mock("@/lib/storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/storage")>();
  upload.mockImplementation(real.uploadProfilePhoto);
  return { ...real, uploadProfilePhoto: upload };
});

const signup = await import("../../app/api/signup/route");

const TWO_MB = 2 * 1024 * 1024;

function form(photo?: File) {
  const f = new FormData();
  f.set("username", "new.user");
  f.set("password", "Strong-Pass-123");
  f.set("firstName", "New");
  f.set("lastName", "User");
  f.set("email", "new.user@test.dev");
  f.set("phone", "+40721000111");
  f.set("address", "Cluj");
  f.set("birthDate", "1995-04-12");
  f.set("gender", "female");
  if (photo) f.set("photo", photo);
  return f;
}

function bytes(size: number, head: number[]) {
  const b = new Uint8Array(size);
  b.set(head);
  return b;
}

const post = (f: FormData) =>
  (signup.POST as (r: Request) => Promise<Response>)(new Request("http://app.test/api/signup", { method: "POST", body: f }));

beforeEach(() => {
  reset();
  limit.mockReset();
  limit.mockResolvedValue({ allowed: true });
  upload.mockClear();
});

describe("POST /api/signup rate limit", () => {
  const jpg = () => new File([bytes(64, [0xff, 0xd8, 0xff])], "p.jpg", { type: "image/jpeg" });

  it("answers 429 with the exact JSON and Retry-After, before parsing, upload or signUpEmail", async () => {
    limit.mockResolvedValue({ allowed: false, retryAfterSeconds: 120 });
    const formData = vi.fn(async () => form(jpg()));
    const r = new Request("http://app.test/api/signup", { method: "POST", body: form(jpg()) });
    r.formData = formData;
    const res = await (signup.POST as (r: Request) => Promise<Response>)(r);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("120");
    expect(await res.json()).toEqual({ ok: false, error: "Too many sign-up attempts. Try again later." });
    expect(formData).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("counts an attempt with invalid data", async () => {
    const f = form(jpg());
    f.set("password", "short");
    const res = await post(f);
    expect(res.status).toBe(400);
    expect(limit).toHaveBeenCalledTimes(1);
  });

  it("passes the request to the limiter and proceeds when allowed", async () => {
    upload.mockResolvedValueOnce({ ok: false, error: "stop here" });
    const res = await post(form(jpg()));
    expect(limit).toHaveBeenCalledTimes(1);
    expect(limit.mock.calls[0][0]).toBeInstanceOf(Request);
    expect(res.status).toBe(400);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("refuses a foreign Origin with 403 and does not call the limiter", async () => {
    const res = await (signup.POST as (r: Request) => Promise<Response>)(
      new Request("http://app.test/api/signup", { method: "POST", headers: { origin: "https://evil.test" }, body: form(jpg()) }),
    );
    expect(res.status).toBe(403);
    expect(limit).not.toHaveBeenCalled();
  });
});

describe("POST /api/signup gender", () => {
  const jpg = () => new File([bytes(64, [0xff, 0xd8, 0xff])], "p.jpg", { type: "image/jpeg" });

  it.each([["missing", undefined], ["mixed", "mixed"], ["garbage", "robot"]])("rejects a %s gender with 400", async (_n, g) => {
    const f = form(jpg());
    f.delete("gender");
    if (g !== undefined) f.set("gender", g);
    const res = await post(f);
    expect(res.status).toBe(400);
    expect((await res.json()).ok).toBe(false);
    expect(signUpEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/signup photo rules", () => {
  it("rejects a missing photo", async () => {
    const res = await post(form());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Upload at least one photo (JPG or PNG)" });
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("rejects a photo of 2 MB + 1 byte", async () => {
    const big = new File([bytes(TWO_MB + 1, [0xff, 0xd8, 0xff])], "p.jpg", { type: "image/jpeg" });
    const res = await post(form(big));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Photo must be 2 MB or smaller" });
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("rejects GIF bytes even when labelled image/jpeg", async () => {
    const gif = new File([bytes(64, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], "p.jpg", { type: "image/jpeg" });
    const res = await post(form(gif));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Photo must be a JPG or PNG image" });
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("rejects invalid fields with the first validation message before touching the photo", async () => {
    const f = form();
    f.set("password", "short");
    const res = await post(f);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "At least 10 characters" });
  });
});

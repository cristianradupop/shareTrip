import { beforeEach, describe, expect, it, vi } from "vitest";
import { reset, signUpEmail } from "../helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());

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

beforeEach(reset);

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

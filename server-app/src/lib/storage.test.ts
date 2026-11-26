import { beforeEach, describe, expect, it, vi } from "vitest";
import { jpgFile, pngFile } from "../test/helpers";

const sb = vi.hoisted(() => ({
  upload: vi.fn(async (_path: string, _bytes: Uint8Array, _opts?: unknown) => ({ error: null as unknown })),
  remove: vi.fn(async (_paths: string[]) => ({ error: null as unknown })),
}));

vi.mock("server-only", () => ({}));
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

const { uploadTripPhoto, deleteTripPhoto, uploadProfilePhoto } = await import("./storage");
const { TRIP_PHOTO_REQUIRED, PHOTO_MAX_BYTES } = await import("./validators");

const BASE = "https://abc.supabase.co/storage/v1/object/public/profile-photos";

beforeEach(() => {
  sb.upload.mockClear();
  sb.remove.mockClear();
  sb.upload.mockResolvedValue({ error: null });
  sb.remove.mockResolvedValue({ error: null });
  vi.stubEnv("SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "secret");
});

describe("uploadTripPhoto", () => {
  it("rejects an empty file with TRIP_PHOTO_REQUIRED and uploads nothing", async () => {
    const res = await uploadTripPhoto(new File([], "e.jpg", { type: "image/jpeg" }));
    expect(res).toEqual({ ok: false, error: TRIP_PHOTO_REQUIRED });
    expect(sb.upload).not.toHaveBeenCalled();
  });

  it("rejects a file over 2 MB and does not upload", async () => {
    const res = await uploadTripPhoto(jpgFile(PHOTO_MAX_BYTES + 1));
    expect(res).toEqual({ ok: false, error: "Photo must be 2 MB or smaller" });
    expect(sb.upload).not.toHaveBeenCalled();
  });

  it("rejects GIF bytes declared as image/jpeg", async () => {
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0])], "a.jpg", { type: "image/jpeg" });
    const res = await uploadTripPhoto(gif);
    expect(res).toEqual({ ok: false, error: "Photo must be a JPG or PNG image" });
    expect(sb.upload).not.toHaveBeenCalled();
  });

  it("stores a JPG under trips/<uuid>.jpg and returns the public URL", async () => {
    const res = await uploadTripPhoto(jpgFile());
    expect(res.ok).toBe(true);
    const path = sb.upload.mock.calls[0][0];
    expect(path).toMatch(/^trips\/[0-9a-f-]{36}\.jpg$/);
    expect(sb.upload.mock.calls[0][2]).toMatchObject({ contentType: "image/jpeg" });
    expect(res).toEqual({ ok: true, url: `${BASE}/${path}` });
  });

  it("stores a PNG under trips/<uuid>.png", async () => {
    await uploadTripPhoto(pngFile());
    expect(sb.upload.mock.calls[0][0]).toMatch(/^trips\/[0-9a-f-]{36}\.png$/);
    expect(sb.upload.mock.calls[0][2]).toMatchObject({ contentType: "image/png" });
  });

  it("ignores the client file name", async () => {
    const f = new File([new Uint8Array([0xff, 0xd8, 0xff, 0])], "../../evil.png", { type: "image/png" });
    await uploadTripPhoto(f);
    expect(sb.upload.mock.calls[0][0]).toMatch(/^trips\/[0-9a-f-]{36}\.jpg$/);
  });

  it("returns the upload error message when storage fails", async () => {
    sb.upload.mockResolvedValue({ error: { message: "boom" } });
    expect(await uploadTripPhoto(jpgFile())).toEqual({ ok: false, error: "Could not upload the photo. Try again." });
  });
});

describe("deleteTripPhoto", () => {
  it("removes the trips/ path taken from the public URL", async () => {
    await deleteTripPhoto(`${BASE}/trips/abc.jpg`);
    expect(sb.remove).toHaveBeenCalledWith(["trips/abc.jpg"]);
  });

  it.each([
    ["null", null],
    ["a profile photo URL", `${BASE}/0b1c2d.jpg`],
    ["a path that only contains trips/ later", `${BASE}/other/trips/abc.jpg`],
    ["a foreign URL", "https://evil.test/a.jpg"],
  ])("ignores %s", async (_n, url) => {
    await deleteTripPhoto(url as string | null);
    expect(sb.remove).not.toHaveBeenCalled();
  });

  it("swallows a thrown error", async () => {
    sb.remove.mockRejectedValue(new Error("network"));
    await expect(deleteTripPhoto(`${BASE}/trips/abc.jpg`)).resolves.toBeUndefined();
  });

  it("swallows a returned storage error", async () => {
    sb.remove.mockResolvedValue({ error: { message: "nope" } });
    await expect(deleteTripPhoto(`${BASE}/trips/abc.jpg`)).resolves.toBeUndefined();
  });
});

describe("profile photo functions are unchanged", () => {
  it("uploadProfilePhoto stores at the bucket root, not under trips/", async () => {
    const res = await uploadProfilePhoto(jpgFile());
    expect(res.ok).toBe(true);
    expect(sb.upload.mock.calls[0][0]).toMatch(/^[0-9a-f-]{36}\.jpg$/);
  });

  it("uploadProfilePhoto keeps its empty-file message", async () => {
    expect(await uploadProfilePhoto(new File([], "e.jpg"))).toEqual({
      ok: false,
      error: "Upload at least one photo (JPG or PNG)",
    });
  });
});

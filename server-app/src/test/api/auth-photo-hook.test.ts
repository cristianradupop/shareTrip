import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());

const BASE = "https://proj.supabase.co";
const BUCKET = "profile-photos";
type Before = (u: { image?: string | null; [k: string]: unknown }) => Promise<unknown>;
let before: Before;

beforeAll(async () => {
  vi.stubEnv("SUPABASE_URL", BASE);
  vi.stubEnv("SUPABASE_PHOTOS_BUCKET", BUCKET);
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3001");
  const { auth } = await import("../../lib/auth");
  before = (auth.options as unknown as { databaseHooks: { user: { create: { before: Before } } } }).databaseHooks.user.create.before;
});

describe("user.create.before photo hook", () => {
  it("accepts a URL inside the configured public bucket", async () => {
    await expect(before({ image: `${BASE}/storage/v1/object/public/${BUCKET}/a.jpg` })).resolves.toBeTruthy();
  });

  it.each([
    ["another bucket", `${BASE}/storage/v1/object/public/other-bucket/a.jpg`],
    ["a non-public storage path", `${BASE}/storage/v1/object/sign/${BUCKET}/a.jpg`],
    ["a different host", `https://evil.test/storage/v1/object/public/${BUCKET}/a.jpg`],
    ["no image", ""],
  ])("rejects %s", async (_n, image) => {
    await expect(before({ image })).rejects.toThrow();
  });
});

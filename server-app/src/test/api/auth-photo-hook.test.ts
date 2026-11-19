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

const GOOD = `${BASE}/storage/v1/object/public/${BUCKET}/a.jpg`;

describe("user.create.before photo hook", () => {
  it("accepts a URL inside the configured public bucket", async () => {
    await expect(before({ image: GOOD, gender: "female" })).resolves.toBeTruthy();
  });

  it.each([
    ["another bucket", `${BASE}/storage/v1/object/public/other-bucket/a.jpg`],
    ["a non-public storage path", `${BASE}/storage/v1/object/sign/${BUCKET}/a.jpg`],
    ["a different host", `https://evil.test/storage/v1/object/public/${BUCKET}/a.jpg`],
    ["no image", ""],
  ])("rejects %s", async (_n, image) => {
    await expect(before({ image, gender: "male" })).rejects.toThrow();
  });
});

describe("user.create.before gender rule", () => {
  it.each(["male", "female"])("accepts gender %s with a valid photo", async (gender) => {
    await expect(before({ image: GOOD, gender })).resolves.toBeTruthy();
  });

  it.each([
    ["a missing gender", undefined],
    ["an empty gender", ""],
    ["a null gender", null],
    ["'mixed' (trip-only value)", "mixed"],
    ["garbage", "robot"],
    ["a wrong-case value", "Male"],
  ])("rejects %s", async (_n, gender) => {
    await expect(before({ image: GOOD, gender })).rejects.toThrow(/gender/i);
  });
});

describe("user.update.before gender rule", () => {
  type Update = (u: Record<string, unknown>) => Promise<unknown>;
  const updateBefore = () =>
    (auth_.options as unknown as { databaseHooks: { user: { update: { before: Update } } } }).databaseHooks.user.update.before;
  let auth_: { options: unknown };
  beforeAll(async () => {
    auth_ = (await import("../../lib/auth")).auth as unknown as { options: unknown };
  });

  it("passes when the gender key is absent", async () => {
    await expect(updateBefore()({ firstName: "Ana" })).resolves.toBeTruthy();
  });

  it.each(["male", "female"])("passes a valid gender %s", async (gender) => {
    await expect(updateBefore()({ gender })).resolves.toBeTruthy();
  });

  it.each(["mixed", "robot", ""])("rejects an invalid gender %j when the key is present", async (gender) => {
    await expect(updateBefore()({ gender })).rejects.toThrow();
  });
});

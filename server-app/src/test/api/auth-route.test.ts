import { beforeEach, describe, expect, it, vi } from "vitest";

// Better Auth's own handler is mocked: an allowed path must reach it, a refused one must not.
const ba = vi.hoisted(() => ({
  GET: vi.fn(async () => new Response("handled-get", { status: 200 })),
  POST: vi.fn(async () => new Response("handled-post", { status: 200 })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", () => ({ auth: {} }));
vi.mock("better-auth/next-js", () => ({ toNextJsHandler: () => ba }));

const route = await import("../../app/api/auth/[...all]/route");
const call = (method: "GET" | "POST", path: string) =>
  route[method](new Request(`http://app.test/api/auth${path}`, { method }));

beforeEach(() => {
  ba.GET.mockClear();
  ba.POST.mockClear();
});

describe("/api/auth/[...all] allowlist", () => {
  it.each(["/update-user", "/change-password", "/admin/set-role", "/admin/ban-user", "/sign-in/email/", "/nope"])(
    "POST %s returns 404 and never reaches Better Auth",
    async (path) => {
      const res = await call("POST", path);
      expect(res.status).toBe(404);
      expect(ba.POST).not.toHaveBeenCalled();
    },
  );

  it("GET /admin/list-users returns 404 and never reaches Better Auth", async () => {
    expect((await call("GET", "/admin/list-users")).status).toBe(404);
    expect(ba.GET).not.toHaveBeenCalled();
  });

  it.each(["/sign-in/email", "/sign-in/username", "/sign-out", "/sign-up/email"])("POST %s passes through", async (path) => {
    const res = await call("POST", path);
    expect(res.status).toBe(200);
    expect(ba.POST).toHaveBeenCalledTimes(1);
  });

  it("GET /get-session passes through", async () => {
    expect((await call("GET", "/get-session")).status).toBe(200);
    expect(ba.GET).toHaveBeenCalledTimes(1);
  });
});

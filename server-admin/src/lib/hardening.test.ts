import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => "better-auth.session_token=abc" }),
  headers: async () => new Headers({ cookie: "better-auth.session_token=abc" }),
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));

const fetchMock = vi.fn(async (..._a: unknown[]) => Response.json({ user: null }));

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => Response.json({ user: null }));
  vi.stubEnv("SERVER_APP_URL", "http://server-app.test");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("apiFetch path guard", () => {
  it.each(["/health", "//evil.test/api/x", "https://evil.test/api/x", "api/feed"])("throws for %s", async (p) => {
    const { apiFetch } = await import("./api");
    await expect(apiFetch(p)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getSession with server-app errors", () => {
  it("throws when /api/session answers 5xx", async () => {
    fetchMock.mockImplementation(async () => new Response("boom", { status: 503 }));
    const { getSession } = await import("./session");
    await expect(getSession()).rejects.toThrow();
  });

  it("still returns null for 200 { user: null }", async () => {
    const { getSession } = await import("./session");
    expect(await getSession()).toBeNull();
  });
});

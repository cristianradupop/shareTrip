import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const COOKIE = "better-auth.session_token=abc123; theme=dark";

vi.mock("next/headers", () => {
  const entries = [
    { name: "better-auth.session_token", value: "abc123" },
    { name: "theme", value: "dark" },
  ];
  const store = {
    get: (n: string) => entries.find((e) => e.name === n),
    has: (n: string) => entries.some((e) => e.name === n),
    getAll: () => entries,
    toString: () => entries.map((e) => `${e.name}=${e.value}`).join("; "),
  };
  return {
    cookies: async () => store,
    headers: async () => new Headers({ cookie: "better-auth.session_token=abc123; theme=dark" }),
  };
});

const fetchMock = vi.fn(async (..._args: unknown[]) => Response.json({ ok: true }));

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockClear();
  vi.stubEnv("SERVER_APP_URL", "http://server-app.test");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("calls the server-app URL and forwards the request cookie header", async () => {
    const { apiFetch } = await import("./api");
    await apiFetch("/api/feed");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit];
    expect(String(url)).toBe("http://server-app.test/api/feed");
    const cookie = new Headers(init.headers).get("cookie");
    expect(cookie).toContain("better-auth.session_token=abc123");
    expect(cookie).toBe(COOKIE);
  });

  it('never caches: uses cache: "no-store"', async () => {
    const { apiFetch } = await import("./api");
    await apiFetch("/api/organizer/stats");
    const [, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    expect(init.cache).toBe("no-store");
  });
});

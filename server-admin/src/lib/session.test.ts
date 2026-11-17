import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Cookie jar that tests fill in. Supports every read style the implementation might use.
const jar: { name: string; value: string }[] = [];
const cookieHeader = () => jar.map((c) => `${c.name}=${c.value}`).join("; ");

vi.mock("next/headers", () => {
  const store = {
    get: (n: string) => jar.find((e) => e.name === n),
    has: (n: string) => jar.some((e) => e.name === n),
    getAll: () => jar,
    toString: () => cookieHeader(),
  };
  return {
    cookies: async () => store,
    headers: async () => new Headers(jar.length ? { cookie: cookieHeader() } : {}),
  };
});

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const fetchMock = vi.fn(async (..._args: unknown[]) => Response.json({ user: null }));
const reply = (body: unknown) => fetchMock.mockImplementation(async () => Response.json(body));

beforeEach(() => {
  vi.resetModules();
  jar.length = 0;
  fetchMock.mockClear();
  reply({ user: null });
  vi.stubEnv("SERVER_APP_URL", "http://server-app.test");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getSession", () => {
  it("returns null without calling fetch when there is no session cookie", async () => {
    jar.push({ name: "theme", value: "dark" }); // an unrelated cookie must not trigger a lookup
    const { getSession } = await import("./session");
    expect(await getSession()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("with a session cookie calls /api/session on server-app and forwards the cookie", async () => {
    jar.push({ name: "better-auth.session_token", value: "abc123" });
    reply({ user: { id: "u1", role: "user" } });
    const { getSession } = await import("./session");

    expect(await getSession()).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit];
    expect(String(url)).toBe("http://server-app.test/api/session");
    expect(new Headers(init.headers).get("cookie")).toContain("better-auth.session_token=abc123");
  });

  it("treats the HTTPS cookie __Secure-better-auth.session_token as a session and fetches", async () => {
    jar.push({ name: "__Secure-better-auth.session_token", value: "sec123" });
    reply({ user: { id: "u1", role: "user" } });
    const { getSession } = await import("./session");

    expect(await getSession()).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit];
    expect(String(url)).toBe("http://server-app.test/api/session");
    expect(new Headers(init.headers).get("cookie")).toContain("__Secure-better-auth.session_token=sec123");
  });

  it("returns null when server-app answers { user: null } (expired or revoked session)", async () => {
    jar.push({ name: "better-auth.session_token", value: "stale" });
    reply({ user: null });
    const { getSession } = await import("./session");
    expect(await getSession()).toBeNull();
  });
});

describe("requireUser / requireAdmin", () => {
  it("requireUser redirects to /login without a cookie", async () => {
    const { requireUser } = await import("./session");
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });

  it("requireUser returns the user", async () => {
    jar.push({ name: "better-auth.session_token", value: "abc123" });
    reply({ user: { id: "u1", role: "user" } });
    const { requireUser } = await import("./session");
    expect(await requireUser()).toMatchObject({ id: "u1" });
  });

  it("requireAdmin redirects a non-admin to /?forbidden=admin", async () => {
    jar.push({ name: "better-auth.session_token", value: "abc123" });
    reply({ user: { id: "u1", role: "user" } });
    const { requireAdmin } = await import("./session");
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/?forbidden=admin");
  });

  it("requireAdmin redirects to /login?next=/admin without a session", async () => {
    const { requireAdmin } = await import("./session");
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login?next=/admin");
  });
});

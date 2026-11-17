import { beforeEach, describe, expect, it, vi } from "vitest";
import { session as sessionTable } from "@/db/schema";
import { adminSession, ctx, reset, send, signUpEmail, state, userSession } from "../helpers";

const upload = vi.hoisted(() => vi.fn(async () => ({ ok: true as const, url: "https://x.test/p.jpg" })));
const createUser = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
vi.mock("@/lib/storage", () => ({ uploadProfilePhoto: upload, deleteProfilePhoto: vi.fn(async () => undefined) }));
vi.mock("@/lib/user-service", () => ({ createCredentialUser: createUser }));

const signup = await import("../../app/api/signup/route");
const trips = await import("../../app/api/trips/route");
const session = await import("../../app/api/session/route");
const adminUsers = await import("../../app/api/admin/users/route");
const adminUser = await import("../../app/api/admin/users/[id]/route");
const adminBan = await import("../../app/api/admin/users/[id]/ban/route");

type Handler = (req: Request, c?: unknown) => Promise<Response>;

const APP = "https://app.example";
const EVIL = "https://evil.example";

const trip = () => ({
  destinationCity: "Lisbon",
  destinationCountry: "Portugal",
  departureDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  maxTravelers: 4,
  gender: "mixed",
  budgetEstimate: 500,
  currency: "EUR",
  transport: "plane",
  theme: "Surfing and pastel de nata",
});
const userBody = (extra: object = {}) => ({
  username: "new.user",
  email: "new.user@test.dev",
  firstName: "New",
  lastName: "User",
  phone: "+40721000111",
  address: "Cluj",
  birthDate: "1995-04-12",
  role: "user",
  ...extra,
});

function signupForm(over: Record<string, string> = {}) {
  const f = new FormData();
  const fields: Record<string, string> = {
    username: "new.user",
    password: "Strong-Pass-123",
    firstName: "New",
    lastName: "User",
    email: "new.user@test.dev",
    phone: "+40721000111",
    address: "Cluj",
    birthDate: "1995-04-12",
    ...over,
  };
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  f.set("photo", new File([new Uint8Array([0xff, 0xd8, 0xff, 0])], "p.jpg", { type: "image/jpeg" }));
  return f;
}

const withHeaders = (req: Request, h: Record<string, string>) => {
  const headers = new Headers(req.headers);
  for (const [k, v] of Object.entries(h)) headers.set(k, v);
  return new Request(req.url, { method: req.method, headers, body: req.body, ...(req.body ? { duplex: "half" } : {}) } as RequestInit);
};

type Case = { name: string; call: (h?: Record<string, string>) => Promise<Response>; ok: boolean };
const cases: Case[] = [
  {
    name: "POST /api/signup",
    call: (h = {}) =>
      (signup.POST as Handler)(new Request("http://app.test/api/signup", { method: "POST", headers: h, body: signupForm() })),
    ok: true,
  },
  {
    name: "POST /api/trips",
    call: (h = {}) => (trips.POST as Handler)(withHeaders(send("POST", "/api/trips", trip()), h)),
    ok: true,
  },
  {
    name: "POST /api/admin/users",
    call: (h = {}) =>
      (adminUsers.POST as Handler)(withHeaders(send("POST", "/api/admin/users", userBody({ password: "Strong-Pass-123" })), h)),
    ok: true,
  },
  {
    name: "PATCH /api/admin/users/[id]",
    call: (h = {}) =>
      (adminUser.PATCH as Handler)(withHeaders(send("PATCH", "/api/admin/users/u2", userBody()), h), ctx("u2")),
    ok: true,
  },
  {
    name: "DELETE /api/admin/users/[id]",
    call: (h = {}) => (adminUser.DELETE as Handler)(withHeaders(send("DELETE", "/api/admin/users/u2"), h), ctx("u2")),
    ok: true,
  },
  {
    name: "POST /api/admin/users/[id]/ban",
    call: (h = {}) =>
      (adminBan.POST as Handler)(withHeaders(send("POST", "/api/admin/users/u2/ban", { banned: true }), h), ctx("u2")),
    ok: true,
  },
];

beforeEach(() => {
  reset();
  upload.mockClear();
  createUser.mockClear();
  vi.stubEnv("BETTER_AUTH_URL", `${APP}/some/path`);
  state.session = adminSession("admin-1");
});

describe("same-origin check on mutating handlers", () => {
  it.each(cases)("$name: foreign Origin gets 403 and nothing is touched", async ({ call }) => {
    const res = await call({ origin: EVIL });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
    expect(state.deletes).toHaveLength(0);
    expect(upload).not.toHaveBeenCalled();
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it.each(cases)("$name: matching Origin works", async ({ call }) => {
    const res = await call({ origin: APP });
    expect(res.status).toBe(200);
  });

  it.each(cases)("$name: missing Origin works", async ({ call }) => {
    const res = await call();
    expect(res.status).toBe(200);
  });
});

describe("JSON handlers require application/json", () => {
  const bad = { "content-type": "text/plain" };
  it.each(cases.filter((c) => !c.name.includes("signup") && !c.name.startsWith("DELETE")))(
    "$name returns 415 for text/plain",
    async ({ call }) => {
      const res = await call(bad);
      expect(res.status).toBe(415);
      expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
      expect(state.inserts).toHaveLength(0);
      expect(state.updates).toHaveLength(0);
    },
  );
});

describe("signup validation order", () => {
  it("validates a too-short password before uploading the photo", async () => {
    const res = await (signup.POST as Handler)(
      new Request("http://app.test/api/signup", { method: "POST", body: signupForm({ password: "short" }) }),
    );
    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/users/[id] password change", () => {
  it("deletes the user's sessions when a new password is set", async () => {
    const res = await (adminUser.PATCH as Handler)(
      send("PATCH", "/api/admin/users/u2", userBody({ password: "Another-Pass-123" })),
      ctx("u2"),
    );
    expect(res.status).toBe(200);
    expect(state.deletes).toContain(sessionTable);
  });

  it("keeps sessions when no password is set", async () => {
    await (adminUser.PATCH as Handler)(send("PATCH", "/api/admin/users/u2", userBody()), ctx("u2"));
    expect(state.deletes).not.toContain(sessionTable);
  });
});

describe("GET /api/session caching", () => {
  it("sets Cache-Control: private, no-store (signed in and out)", async () => {
    state.session = userSession("u9");
    const a = await (session.GET as Handler)(new Request("http://app.test/api/session"));
    expect(a.headers.get("cache-control")).toBe("private, no-store");
    state.session = null;
    const b = await (session.GET as Handler)(new Request("http://app.test/api/session"));
    expect(b.headers.get("cache-control")).toBe("private, no-store");
  });
});

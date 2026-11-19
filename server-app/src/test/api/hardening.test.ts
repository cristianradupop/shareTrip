import { beforeEach, describe, expect, it, vi } from "vitest";
import { session as sessionTable } from "@/db/schema";
import { adminSession, ctx, reset, send, signUpEmail, state, userSession } from "../helpers";

const upload = vi.hoisted(() => vi.fn(async () => ({ ok: true as const, url: "https://x.test/p.jpg" })));
const createUser = vi.hoisted(() => vi.fn(async () => undefined));
const consumeLimit = vi.hoisted(() => vi.fn(async () => ({ allowed: true as const })));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
vi.mock("@/lib/signup-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/signup-limit")>()),
  consumeSignupAttempt: consumeLimit,
}));
vi.mock("@/lib/storage", () => ({ uploadProfilePhoto: upload, deleteProfilePhoto: vi.fn(async () => undefined) }));
vi.mock("@/lib/user-service", () => ({ createCredentialUser: createUser }));

// @/data/requests is mocked (names and shapes: see join.test.ts); defaults are set in beforeEach so every
// new handler can succeed, and a refused request must leave all of them untouched.
const reqs = vi.hoisted(() => ({
  loadJoinContext: vi.fn(),
  createJoinRequest: vi.fn(),
  withdrawRequest: vi.fn(),
  leaveTrip: vi.fn(),
  getTripOwner: vi.fn(),
  listTripPeople: vi.fn(),
  approveRequest: vi.fn(),
  declineRequest: vi.fn(),
}));
vi.mock("@/data/requests", () => reqs);

const signup = await import("../../app/api/signup/route");
const trips = await import("../../app/api/trips/route");
const tripById = await import("../../app/api/trips/[id]/route");
const session = await import("../../app/api/session/route");
const adminUsers = await import("../../app/api/admin/users/route");
const adminUser = await import("../../app/api/admin/users/[id]/route");
const adminBan = await import("../../app/api/admin/users/[id]/ban/route");
const profile = await import("../../app/api/profile/route");
const tripRequest = await import("../../app/api/trips/[id]/request/route");
const tripMembership = await import("../../app/api/trips/[id]/membership/route");
const orgDecide = await import("../../app/api/organizer/trips/[id]/requests/[userId]/route");

type Handler = (req: Request, c?: unknown) => Promise<Response>;

const TRIP_ID = "3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b";
const tripCtx = () => ({ params: Promise.resolve({ id: TRIP_ID }) });
const decideCtx = () => ({ params: Promise.resolve({ id: TRIP_ID, userId: "applicant-1" }) });
// A joinable trip for the session user (admin-1); each case overrides what it needs (member, pending request).
const joinCtx = (over: object = {}) => ({
  organizerId: "someone-else",
  status: "active",
  departureDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  maxTravelers: 6,
  tripGender: "mixed",
  joined: 2,
  isMember: false,
  requestStatus: null,
  ...over,
});
const withJoinCtx = <T>(over: object, fn: () => T): T => {
  reqs.loadJoinContext.mockResolvedValue(joinCtx(over));
  return fn();
};

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
  gender: "female",
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
    gender: "female",
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

type Case = { name: string; call: (h?: Record<string, string>) => Promise<Response>; ok: boolean; noBody?: boolean };
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
    name: "PATCH /api/trips/[id]",
    call: (h = {}) =>
      (tripById.PATCH as Handler)(
        withHeaders(send("PATCH", `/api/trips/${TRIP_ID}`, trip()), h),
        ctx(TRIP_ID),
      ),
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
  {
    name: "PATCH /api/profile",
    call: (h = {}) => (profile.PATCH as Handler)(withHeaders(send("PATCH", "/api/profile", { gender: "male" }), h)),
    ok: true,
  },
  {
    name: "POST /api/trips/[id]/request",
    call: (h = {}) =>
      withJoinCtx({}, () =>
        (tripRequest.POST as Handler)(withHeaders(send("POST", `/api/trips/${TRIP_ID}/request`), h), tripCtx()),
      ),
    ok: true,
    noBody: true,
  },
  {
    name: "DELETE /api/trips/[id]/request",
    call: (h = {}) =>
      withJoinCtx({ requestStatus: "pending" }, () =>
        (tripRequest.DELETE as Handler)(withHeaders(send("DELETE", `/api/trips/${TRIP_ID}/request`), h), tripCtx()),
      ),
    ok: true,
    noBody: true,
  },
  {
    name: "DELETE /api/trips/[id]/membership",
    call: (h = {}) =>
      withJoinCtx({ isMember: true, requestStatus: "approved" }, () =>
        (tripMembership.DELETE as Handler)(withHeaders(send("DELETE", `/api/trips/${TRIP_ID}/membership`), h), tripCtx()),
      ),
    ok: true,
    noBody: true,
  },
  {
    name: "PATCH /api/organizer/trips/[id]/requests/[userId]",
    call: (h = {}) =>
      (orgDecide.PATCH as Handler)(
        withHeaders(send("PATCH", `/api/organizer/trips/${TRIP_ID}/requests/applicant-1`, { action: "approve" }), h),
        decideCtx(),
      ),
    ok: true,
  },
];

beforeEach(() => {
  reset();
  upload.mockClear();
  createUser.mockClear();
  consumeLimit.mockClear();
  for (const fn of Object.values(reqs)) fn.mockReset();
  reqs.loadJoinContext.mockResolvedValue(joinCtx());
  reqs.createJoinRequest.mockResolvedValue({ ok: true });
  reqs.withdrawRequest.mockResolvedValue(true);
  reqs.leaveTrip.mockResolvedValue(undefined);
  reqs.getTripOwner.mockResolvedValue("admin-1");
  reqs.listTripPeople.mockResolvedValue({ pending: [], members: [] });
  reqs.approveRequest.mockResolvedValue({ ok: true, autoDeclined: 0 });
  reqs.declineRequest.mockResolvedValue(true);
  vi.stubEnv("BETTER_AUTH_URL", `${APP}/some/path`);
  state.session = adminSession("admin-1");
  // Editable trip row for PATCH /api/trips/[id]; other handlers ignore it.
  state.result = [
    {
      id: "trip-1",
      status: "active",
      departureDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      joined: 0,
    },
  ];
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
    expect(consumeLimit).not.toHaveBeenCalled();
    for (const name of ["createJoinRequest", "withdrawRequest", "leaveTrip", "approveRequest", "declineRequest"] as const) {
      expect(reqs[name]).not.toHaveBeenCalled();
    }
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
  it.each(cases.filter((c) => !c.noBody && !c.name.includes("signup") && !c.name.startsWith("DELETE")))(
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

describe("gender is carried through", () => {
  // Look cases up by name: other features add rows to `cases`, so indexes shift.
  const caseNamed = (name: string) => {
    const found = cases.find((c) => c.name === name);
    if (!found) throw new Error(`no hardening case named ${name}`);
    return found;
  };

  it("POST /api/signup passes the gender to Better Auth", async () => {
    const res = await caseNamed("POST /api/signup").call();
    expect(res.status).toBe(200);
    expect(signUpEmail).toHaveBeenCalledWith({ body: expect.objectContaining({ gender: "female" }) });
  });

  it("POST /api/admin/users passes the gender to createCredentialUser", async () => {
    const res = await caseNamed("POST /api/admin/users").call();
    expect(res.status).toBe(200);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ gender: "female" }),
      expect.objectContaining({ actor: expect.objectContaining({ id: "admin-1" }) }),
    );
  });

  it("POST /api/admin/users returns 400 without a gender", async () => {
    const noGender: Record<string, unknown> = userBody({ password: "Strong-Pass-123" });
    delete noGender.gender;
    const res = await (adminUsers.POST as Handler)(send("POST", "/api/admin/users", noGender));
    expect(res.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });
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

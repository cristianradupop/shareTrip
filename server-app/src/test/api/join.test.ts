import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { adminSession, reset, send, get, state, userSession } from "../helpers";

// Approach: @/data/requests is mocked, so these tests pin what the handlers ask of it and what they answer.
// Assumed data-layer signatures (server-app/src/data/requests.ts, the plan leaves them open):
//   loadJoinContext(tripId, userId): Promise<JoinContext | null>      (null = no such trip -> 404)
//     JoinContext = { organizerId, status: "active"|"full"|"cancelled", departureDate, maxTravelers,
//                     tripGender: "male"|"female"|"mixed", joined, isMember, requestStatus: "pending"|"approved"|"declined"|null }
//   createJoinRequest(tripId, userId): Promise<{ ok: true } | { ok: false; status: number; error: string }>   (duplicate -> 409 here)
//   withdrawRequest(tripId, userId): Promise<boolean>                 (false = nothing pending was deleted -> 409)
//   leaveTrip(tripId, userId): Promise<void>
//   getTripOwner(tripId): Promise<string | null>                      (organizer id; null = no such trip)
//   listTripPeople(tripId, today): Promise<{ pending: Person[]; members: Person[] }>
//     Person = { userId, name, image, age, gender }
//   approveRequest(tripId, userId, today): Promise<{ ok: true; autoDeclined: number } | { ok: false; status: number; error: string }>
//   declineRequest(tripId, userId): Promise<boolean>                  (false = no pending request -> 409)
// Responses: joiner handlers { ok: true, viewerState, joined }; PATCH decide { ok: true, autoDeclined } for approve, { ok: true } for decline.
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

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
vi.mock("@/data/requests", () => reqs);

const request = await import("../../app/api/trips/[id]/request/route");
const membership = await import("../../app/api/trips/[id]/membership/route");
const orgRequests = await import("../../app/api/organizer/trips/[id]/requests/route");
const orgDecide = await import("../../app/api/organizer/trips/[id]/requests/[userId]/route");

type Handler = (req: Request, c?: unknown) => Promise<Response>;
const TRIP = "3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b";
const TODAY = "2026-11-19";
const APP = "https://app.example";
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const decideCtx = (id = TRIP, userId = "applicant-1") => ({ params: Promise.resolve({ id, userId }) });

const joinCtx = (over: object = {}) => ({
  organizerId: "org-1",
  status: "active",
  departureDate: "2026-12-24",
  maxTravelers: 6,
  tripGender: "mixed",
  joined: 2,
  isMember: false,
  requestStatus: null,
  ...over,
});

const signIn = (id = "u-1", gender: string | null = "female") => {
  const s = userSession(id);
  state.session = { ...s!, user: { ...s!.user, gender } };
};

const post = (over: Record<string, string> = {}, id = TRIP) => {
  const r = send("POST", `/api/trips/${id}/request`);
  for (const [k, v] of Object.entries(over)) r.headers.set(k, v);
  return (request.POST as Handler)(r, idCtx(id));
};
const withdraw = (headers: Record<string, string> = {}, id = TRIP) => {
  const r = send("DELETE", `/api/trips/${id}/request`);
  for (const [k, v] of Object.entries(headers)) r.headers.set(k, v);
  return (request.DELETE as Handler)(r, idCtx(id));
};
const leave = (headers: Record<string, string> = {}, id = TRIP) => {
  const r = send("DELETE", `/api/trips/${id}/membership`);
  for (const [k, v] of Object.entries(headers)) r.headers.set(k, v);
  return (membership.DELETE as Handler)(r, idCtx(id));
};
const decide = (body: unknown, headers: Record<string, string> = {}, id = TRIP, userId = "applicant-1") => {
  const r = send("PATCH", `/api/organizer/trips/${id}/requests/${userId}`, body);
  for (const [k, v] of Object.entries(headers)) r.headers.set(k, v);
  return (orgDecide.PATCH as Handler)(r, decideCtx(id, userId));
};
const list = (id = TRIP) => (orgRequests.GET as Handler)(get(`/api/organizer/trips/${id}/requests`), idCtx(id));

const noWrites = () => {
  for (const n of ["createJoinRequest", "withdrawRequest", "leaveTrip", "approveRequest", "declineRequest"] as const) {
    expect(reqs[n]).not.toHaveBeenCalled();
  }
};

beforeEach(() => {
  reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00.000Z`));
  vi.stubEnv("BETTER_AUTH_URL", `${APP}/x`);
  for (const fn of Object.values(reqs)) fn.mockReset();
  reqs.loadJoinContext.mockResolvedValue(joinCtx());
  reqs.createJoinRequest.mockResolvedValue({ ok: true });
  reqs.withdrawRequest.mockResolvedValue(true);
  reqs.leaveTrip.mockResolvedValue(undefined);
  reqs.getTripOwner.mockResolvedValue("org-1");
  reqs.listTripPeople.mockResolvedValue({ pending: [], members: [] });
  reqs.approveRequest.mockResolvedValue({ ok: true, autoDeclined: 0 });
  reqs.declineRequest.mockResolvedValue(true);
  signIn();
});
afterEach(() => vi.useRealTimers());

describe("POST /api/trips/[id]/request", () => {
  it("creates a request and answers { ok, viewerState: requested, joined }", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, viewerState: "requested", joined: 2 });
    expect(reqs.createJoinRequest).toHaveBeenCalledTimes(1);
  });

  it("takes the user id from the session, never from the request", async () => {
    signIn("real-user");
    const r = send("POST", `/api/trips/${TRIP}/request?userId=evil`, { userId: "evil" });
    await (request.POST as Handler)(r, idCtx(TRIP));
    expect(reqs.loadJoinContext).toHaveBeenCalledWith(TRIP, "real-user");
    expect(reqs.createJoinRequest).toHaveBeenCalledWith(TRIP, "real-user", expect.objectContaining({ id: "real-user" }));
    expect(JSON.stringify(reqs.createJoinRequest.mock.calls)).not.toContain("evil");
  });

  it("401 without a session, before touching data", async () => {
    state.session = null;
    const res = await post();
    expect(res.status).toBe(401);
    expect(reqs.loadJoinContext).not.toHaveBeenCalled();
    noWrites();
  });

  it("403 for a foreign Origin, before the session is read or data touched", async () => {
    const res = await post({ origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(reqs.loadJoinContext).not.toHaveBeenCalled();
    noWrites();
  });

  it("404 for an id that is not a uuid, without querying", async () => {
    const res = await post({}, "not-a-uuid");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
    expect(reqs.loadJoinContext).not.toHaveBeenCalled();
    noWrites();
  });

  it("404 when the trip does not exist", async () => {
    reqs.loadJoinContext.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(404);
    noWrites();
  });

  it.each([
    ["own trip", { organizerId: "u-1" }, 400],
    ["cancelled trip", { status: "cancelled" }, 409],
    ["departed trip", { departureDate: "2026-11-18" }, 409],
    ["already a member", { isMember: true }, 409],
    ["pending request exists", { requestStatus: "pending" }, 409],
    ["declined request exists", { requestStatus: "declined" }, 409],
    ["full trip", { joined: 5 }, 409],
    ["full by status", { status: "full" }, 409],
    ["male-only trip for a female user", { tripGender: "male" }, 409],
  ])("refuses %s with %i and writes nothing", async (_n, over, status) => {
    reqs.loadJoinContext.mockResolvedValue(joinCtx(over));
    const res = await post();
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
    noWrites();
  });

  it("refuses a user with no gender on a single-gender trip", async () => {
    signIn("u-1", null);
    reqs.loadJoinContext.mockResolvedValue(joinCtx({ tripGender: "female" }));
    expect((await post()).status).toBe(409);
    noWrites();
  });

  it("accepts a user with no gender on a mixed trip", async () => {
    signIn("u-1", null);
    expect((await post()).status).toBe(200);
  });

  it("allows a request on the departure day itself", async () => {
    reqs.loadJoinContext.mockResolvedValue(joinCtx({ departureDate: TODAY }));
    expect((await post()).status).toBe(200);
  });

  it("maps a duplicate reported by the data layer to 409, not 500", async () => {
    reqs.createJoinRequest.mockResolvedValue({ ok: false, status: 409, error: "You already sent a request" });
    const res = await post();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "You already sent a request" });
  });

  it("an admin account can request like any user", async () => {
    const s = adminSession("admin-1");
    state.session = { ...s!, user: { ...s!.user, gender: "male" } };
    const res = await post();
    expect(res.status).toBe(200);
    expect(reqs.createJoinRequest).toHaveBeenCalledWith(TRIP, "admin-1", expect.objectContaining({ id: "admin-1" }));
  });
});

describe("DELETE /api/trips/[id]/request (withdraw)", () => {
  beforeEach(() => reqs.loadJoinContext.mockResolvedValue(joinCtx({ requestStatus: "pending" })));

  it("withdraws a pending request and answers { ok, viewerState: join, joined }", async () => {
    const res = await withdraw();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, viewerState: "join", joined: 2 });
    expect(reqs.withdrawRequest).toHaveBeenCalledWith(TRIP, "u-1", expect.objectContaining({ id: "u-1" }));
  });

  it("401 without a session", async () => {
    state.session = null;
    expect((await withdraw()).status).toBe(401);
    noWrites();
  });

  it("403 for a foreign Origin", async () => {
    expect((await withdraw({ origin: "https://evil.example" })).status).toBe(403);
    noWrites();
  });

  it("404 for a bad uuid", async () => {
    expect((await withdraw({}, "nope")).status).toBe(404);
    noWrites();
  });

  it.each([
    ["no request", { requestStatus: null }],
    ["a declined request", { requestStatus: "declined" }],
    ["an approved membership", { isMember: true, requestStatus: "approved" }],
  ])("409 when there is %s to withdraw", async (_n, over) => {
    reqs.loadJoinContext.mockResolvedValue(joinCtx(over));
    expect((await withdraw()).status).toBe(409);
    expect(reqs.withdrawRequest).not.toHaveBeenCalled();
  });

  it("409 when the data layer deleted nothing (it was decided meanwhile)", async () => {
    reqs.withdrawRequest.mockResolvedValue(false);
    expect((await withdraw()).status).toBe(409);
  });
});

describe("DELETE /api/trips/[id]/membership (leave)", () => {
  beforeEach(() => reqs.loadJoinContext.mockResolvedValue(joinCtx({ isMember: true, requestStatus: "approved", joined: 3 })));

  it("removes the caller and answers { ok, viewerState: join, joined: joined - 1 }", async () => {
    const res = await leave();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, viewerState: "join", joined: 2 });
    expect(reqs.leaveTrip).toHaveBeenCalledWith(TRIP, "u-1", expect.objectContaining({ id: "u-1" }));
  });

  it("takes the user id from the session", async () => {
    signIn("real-user");
    await leave();
    expect(reqs.leaveTrip).toHaveBeenCalledWith(TRIP, "real-user", expect.objectContaining({ id: "real-user" }));
  });

  it("401 without a session", async () => {
    state.session = null;
    expect((await leave()).status).toBe(401);
    noWrites();
  });

  it("403 for a foreign Origin", async () => {
    expect((await leave({ origin: "https://evil.example" })).status).toBe(403);
    noWrites();
  });

  it("404 for a bad uuid and for an unknown trip", async () => {
    expect((await leave({}, "nope")).status).toBe(404);
    reqs.loadJoinContext.mockResolvedValue(null);
    expect((await leave()).status).toBe(404);
    noWrites();
  });

  it("409 for someone who is not a member", async () => {
    reqs.loadJoinContext.mockResolvedValue(joinCtx({ isMember: false, requestStatus: "pending" }));
    expect((await leave()).status).toBe(409);
    noWrites();
  });

  it("409 after departure", async () => {
    reqs.loadJoinContext.mockResolvedValue(joinCtx({ isMember: true, departureDate: "2026-11-18" }));
    expect((await leave()).status).toBe(409);
    noWrites();
  });

  it("allows leaving on the departure day", async () => {
    reqs.loadJoinContext.mockResolvedValue(joinCtx({ isMember: true, departureDate: TODAY, joined: 1 }));
    expect((await leave()).status).toBe(200);
  });
});

describe("GET /api/organizer/trips/[id]/requests", () => {
  const person = (userId: string) => ({ userId, name: "Maria P.", image: null, age: 29, gender: "female" });
  beforeEach(() => signIn("org-1")); // the mocked trip owner

  it("lists pending requests and members with only userId, name, image, age, gender", async () => {
    reqs.listTripPeople.mockResolvedValue({ pending: [person("a")], members: [person("b")] });
    const res = await list();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pending).toHaveLength(1);
    expect(body.members).toHaveLength(1);
    for (const p of [...body.pending, ...body.members]) {
      expect(Object.keys(p).sort()).toEqual(["age", "gender", "image", "name", "userId"]);
    }
    expect(JSON.stringify(body)).not.toMatch(/email|phone|birth/i);
    expect(reqs.listTripPeople).toHaveBeenCalledWith(TRIP, TODAY);
  });

  it("404 for a trip that is not the caller's, without listing anything", async () => {
    reqs.getTripOwner.mockResolvedValue("somebody-else");
    const res = await list();
    expect(res.status).toBe(404);
    expect(reqs.listTripPeople).not.toHaveBeenCalled();
  });

  it("404 for an unknown trip and for a bad uuid", async () => {
    reqs.getTripOwner.mockResolvedValue(null);
    expect((await list()).status).toBe(404);
    expect((await list("nope")).status).toBe(404);
    expect(reqs.listTripPeople).not.toHaveBeenCalled();
  });

  it("an admin who is not the organizer gets 404 too", async () => {
    state.session = adminSession("admin-1");
    expect((await list()).status).toBe(404);
    expect(reqs.listTripPeople).not.toHaveBeenCalled();
  });

  it("401 without a session", async () => {
    state.session = null;
    expect((await list()).status).toBe(401);
    expect(reqs.getTripOwner).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/organizer/trips/[id]/requests/[userId]", () => {
  beforeEach(() => signIn("org-1"));

  it("approve: calls approveRequest(tripId, applicantId, today) and reports autoDeclined", async () => {
    reqs.approveRequest.mockResolvedValue({ ok: true, autoDeclined: 2 });
    const res = await decide({ action: "approve" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, autoDeclined: 2 });
    expect(reqs.approveRequest).toHaveBeenCalledWith(TRIP, "applicant-1", TODAY, expect.objectContaining({ id: "org-1" }));
    expect(reqs.declineRequest).not.toHaveBeenCalled();
  });

  it("approve refused because the trip is full: 409 with the data layer's message", async () => {
    reqs.approveRequest.mockResolvedValue({ ok: false, status: 409, error: "The trip is already full" });
    const res = await decide({ action: "approve" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "The trip is already full" });
  });

  it("approve refused because of the gender: 409 with its message", async () => {
    reqs.approveRequest.mockResolvedValue({ ok: false, status: 409, error: "This trip is for women only" });
    const res = await decide({ action: "approve" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "This trip is for women only" });
  });

  it("approve of a request that does not exist passes the data layer's 404 on", async () => {
    reqs.approveRequest.mockResolvedValue({ ok: false, status: 404, error: "Request not found" });
    expect((await decide({ action: "approve" })).status).toBe(404);
  });

  it("decline: calls declineRequest(tripId, applicantId) and answers ok", async () => {
    const res = await decide({ action: "decline" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(reqs.declineRequest).toHaveBeenCalledWith(TRIP, "applicant-1", expect.objectContaining({ id: "org-1" }));
    expect(reqs.approveRequest).not.toHaveBeenCalled();
  });

  it("decline of a request that is not pending: 409", async () => {
    reqs.declineRequest.mockResolvedValue(false);
    expect((await decide({ action: "decline" })).status).toBe(409);
  });

  it("not the organizer: 404 and nothing is decided", async () => {
    reqs.getTripOwner.mockResolvedValue("somebody-else");
    expect((await decide({ action: "approve" })).status).toBe(404);
    expect((await decide({ action: "decline" })).status).toBe(404);
    noWrites();
  });

  it("an admin who is not the organizer cannot decide", async () => {
    state.session = adminSession("admin-1");
    expect((await decide({ action: "approve" })).status).toBe(404);
    noWrites();
  });

  it("404 for a bad trip uuid or an unknown trip", async () => {
    expect((await decide({ action: "approve" }, {}, "nope")).status).toBe(404);
    reqs.getTripOwner.mockResolvedValue(null);
    expect((await decide({ action: "approve" })).status).toBe(404);
    noWrites();
  });

  it.each([{ action: "remove" }, { action: "" }, {}, { action: 1 }])("400 for the body %j", async (body) => {
    const res = await decide(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
    noWrites();
  });

  it("415 for a non-JSON body", async () => {
    const res = await decide({ action: "approve" }, { "content-type": "text/plain" });
    expect(res.status).toBe(415);
    noWrites();
  });

  it("403 for a foreign Origin, before anything else", async () => {
    const res = await decide({ action: "approve" }, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(reqs.getTripOwner).not.toHaveBeenCalled();
    noWrites();
  });

  it("401 without a session, before reading the body", async () => {
    state.session = null;
    const res = await decide({ action: "approve" });
    expect(res.status).toBe(401);
    expect(reqs.getTripOwner).not.toHaveBeenCalled();
    noWrites();
  });
});

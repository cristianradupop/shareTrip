import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, reset, state, userSession } from "../helpers";

const queries = vi.hoisted(() => ({
  getJoinerOverview: vi.fn(),
  getJoinerTrips: vi.fn(),
  getJoinerRequests: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
vi.mock("@/data/trips", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/data/trips")>()),
  getJoinerOverview: queries.getJoinerOverview,
  getJoinerTrips: queries.getJoinerTrips,
}));
vi.mock("@/data/requests", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/data/requests")>()),
  getJoinerRequests: queries.getJoinerRequests,
}));

const joinerRoutes = import.meta.glob("../../app/api/joiner/**/route.ts");
type Handler = (req: Request) => Promise<Response>;

async function loadRoute(endpoint: "overview" | "trips") {
  const key = `../../app/api/joiner/${endpoint}/route.ts`;
  const load = joinerRoutes[key];
  if (!load) {
    expect(load, `expected GET /api/joiner/${endpoint} to have a handler`).toBeTypeOf("function");
    throw new Error(`Missing Joiner read handler: ${endpoint}`);
  }
  return (await load()) as { GET: Handler };
}

const call = async (endpoint: "overview" | "trips", query = "") => {
  const route = await loadRoute(endpoint);
  return route.GET(get(`/api/joiner/${endpoint}${query}`));
};

const TRIP = {
  id: "trip-1",
  destinationCity: "Lisbon",
  destinationCountry: "Portugal",
  departureDate: "2027-03-05",
  returnDate: null,
  organizerName: "Ana P.",
  status: "active",
};

const requestRows = [
  { tripId: "trip-pending", status: "pending", destinationCity: "Rome" },
  { tripId: "trip-approved", status: "approved", destinationCity: "Oslo" },
  { tripId: "trip-declined", status: "declined", destinationCity: "Kyoto" },
];

beforeEach(() => {
  reset();
  state.session = userSession("session-user");
  queries.getJoinerOverview.mockReset().mockResolvedValue({
    trips: 0,
    requests: { pending: 0, approved: 0, declined: 0 },
  });
  queries.getJoinerTrips.mockReset().mockResolvedValue([]);
  queries.getJoinerRequests.mockReset().mockResolvedValue([]);
});

describe("GET /api/joiner/overview", () => {
  it("returns empty trip and request counts for the signed-in joiner", async () => {
    const res = await call("overview");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      overview: { trips: 0, requests: { pending: 0, approved: 0, declined: 0 } },
    });
    expect(queries.getJoinerOverview).toHaveBeenCalledWith("session-user");
  });

  it("returns populated counts using the session user, not a supplied userId", async () => {
    queries.getJoinerOverview.mockResolvedValue({
      trips: 2,
      requests: { pending: 1, approved: 3, declined: 2 },
    });

    const res = await call("overview", "?userId=other-user");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      overview: { trips: 2, requests: { pending: 1, approved: 3, declined: 2 } },
    });
    expect(queries.getJoinerOverview).toHaveBeenCalledTimes(1);
    expect(queries.getJoinerOverview).toHaveBeenCalledWith("session-user");
    expect(JSON.stringify(queries.getJoinerOverview.mock.calls)).not.toContain("other-user");
  });

  it("returns 401 before querying when there is no session", async () => {
    state.session = null;

    const res = await call("overview");

    expect(res.status).toBe(401);
    expect(queries.getJoinerOverview).not.toHaveBeenCalled();
  });
});

describe("GET /api/joiner/trips", () => {
  it("returns empty memberships and requests for a joiner with no activity", async () => {
    const res = await call("trips");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ trips: [], requests: [] });
    expect(queries.getJoinerTrips).toHaveBeenCalledWith("session-user");
    expect(queries.getJoinerRequests).toHaveBeenCalledWith("session-user");
  });

  it("lists approved memberships and requests in every status, scoped to the session user", async () => {
    queries.getJoinerTrips.mockResolvedValue([TRIP]);
    queries.getJoinerRequests.mockResolvedValue(requestRows);

    const res = await call("trips", "?userId=other-user");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trips).toEqual([TRIP]);
    expect(body.requests).toEqual(requestRows);
    expect(body.requests.map((request: { status: string }) => request.status)).toEqual([
      "pending",
      "approved",
      "declined",
    ]);
    expect(queries.getJoinerTrips).toHaveBeenCalledTimes(1);
    expect(queries.getJoinerTrips).toHaveBeenCalledWith("session-user");
    expect(queries.getJoinerRequests).toHaveBeenCalledTimes(1);
    expect(queries.getJoinerRequests).toHaveBeenCalledWith("session-user");
    expect(JSON.stringify([...queries.getJoinerTrips.mock.calls, ...queries.getJoinerRequests.mock.calls])).not.toContain(
      "other-user",
    );
  });

  it("returns 401 before querying when there is no session", async () => {
    state.session = null;

    const res = await call("trips");

    expect(res.status).toBe(401);
    expect(queries.getJoinerTrips).not.toHaveBeenCalled();
    expect(queries.getJoinerRequests).not.toHaveBeenCalled();
  });
});

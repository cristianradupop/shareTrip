import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../test/helpers")).dbModule());

import { state, reset } from "../test/helpers";
import { getOrganizerStats, toFeedTrip, updateOrganizerTrip } from "./trips";

const ALLOWED_KEYS = [
  "id",
  "city",
  "country",
  "departureDate",
  "returnDate",
  "budget",
  "currency",
  "transport",
  "gender",
  "theme",
  "maxTravelers",
  "status",
  "createdAt",
  "joined",
  "organizerName",
  "organizerImage",
  "photoUrl",
].sort();

const row = {
  id: "t1",
  city: "Lisbon",
  country: "Portugal",
  departureDate: "2027-03-05",
  returnDate: null,
  budget: "500",
  currency: "EUR",
  transport: "plane",
  gender: "mixed",
  theme: "x",
  maxTravelers: 4,
  status: "active" as const,
  createdAt: new Date("2026-11-19T10:00:00.000Z"),
  cursorKey: "2026-11-19T10:00:00.000000",
  joined: 2,
  organizerName: "Ana P.",
  organizerImage: null,
  photoUrl: null as string | null,
  email: "ana@test.dev",
  organizerId: "user-1",
  // Viewer columns the query selects only when a viewer is given. Assumed row shape:
  isMember: false,
  requestStatus: null as "pending" | "approved" | "declined" | null,
};

type Row = Parameters<typeof toFeedTrip>[0];
const viewer = { id: "user-9", gender: "female" as "male" | "female" | null };

describe("toFeedTrip", () => {
  it("returns exactly the allowed FeedTrip keys, dropping extra columns", () => {
    // Extra columns are passed on purpose; the cast only bypasses the compile-time row type.
    const out = toFeedTrip(row as Parameters<typeof toFeedTrip>[0]);
    expect(Object.keys(out).sort()).toEqual(ALLOWED_KEYS);
    expect(out).not.toHaveProperty("email");
    expect(out).not.toHaveProperty("organizerId");
    expect(out).not.toHaveProperty("cursorKey");
  });

  it("never adds viewerState without a viewer, even if the row carries viewer columns", () => {
    const out = toFeedTrip({ ...row, isMember: true, requestStatus: "pending" } as Row);
    expect(Object.keys(out).sort()).toEqual(ALLOWED_KEYS);
    expect(out).not.toHaveProperty("viewerState");
    expect(out).not.toHaveProperty("isMember");
    expect(out).not.toHaveProperty("requestStatus");
  });

  it("with a viewer returns the allowed keys plus viewerState, and no raw viewer columns", () => {
    const out = toFeedTrip(row as Row, viewer);
    expect(Object.keys(out).sort()).toEqual([...ALLOWED_KEYS, "viewerState"].sort());
    expect(out).not.toHaveProperty("isMember");
    expect(out).not.toHaveProperty("requestStatus");
    expect(out).not.toHaveProperty("email");
  });

  it.each([
    ["nothing applies", {}, viewer, "join"],
    ["member", { isMember: true }, viewer, "joined"],
    ["pending request", { requestStatus: "pending" }, viewer, "requested"],
    ["declined request", { requestStatus: "declined" }, viewer, "declined"],
    ["full by count", { joined: 3 }, viewer, "full"],
    ["full by status", { status: "full" }, viewer, "full"],
    ["male-only trip, female viewer", { gender: "male" }, viewer, "wrong_gender"],
    ["male-only trip, null gender", { gender: "male" }, { id: "user-9", gender: null }, "wrong_gender"],
    ["mixed trip, null gender", {}, { id: "user-9", gender: null }, "join"],
    ["member of a full trip", { isMember: true, joined: 3 }, viewer, "joined"],
  ])("viewerState: %s -> %s", (_n, over, v, expected) => {
    expect(toFeedTrip({ ...row, ...over } as Row, v).viewerState).toBe(expected);
  });

  it("serialises createdAt to ISO and maps a cancelled status to active", () => {
    const out = toFeedTrip({ ...row, status: "cancelled" } as Parameters<typeof toFeedTrip>[0]);
    expect(out.createdAt).toBe("2026-11-19T10:00:00.000Z");
    expect(out.status).toBe("active");
  });
});

describe("getOrganizerStats", () => {
  it("includes pendingRequests: 0 in the empty fallback", async () => {
    reset();
    state.result = [];
    expect(await getOrganizerStats("user-1")).toEqual({ trips: 0, participants: 0, upcoming: 0, pendingRequests: 0 });
  });
});

describe("toFeedTrip photoUrl", () => {
  it("passes photoUrl through, null or set", () => {
    expect(toFeedTrip(row as Row).photoUrl).toBeNull();
    const url = "https://abc.supabase.co/storage/v1/object/public/b/trips/a.jpg";
    expect(toFeedTrip({ ...row, photoUrl: url } as Row).photoUrl).toBe(url);
  });
});

describe("updateOrganizerTrip", () => {
  const t = {
    destinationCity: "Mirissa",
    destinationCountry: "Sri Lanka",
    departureDate: "2099-03-05",
    returnDate: "",
    maxTravelers: 4,
    gender: "mixed" as const,
    budgetEstimate: 900,
    currency: "EUR" as const,
    transport: "plane" as const,
    theme: "Whales, beaches and surf.",
  };
  const actor = { id: "org-1", name: "Olga", role: "user" as const };
  const before = (photoUrl: string | null) => ({ id: "t1", organizerId: "org-1", status: "active", photoUrl, ...t, budgetEstimate: "900.00", returnDate: null });

  it("returns null when no editable trip matched", async () => {
    reset();
    state.result = [];
    expect(await updateOrganizerTrip("t1", "org-1", t, actor)).toBeNull();
    expect(state.sets).toHaveLength(0);
  });

  it("returns the previous photo URL and leaves photoUrl out of the set when none is given", async () => {
    reset();
    state.result = [before("https://x.test/trips/old.jpg")];
    expect(await updateOrganizerTrip("t1", "org-1", t, actor)).toEqual({ previousPhotoUrl: "https://x.test/trips/old.jpg" });
    expect(state.sets[0] as object).not.toHaveProperty("photoUrl");
  });

  it("sets photoUrl when one is given and reports a null previous URL", async () => {
    reset();
    state.result = [before(null)];
    expect(await updateOrganizerTrip("t1", "org-1", t, actor, "https://x.test/trips/new.jpg")).toEqual({ previousPhotoUrl: null });
    expect(state.sets[0]).toMatchObject({ photoUrl: "https://x.test/trips/new.jpg" });
  });
});

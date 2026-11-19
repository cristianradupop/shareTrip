import { describe, expect, it } from "vitest";
import {
  ageOn,
  checkCanApprove,
  checkCanLeave,
  checkCanRequest,
  fillsLastSeat,
  genderAllows,
  isTripFull,
  viewerJoinState,
} from "./join-rules";

// Pure module: no mocks. Assumed context shape (the plan leaves it open):
//   JoinContext = { organizerId, status: "active"|"full"|"cancelled", departureDate: "YYYY-MM-DD", maxTravelers,
//                   tripGender: "male"|"female"|"mixed", joined (approved members, organizer NOT counted),
//                   isMember: boolean, requestStatus: "pending"|"approved"|"declined"|null }
// Results: { ok: true } | { ok: false, status: number, error: string }.
const TODAY = "2026-11-19";

const ctx = (over: Record<string, unknown> = {}) => ({
  organizerId: "org-1",
  status: "active" as const,
  departureDate: "2026-12-24",
  maxTravelers: 4,
  tripGender: "mixed" as const,
  joined: 1,
  isMember: false,
  requestStatus: null,
  ...over,
});
const asUser = (over: Record<string, unknown> = {}) => ({ id: "u-1", gender: "female" as const, ...over });

describe("isTripFull", () => {
  it.each([
    ["empty trip", { status: "active", joined: 0, maxTravelers: 4 }, false],
    ["two seats left", { status: "active", joined: 1, maxTravelers: 4 }, false],
    ["one seat left", { status: "active", joined: 2, maxTravelers: 4 }, false],
    ["organizer + members = max", { status: "active", joined: 3, maxTravelers: 4 }, true],
    ["more members than seats", { status: "active", joined: 5, maxTravelers: 4 }, true],
    ["max 2 with one member", { status: "active", joined: 1, maxTravelers: 2 }, true],
    ["status full wins", { status: "full", joined: 0, maxTravelers: 4 }, true],
    ["cancelled is not 'full'", { status: "cancelled", joined: 0, maxTravelers: 4 }, false],
  ])("%s", (_n, trip, expected) => {
    expect(isTripFull(trip as Parameters<typeof isTripFull>[0])).toBe(expected);
  });
});

describe("genderAllows(tripGender, userGender)", () => {
  it.each([
    ["mixed", "male", true],
    ["mixed", "female", true],
    ["mixed", null, true],
    ["male", "male", true],
    ["male", "female", false],
    ["male", null, false],
    ["female", "female", true],
    ["female", "male", false],
    ["female", null, false],
  ])("trip %s, user %s -> %s", (trip, userG, expected) => {
    expect(genderAllows(trip as "male", userG as "male" | null)).toBe(expected);
  });
});

describe("ageOn(birthDate, today)", () => {
  it.each([
    ["1995-04-12", "2026-11-19", 31],
    ["1995-11-19", "2026-11-19", 31], // birthday today
    ["1995-11-20", "2026-11-19", 30], // birthday tomorrow
    ["1995-12-31", "2026-11-19", 30],
    ["2000-02-29", "2026-02-28", 25], // leap-day birth, day before the anniversary
    ["2008-11-19", "2026-11-19", 18],
  ])("born %s on %s is %i", (born, today, age) => {
    expect(ageOn(born, today)).toBe(age);
  });
});

describe("viewerJoinState precedence: joined > requested > declined > full > wrong_gender > join", () => {
  const base = { isMember: false, requestStatus: null, full: false, tripGender: "mixed", userGender: "female" };
  const state = (over: Record<string, unknown>) =>
    viewerJoinState({ ...base, ...over } as Parameters<typeof viewerJoinState>[0]);

  it("join when nothing applies", () => expect(state({})).toBe("join"));
  it("joined for a member", () => expect(state({ isMember: true })).toBe("joined"));
  it("requested for a pending request", () => expect(state({ requestStatus: "pending" })).toBe("requested"));
  it("declined for a declined request", () => expect(state({ requestStatus: "declined" })).toBe("declined"));
  it("full for a full trip", () => expect(state({ full: true })).toBe("full"));
  it("wrong_gender when the trip is single-gender and it does not match", () =>
    expect(state({ tripGender: "male", userGender: "female" })).toBe("wrong_gender"));
  it("wrong_gender for a null gender on a single-gender trip", () =>
    expect(state({ tripGender: "female", userGender: null })).toBe("wrong_gender"));
  it("join for a null gender on a mixed trip", () => expect(state({ userGender: null })).toBe("join"));

  it("joined beats everything", () =>
    expect(
      state({ isMember: true, requestStatus: "pending", full: true, tripGender: "male", userGender: "female" }),
    ).toBe("joined"));
  it("requested beats declined-less full and wrong gender", () =>
    expect(state({ requestStatus: "pending", full: true, tripGender: "male", userGender: "female" })).toBe("requested"));
  it("declined beats full and wrong gender", () =>
    expect(state({ requestStatus: "declined", full: true, tripGender: "male", userGender: "female" })).toBe("declined"));
  it("full beats wrong gender", () =>
    expect(state({ full: true, tripGender: "male", userGender: "female" })).toBe("full"));
});

describe("checkCanRequest(ctx, user, today)", () => {
  it("allows a normal request", () => {
    expect(checkCanRequest(ctx(), asUser(), TODAY)).toEqual({ ok: true });
  });

  it.each([
    ["own trip", ctx({ organizerId: "u-1" }), 400],
    ["own trip beats cancelled", ctx({ organizerId: "u-1", status: "cancelled" }), 400],
    ["cancelled trip", ctx({ status: "cancelled" }), 409],
    ["departed yesterday", ctx({ departureDate: "2026-11-18" }), 409],
    ["already a member", ctx({ isMember: true }), 409],
    ["pending request exists", ctx({ requestStatus: "pending" }), 409],
    ["declined request exists", ctx({ requestStatus: "declined" }), 409],
    ["full by count", ctx({ joined: 3, maxTravelers: 4 }), 409],
    ["full by status", ctx({ status: "full" }), 409],
    ["male-only trip, female user", ctx({ tripGender: "male" }), 409],
  ])("refuses: %s -> %i", (_n, c, status) => {
    const r = checkCanRequest(c, asUser(), TODAY);
    expect(r).toMatchObject({ ok: false, status });
    expect((r as { error: string }).error).toEqual(expect.any(String));
    expect((r as { error: string }).error.length).toBeGreaterThan(0);
  });

  it("refuses a null gender on a single-gender trip", () => {
    expect(checkCanRequest(ctx({ tripGender: "female" }), asUser({ gender: null }), TODAY)).toMatchObject({ ok: false, status: 409 });
  });

  it("accepts a null gender on a mixed trip", () => {
    expect(checkCanRequest(ctx(), asUser({ gender: null }), TODAY)).toEqual({ ok: true });
  });

  it("accepts a matching single-gender trip", () => {
    expect(checkCanRequest(ctx({ tripGender: "female" }), asUser(), TODAY)).toEqual({ ok: true });
  });

  it("allows a request on the departure day itself (today boundary)", () => {
    expect(checkCanRequest(ctx({ departureDate: TODAY }), asUser(), TODAY)).toEqual({ ok: true });
  });

  it("uses the given today, not the clock", () => {
    expect(checkCanRequest(ctx({ departureDate: "2026-12-24" }), asUser(), "2026-12-25")).toMatchObject({ ok: false, status: 409 });
    expect(checkCanRequest(ctx({ departureDate: "2026-12-24" }), asUser(), "2026-12-24")).toEqual({ ok: true });
  });
});

describe("checkCanApprove(ctx, applicantGender, today)", () => {
  it("approves when there is room and the gender matches", () => {
    expect(checkCanApprove(ctx({ requestStatus: "pending" }), "female", TODAY)).toEqual({ ok: true });
  });

  it("approves a null gender on a mixed trip", () => {
    expect(checkCanApprove(ctx({ requestStatus: "pending" }), null, TODAY)).toEqual({ ok: true });
  });

  it("refuses a cancelled trip with 409", () => {
    const r = checkCanApprove(ctx({ requestStatus: "pending", status: "cancelled" }), "female", TODAY);
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect((r as { error: string }).error.length).toBeGreaterThan(0);
  });

  it("refuses a full trip with 409 and a message", () => {
    const r = checkCanApprove(ctx({ requestStatus: "pending", joined: 3 }), "female", TODAY);
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect((r as { error: string }).error.length).toBeGreaterThan(0);
  });

  it("refuses a full trip by status", () => {
    expect(checkCanApprove(ctx({ requestStatus: "pending", status: "full" }), "female", TODAY)).toMatchObject({ ok: false, status: 409 });
  });

  it.each([
    ["male-only trip, female applicant", "male", "female"],
    ["female-only trip, male applicant", "female", "male"],
    ["female-only trip, null gender", "female", null],
  ])("refuses a gender mismatch: %s", (_n, tripGender, applicant) => {
    const r = checkCanApprove(ctx({ requestStatus: "pending", tripGender }), applicant as "male" | null, TODAY);
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect((r as { error: string }).error.length).toBeGreaterThan(0);
  });
});

describe("checkCanLeave(ctx, today)", () => {
  it("lets a member leave before departure", () => {
    expect(checkCanLeave(ctx({ isMember: true }), TODAY)).toEqual({ ok: true });
  });

  it("lets a member leave on the departure day (boundary)", () => {
    expect(checkCanLeave(ctx({ isMember: true, departureDate: TODAY }), TODAY)).toEqual({ ok: true });
  });

  it("refuses after departure with 409", () => {
    expect(checkCanLeave(ctx({ isMember: true, departureDate: "2026-11-18" }), TODAY)).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses a non-member with 409", () => {
    expect(checkCanLeave(ctx({ isMember: false }), TODAY)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("fillsLastSeat(joinedAfter, max)", () => {
  it.each([
    [0, 4, false],
    [2, 4, false],
    [3, 4, true], // organizer + 3 members = 4
    [4, 4, true],
    [1, 2, true],
    [0, 2, false],
  ])("joinedAfter %i, max %i -> %s", (joinedAfter, max, expected) => {
    expect(fillsLastSeat(joinedAfter, max)).toBe(expected);
  });
});

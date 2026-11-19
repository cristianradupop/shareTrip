import { describe, expect, it } from "vitest";
import type { FeedTrip } from "server-app/shared";
import { joinActionView } from "./join-action";

// Contract assumed:
//   joinActionView(trip: FeedTrip): {
//     label: string; disabled: boolean;
//     href: string | null;                       // set only for the logged-out Join link
//     secondary: "withdraw" | "leave" | null;
//     reason: string | null;                     // set only for wrong_gender
//   }
const trip = (o: Record<string, unknown> = {}): FeedTrip =>
  ({
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
    createdAt: "2026-11-19T10:00:00.000Z",
    joined: 0,
    organizerName: "Ana P.",
    organizerImage: null,
    status: "active",
    ...o,
  }) as FeedTrip;

describe("joinActionView without a session (no viewerState)", () => {
  it("links Join to the login page with an encoded next", () => {
    const v = joinActionView(trip());
    expect(v.label).toBe("Join");
    expect(v.disabled).toBe(false);
    expect(v.href).toBe("/login?next=%2F%23trips");
    expect(v.secondary).toBeNull();
  });

  it("shows a disabled Full when the trip is full by status", () => {
    const v = joinActionView(trip({ status: "full" }));
    expect(v.label).toBe("Full");
    expect(v.disabled).toBe(true);
    expect(v.href).toBeNull();
  });

  it("shows a disabled Full when joined + 1 reaches maxTravelers", () => {
    const v = joinActionView(trip({ joined: 3, maxTravelers: 4 }));
    expect(v.label).toBe("Full");
    expect(v.disabled).toBe(true);
  });
});

describe("joinActionView with a viewerState", () => {
  it("join: an enabled Join that is not a link (opens the confirm dialog)", () => {
    const v = joinActionView(trip({ viewerState: "join" }));
    expect(v.label).toBe("Join");
    expect(v.disabled).toBe(false);
    expect(v.href).toBeNull();
    expect(v.secondary).toBeNull();
  });

  it("requested: Requested with a Withdraw secondary", () => {
    const v = joinActionView(trip({ viewerState: "requested" }));
    expect(v.label).toBe("Requested");
    expect(v.secondary).toBe("withdraw");
    expect(v.href).toBeNull();
  });

  it("joined: Joined with a Leave secondary", () => {
    const v = joinActionView(trip({ viewerState: "joined" }));
    expect(v.label).toBe("Joined");
    expect(v.secondary).toBe("leave");
    expect(v.href).toBeNull();
  });

  it("declined: disabled Declined, no secondary", () => {
    const v = joinActionView(trip({ viewerState: "declined" }));
    expect(v.label).toBe("Declined");
    expect(v.disabled).toBe(true);
    expect(v.secondary).toBeNull();
  });

  it("full: disabled Full", () => {
    const v = joinActionView(trip({ viewerState: "full" }));
    expect(v.label).toBe("Full");
    expect(v.disabled).toBe(true);
    expect(v.secondary).toBeNull();
  });

  it("wrong_gender on a male trip: disabled with a Men only reason", () => {
    const v = joinActionView(trip({ viewerState: "wrong_gender", gender: "male" }));
    expect(v.disabled).toBe(true);
    expect(v.reason).toMatch(/men only/i);
    expect(v.reason).not.toMatch(/women/i);
  });

  it("wrong_gender on a female trip: disabled with a Women only reason", () => {
    const v = joinActionView(trip({ viewerState: "wrong_gender", gender: "female" }));
    expect(v.disabled).toBe(true);
    expect(v.reason).toMatch(/women only/i);
  });

  it("has no reason for the other states", () => {
    for (const s of ["join", "requested", "joined", "declined", "full"]) {
      expect(joinActionView(trip({ viewerState: s })).reason).toBeNull();
    }
  });
});

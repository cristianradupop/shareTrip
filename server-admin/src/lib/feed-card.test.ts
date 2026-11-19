import { describe, expect, it } from "vitest";
import type { FeedTrip } from "server-app/shared";
import { feedCardView } from "./feed-card";

const base: FeedTrip = {
  id: "t1",
  city: "Lisbon",
  country: "Portugal",
  departureDate: "2027-03-05",
  returnDate: "2027-03-12",
  budget: "500.00",
  currency: "EUR",
  transport: "plane",
  gender: "mixed",
  theme: "Surfing",
  maxTravelers: 4,
  createdAt: "2026-11-19T10:00:00.000Z",
  joined: 1,
  organizerName: "Ana P.",
  organizerImage: null,
  status: "active",
};
const trip = (o: Partial<FeedTrip> = {}): FeedTrip => ({ ...base, ...o });

describe("feedCardView seats", () => {
  it("counts the organizer as a taken seat", () => {
    const v = feedCardView(trip({ joined: 1, maxTravelers: 4 }));
    expect(v.seatsTaken).toBe(2);
    expect(v.seatsTotal).toBe(4);
    expect(v.spotsLeft).toBe(2);
    expect(v.fillPercent).toBe(50);
    expect(v.isFull).toBe(false);
  });

  it("is full when every seat is taken, even with status active", () => {
    const v = feedCardView(trip({ joined: 3, maxTravelers: 4, status: "active" }));
    expect(v.isFull).toBe(true);
    expect(v.spotsLeft).toBe(0);
    expect(v.fillPercent).toBe(100);
  });

  it("is full when the status is full, even with free seats", () => {
    const v = feedCardView(trip({ joined: 0, maxTravelers: 4, status: "full" }));
    expect(v.isFull).toBe(true);
  });

  it("clamps fillPercent to 0-100 and spotsLeft to 0 when over-booked", () => {
    const v = feedCardView(trip({ joined: 9, maxTravelers: 4 }));
    expect(v.fillPercent).toBe(100);
    expect(v.spotsLeft).toBe(0);
    expect(feedCardView(trip({ joined: -5, maxTravelers: 4 })).fillPercent).toBe(0);
  });

  it("does not divide by zero", () => {
    const v = feedCardView(trip({ joined: 0, maxTravelers: 0 }));
    expect(Number.isFinite(v.fillPercent)).toBe(true);
    expect(v.fillPercent).toBeGreaterThanOrEqual(0);
    expect(v.fillPercent).toBeLessThanOrEqual(100);
  });
});

describe("feedCardView transport", () => {
  it.each(["plane", "car", "bus", "train", "ship", "other"])("uses the key %s for that transport", (t) => {
    const v = feedCardView(trip({ transport: t }));
    expect(v.icon).toBe(t);
    expect(v.gradient).toEqual(expect.stringMatching(/\S/));
  });

  it("falls back to the 'other' icon and a gradient for an unknown transport", () => {
    const v = feedCardView(trip({ transport: "teleporter" }));
    expect(v.icon).toBe("other");
    expect(v.gradient).toEqual(expect.stringMatching(/\S/));
  });

  it("uses different gradients for plane and car", () => {
    expect(feedCardView(trip({ transport: "plane" })).gradient).not.toBe(feedCardView(trip({ transport: "car" })).gradient);
  });
});

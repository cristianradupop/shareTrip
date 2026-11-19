import { describe, expect, it } from "vitest";
import type { OrganizerTrip } from "server-app/shared";
import { toTripFormValues } from "./trip-form";

const trip: OrganizerTrip = {
  id: "t1",
  organizerId: "u1",
  destinationCity: "Mirissa",
  destinationCountry: "Sri Lanka",
  departureDate: "2027-03-05",
  returnDate: "2027-03-12",
  budgetEstimate: "1200.00",
  currency: "EUR",
  transport: "plane",
  gender: "mixed",
  theme: "Whales, beaches and surf.",
  maxTravelers: 6,
  status: "active",
  createdAt: "2026-11-01T10:00:00.000Z",
  joined: 2,
};

describe("toTripFormValues", () => {
  it("maps every form field and keeps budget and currency strings", () => {
    const v = toTripFormValues(trip);
    expect(v).toMatchObject({
      destinationCity: "Mirissa",
      destinationCountry: "Sri Lanka",
      departureDate: "2027-03-05",
      returnDate: "2027-03-12",
      budgetEstimate: "1200.00",
      currency: "EUR",
      transport: "plane",
      gender: "mixed",
      theme: "Whales, beaches and surf.",
    });
    expect(Number(v.maxTravelers)).toBe(6);
  });

  it("maps a null return date to an empty string", () => {
    expect(toTripFormValues({ ...trip, returnDate: null }).returnDate).toBe("");
  });

  it("does not leak non-form fields", () => {
    expect(Object.keys(toTripFormValues(trip))).not.toEqual(expect.arrayContaining(["id", "organizerId", "status"]));
  });
});

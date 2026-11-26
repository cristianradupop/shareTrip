import { describe, expect, it } from "vitest";
import type { OrganizerTrip } from "server-app/shared";
import { photoFileError, toTripFormData, toTripFormValues } from "./trip-form";

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
  pending: 0,
  photoUrl: null,
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

describe("toTripFormData", () => {
  const TRIP_FIELDS = [
    "destinationCity",
    "destinationCountry",
    "departureDate",
    "returnDate",
    "maxTravelers",
    "gender",
    "budgetEstimate",
    "currency",
    "transport",
    "theme",
  ];
  const values = toTripFormValues(trip);
  const jpg = new File([new Uint8Array([0xff, 0xd8, 0xff])], "c.jpg", { type: "image/jpeg" });

  it("contains every trip field as a string", () => {
    const f = toTripFormData(values, null);
    for (const k of TRIP_FIELDS) expect(typeof f.get(k)).toBe("string");
    expect(f.get("destinationCity")).toBe("Mirissa");
    expect(f.get("maxTravelers")).toBe("6");
    expect(f.get("budgetEstimate")).toBe("1200.00");
  });

  it("sends an empty string when returnDate is undefined", () => {
    const f = toTripFormData({ ...values, returnDate: undefined }, null);
    expect(f.get("returnDate")).toBe("");
  });

  it("adds photo only when one is given", () => {
    expect(toTripFormData(values, null).has("photo")).toBe(false);
    const f = toTripFormData(values, jpg);
    expect(f.get("photo")).toBeInstanceOf(File);
  });

  it("carries no field besides the trip fields and photo", () => {
    expect([...toTripFormData(values, jpg).keys()].sort()).toEqual([...TRIP_FIELDS, "photo"].sort());
  });
});

describe("photoFileError", () => {
  it("returns null for a JPG or PNG up to 2 MB", () => {
    expect(photoFileError({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(photoFileError({ type: "image/png", size: 2 * 1024 * 1024 })).toBeNull();
  });

  it("returns a message for another type", () => {
    expect(photoFileError({ type: "image/gif", size: 1000 })).toEqual(expect.any(String));
    expect(photoFileError({ type: "", size: 1000 })).toEqual(expect.any(String));
  });

  it("returns a message for a file over 2 MB", () => {
    expect(photoFileError({ type: "image/jpeg", size: 2 * 1024 * 1024 + 1 })).toEqual(expect.any(String));
  });
});

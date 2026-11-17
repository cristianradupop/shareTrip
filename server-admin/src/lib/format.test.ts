import { describe, expect, it } from "vitest";
import { formatDateRange, formatMoney, initials } from "./format";

describe("formatDateRange", () => {
  it("shows a single date when there is no return or it equals departure", () => {
    expect(formatDateRange("2027-03-05")).toBe("Mar 5, 2027");
    expect(formatDateRange("2027-03-05", null)).toBe("Mar 5, 2027");
    expect(formatDateRange("2027-03-05", "2027-03-05")).toBe("Mar 5, 2027");
  });

  it("collapses month and year when they match", () => {
    expect(formatDateRange("2027-03-05", "2027-03-12")).toBe("Mar 5 – 12, 2027");
  });

  it("collapses only the year when months differ", () => {
    expect(formatDateRange("2027-03-28", "2027-04-04")).toBe("Mar 28 – Apr 4, 2027");
  });

  it("shows both years when the trip crosses new year", () => {
    expect(formatDateRange("2027-12-28", "2028-01-03")).toBe("Dec 28, 2027 – Jan 3, 2028");
  });

  it("does not shift the day across time zones (UTC formatting)", () => {
    expect(formatDateRange("2027-01-01")).toBe("Jan 1, 2027");
  });
});

describe("formatMoney", () => {
  it("formats whole units without decimals", () => {
    expect(formatMoney("1250.40", "EUR")).toBe("€1,250");
    expect(formatMoney(800, "USD")).toBe("$800");
  });
});

describe("initials", () => {
  it("uppercases the first letters and tolerates empty names", () => {
    expect(initials("alex", "popescu")).toBe("AP");
    expect(initials("", "popescu")).toBe("P");
  });
});

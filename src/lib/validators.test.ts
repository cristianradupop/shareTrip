import { describe, expect, it } from "vitest";
import { adminCreateUserSchema, loginSchema, signUpSchema, tripSchema } from "./validators";

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

const validSignUp = {
  username: "alex.popescu",
  password: "Demo-Pass-123!",
  firstName: "Alex",
  lastName: "Popescu",
  email: "alex@demo.test",
  phone: "+40 721 000 111",
  address: "Str. Exemplu 1, Cluj",
  birthDate: "1995-04-12",
};

const validTrip = {
  destinationCity: "Lisbon",
  destinationCountry: "Portugal",
  departureDate: iso(30),
  returnDate: iso(37),
  maxTravelers: "6",
  gender: "mixed",
  budgetEstimate: "800",
  currency: "EUR",
  transport: "plane",
  theme: "Surf, food and sunsets for a week.",
};

const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.error?.issues.map((i) => `${i.path.join(".")}: ${i.message}`) ?? [];

describe("signUpSchema", () => {
  it("accepts a valid account", () => {
    expect(signUpSchema.safeParse(validSignUp).success).toBe(true);
  });

  it.each([
    ["too short", "Aa1"],
    ["no uppercase", "lowercase-only-1"],
    ["no lowercase", "UPPERCASE-ONLY-1"],
    ["no digit", "No-Digits-Here-Ever"],
  ])("rejects a password that is %s", (_label, password) => {
    const r = signUpSchema.safeParse({ ...validSignUp, password });
    expect(r.success).toBe(false);
    expect(issues(r).some((m) => m.startsWith("password"))).toBe(true);
  });

  it("rejects a username with forbidden characters", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, username: "bad name!" }).success).toBe(false);
  });

  it("rejects a birth date that is today or in the future", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, birthDate: iso(0) }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...validSignUp, birthDate: iso(10) }).success).toBe(false);
  });

  it("trims names and rejects blank ones", () => {
    const ok = signUpSchema.safeParse({ ...validSignUp, firstName: "  Alex  " });
    expect(ok.success && ok.data.firstName).toBe("Alex");
    expect(signUpSchema.safeParse({ ...validSignUp, lastName: "   " }).success).toBe(false);
  });

  it("rejects an invalid email and phone", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, email: "not-an-email" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...validSignUp, phone: "abc" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires identifier and password", () => {
    expect(loginSchema.safeParse({ identifier: "alex", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ identifier: "", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: "alex", password: "" }).success).toBe(false);
  });
});

describe("tripSchema", () => {
  it("accepts a valid trip and coerces numbers from form strings", () => {
    const r = tripSchema.safeParse(validTrip);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.maxTravelers).toBe(6);
      expect(r.data.budgetEstimate).toBe(800);
    }
  });

  it("accepts an empty return date (one-way / undecided)", () => {
    expect(tripSchema.safeParse({ ...validTrip, returnDate: "" }).success).toBe(true);
  });

  it("rejects a departure in the past", () => {
    expect(tripSchema.safeParse({ ...validTrip, departureDate: iso(-1), returnDate: "" }).success).toBe(false);
  });

  it("rejects a return date before departure, reported on returnDate", () => {
    const r = tripSchema.safeParse({ ...validTrip, returnDate: iso(20) });
    expect(r.success).toBe(false);
    expect(issues(r)).toContain("returnDate: Return must be on or after departure");
  });

  it.each(["1", "51", "2.5", "abc"])("rejects maxTravelers = %s", (maxTravelers) => {
    expect(tripSchema.safeParse({ ...validTrip, maxTravelers }).success).toBe(false);
  });

  it("rejects a non-positive budget and unknown enums", () => {
    expect(tripSchema.safeParse({ ...validTrip, budgetEstimate: "0" }).success).toBe(false);
    expect(tripSchema.safeParse({ ...validTrip, currency: "GBP" }).success).toBe(false);
    expect(tripSchema.safeParse({ ...validTrip, gender: "other" }).success).toBe(false);
    expect(tripSchema.safeParse({ ...validTrip, transport: "rocket" }).success).toBe(false);
  });

  it("requires a description of at least 10 characters", () => {
    expect(tripSchema.safeParse({ ...validTrip, theme: "short" }).success).toBe(false);
  });
});

describe("adminCreateUserSchema", () => {
  const { password, ...rest } = validSignUp;
  it("requires a role and a strong password", () => {
    expect(adminCreateUserSchema.safeParse({ ...rest, password, role: "admin" }).success).toBe(true);
    expect(adminCreateUserSchema.safeParse({ ...rest, password, role: "owner" }).success).toBe(false);
    expect(adminCreateUserSchema.safeParse({ ...rest, password: "weak", role: "user" }).success).toBe(false);
  });
});

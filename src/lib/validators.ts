import { z } from "zod";

const requiredText = (label: string, max = 100) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

const isoDate = z.iso.date("Pick a valid date");

const today = () => new Date().toISOString().slice(0, 10);

// ---------- Account ----------

export const signUpSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .max(30, "At most 30 characters")
    .regex(/^[a-zA-Z0-9_.]+$/, "Letters, numbers, _ and . only"),
  password: z
    .string()
    .min(10, "At least 10 characters")
    .max(128, "At most 128 characters")
    .regex(/[a-z]/, "Add a lowercase letter")
    .regex(/[A-Z]/, "Add an uppercase letter")
    .regex(/[0-9]/, "Add a number"),
  firstName: requiredText("First name", 50),
  lastName: requiredText("Last name", 50),
  email: z.email("Enter a valid email address").max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  address: requiredText("Address", 200),
  birthDate: isoDate.refine((d) => d < today(), "Birth date must be in the past"),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  identifier: requiredText("Username or email", 254),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Profile photo rules (checked in the browser for UX and again on the server for safety).
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png"] as const;

// ---------- Trips ----------

export const GENDER_OPTIONS = [
  { value: "mixed", label: "Male and female" },
  { value: "female", label: "Females only" },
  { value: "male", label: "Males only" },
] as const;

export const TRANSPORT_OPTIONS = [
  { value: "plane", label: "Plane" },
  { value: "car", label: "Car" },
  { value: "bus", label: "Bus" },
  { value: "train", label: "Train" },
  { value: "ship", label: "Ship" },
  { value: "other", label: "Other" },
] as const;

export const CURRENCIES = ["EUR", "RON", "USD"] as const;

export const tripSchema = z
  .object({
    destinationCity: requiredText("Town", 80),
    destinationCountry: requiredText("Country", 80),
    departureDate: isoDate.refine((d) => d >= today(), "Departure cannot be in the past"),
    returnDate: z.union([isoDate, z.literal("")]).optional(),
    maxTravelers: z.coerce
      .number<string | number>("Enter a number")
      .int("Whole numbers only")
      .min(2, "At least 2 travelers")
      .max(50, "At most 50 travelers"),
    gender: z.enum(["male", "female", "mixed"], "Choose an option"),
    budgetEstimate: z.coerce
      .number<string | number>("Enter an amount")
      .positive("Must be greater than 0")
      .max(1_000_000, "Too large"),
    currency: z.enum(CURRENCIES),
    transport: z.enum(["plane", "car", "bus", "train", "ship", "other"], "Choose an option"),
    theme: z.string().trim().min(10, "Describe the trip in at least 10 characters").max(1000),
  })
  .refine((t) => !t.returnDate || t.returnDate >= t.departureDate, {
    path: ["returnDate"],
    message: "Return must be on or after departure",
  });
export type TripFormInput = z.input<typeof tripSchema>;
export type TripInput = z.output<typeof tripSchema>;

// ---------- Admin: user management ----------

export const adminUserSchema = z.object({
  username: signUpSchema.shape.username,
  email: signUpSchema.shape.email,
  firstName: signUpSchema.shape.firstName,
  lastName: signUpSchema.shape.lastName,
  phone: signUpSchema.shape.phone,
  address: signUpSchema.shape.address,
  birthDate: signUpSchema.shape.birthDate,
  role: z.enum(["user", "admin"]),
});
export type AdminUserInput = z.infer<typeof adminUserSchema>;

export const adminCreateUserSchema = adminUserSchema.extend({
  password: signUpSchema.shape.password,
});
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

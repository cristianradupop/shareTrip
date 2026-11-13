import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// Group gender preference of a trip (see "Trip details" in the spec).
export const tripGender = pgEnum("trip_gender", ["male", "female", "mixed"]);

export const transportMethod = pgEnum("transport_method", [
  "plane",
  "car",
  "bus",
  "train",
  "ship",
  "other",
]);

// A trip is "active" as soon as the organizer publishes it.
export const tripStatus = pgEnum("trip_status", ["active", "full", "cancelled"]);

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizerId: text("organizer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    destinationCity: text("destination_city").notNull(),
    destinationCountry: text("destination_country").notNull(),
    departureDate: date("departure_date", { mode: "string" }).notNull(),
    // Null = a single-day trip.
    returnDate: date("return_date", { mode: "string" }),
    maxTravelers: integer("max_travelers").notNull(),
    gender: tripGender("gender").notNull(),
    budgetEstimate: numeric("budget_estimate", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("EUR"),
    transport: transportMethod("transport").notNull(),
    theme: text("theme").notNull(),
    status: tripStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("trips_departure_idx").on(t.departureDate, t.id),
    // Case-insensitive city filter + sort by departure.
    index("trips_city_departure_idx").on(sql`lower(${t.destinationCity})`, t.departureDate, t.id),
    index("trips_created_at_idx").on(t.createdAt),
    index("trips_organizer_idx").on(t.organizerId),
  ],
);

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;

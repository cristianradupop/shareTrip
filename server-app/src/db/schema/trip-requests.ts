import { index, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { trips } from "./trips";

export const tripRequestStatus = pgEnum("trip_request_status", ["pending", "approved", "declined"]);

// A user asking to join a trip. Approval adds a trip_members row; trip_members stays "approved member".
export const tripRequests = pgTable(
  "trip_requests",
  {
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: tripRequestStatus("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    decidedAt: timestamp("decided_at"),
  },
  (t) => [
    primaryKey({ columns: [t.tripId, t.userId] }),
    index("trip_requests_trip_status_idx").on(t.tripId, t.status),
    index("trip_requests_user_idx").on(t.userId),
  ],
);

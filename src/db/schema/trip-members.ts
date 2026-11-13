import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { trips } from "./trips";

// Joiner side: a user who joined a trip. The organizer is trips.organizerId,
// not a row here. Filled by the Joiner feature.
export const tripMembers = pgTable(
  "trip_members",
  {
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tripId, t.userId] }), index("trip_members_user_idx").on(t.userId)],
);

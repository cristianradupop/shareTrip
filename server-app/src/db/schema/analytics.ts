import { doublePrecision, index, integer, boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// First-party analytics, written only after the visitor granted consent. Append-only and
// without foreign keys, like audit_events. The IP is never stored, only a salted hash.
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    type: text("type").notNull(),
    visitorId: text("visitor_id").notNull(),
    sessionId: text("session_id").notNull(),
    ipHash: text("ip_hash").notNull(),
    signedIn: boolean("signed_in").notNull().default(false),
    path: text("path").notNull(),
    referrer: text("referrer"),
    language: text("language"),
    screen: text("screen"),
    device: text("device"),
    browser: text("browser"),
    name: text("name"),
    status: integer("status"),
    value: doublePrecision("value"),
  },
  (t) => [
    index("analytics_events_created_idx").on(t.createdAt),
    index("analytics_events_type_created_idx").on(t.type, t.createdAt),
  ],
);

// One random salt per UTC day (day = YYYY-MM-DD); older rows are deleted on ingest.
export const analyticsSalts = pgTable("analytics_salts", {
  day: text("day").primaryKey(),
  salt: text("salt").notNull(),
});

export type AnalyticsEventInsert = typeof analyticsEvents.$inferInsert;

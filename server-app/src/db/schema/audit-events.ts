import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Append-only history of account and trip changes. No foreign keys on purpose: rows
// must outlive the users and trips they describe, so names are stored as snapshots.
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    category: text("category").notNull(),
    action: text("action").notNull(),
    actorId: text("actor_id").notNull(),
    // holder = the account owner acting on their own account, admin, or user.
    actorRole: text("actor_role").notNull(),
    actorName: text("actor_name").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    subjectLabel: text("subject_label").notNull(),
    subjectEmail: text("subject_email"),
    relatedId: text("related_id"),
    relatedLabel: text("related_label"),
    // Field names only, never values.
    changedFields: text("changed_fields")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    reason: text("reason"),
    newRole: text("new_role"),
    autoDeclined: integer("auto_declined"),
  },
  (t) => [
    index("audit_events_category_created_idx").on(t.category, t.createdAt),
    index("audit_events_actor_role_created_idx").on(t.actorRole, t.createdAt),
  ],
);

export type AuditEventInsert = typeof auditEvents.$inferInsert;

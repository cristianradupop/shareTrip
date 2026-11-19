import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEvents, trips, user } from "@/db/schema";
import type { ActorRole, AuditAction, AuditEventRow, AuditView } from "@/shared/audit";

export const EVENTS_LIMIT = 300;

const FILTERS = {
  account: eq(auditEvents.category, "account"),
  activity: eq(auditEvents.category, "trip"),
  audit: eq(auditEvents.actorRole, "admin"),
};

export async function listEvents(view: AuditView): Promise<AuditEventRow[]> {
  const rows = await db
    .select({
      e: auditEvents,
      // The subject may have been deleted since the event was written.
      exists: sql<boolean>`case ${auditEvents.subjectType}
        when 'user' then exists (select 1 from ${user} where ${user.id} = ${auditEvents.subjectId})
        else exists (select 1 from ${trips} where ${trips.id}::text = ${auditEvents.subjectId})
      end`,
    })
    .from(auditEvents)
    .where(FILTERS[view])
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(EVENTS_LIMIT);

  return rows.map(({ e, exists }) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    category: e.category === "account" ? "account" : "trip",
    action: e.action as AuditAction,
    actor: { id: e.actorId, name: e.actorName, role: e.actorRole as ActorRole },
    subject: {
      type: e.subjectType === "user" ? "user" : "trip",
      id: e.subjectId,
      label: e.subjectLabel,
      email: e.subjectEmail,
      exists: Boolean(exists),
    },
    related: e.relatedId ? { id: e.relatedId, label: e.relatedLabel ?? "" } : null,
    changedFields: e.changedFields,
    reason: e.reason,
    newRole: e.newRole,
    autoDeclined: e.autoDeclined,
  }));
}

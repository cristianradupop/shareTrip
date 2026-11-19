import type { ActorRole, AuditAction } from "server-app/shared";

const LABELS: Record<AuditAction, string> = {
  "account.created": "Account created",
  "account.edited": "Account edited",
  "account.banned": "Account banned",
  "account.unbanned": "Account unbanned",
  "account.role_changed": "Role changed",
  "account.deleted": "Account deleted",
  "trip.created": "Trip created",
  "trip.edited": "Trip edited",
  "trip.requested": "Requested to join",
  "trip.withdrawn": "Withdrew request",
  "trip.left": "Left trip",
  "trip.approved": "Request approved",
  "trip.declined": "Request declined",
};

export const actionLabel = (action: AuditAction): string => LABELS[action];

type Change = {
  action: AuditAction;
  changedFields: string[];
  reason: string | null;
  newRole: string | null;
  autoDeclined?: number | null;
};

/** Short detail text for an event row; an empty string when there is nothing to add. */
export function describeChange(e: Change): string {
  if (e.action === "account.banned") return e.reason ? `banned: ${e.reason}` : "";
  if (e.action === "account.role_changed") return e.newRole ? `role → ${e.newRole}` : "";
  if (e.action === "trip.approved") return e.autoDeclined ? `+${e.autoDeclined} auto-declined` : "";
  if (e.changedFields.length > 0) return `changed ${e.changedFields.join(", ")}`;
  return "";
}

/** Who acted, in which capacity. Only administrators are named: holders and users are the subject's own side. */
export function actorBadge(e: { actorRole: ActorRole; actorName: string }): { label: string; name: string | null } {
  if (e.actorRole === "admin") return { label: "administrator", name: e.actorName };
  return { label: e.actorRole, name: null };
}

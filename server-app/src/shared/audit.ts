// Audit event vocabulary shared by server-app and server-admin. Types and consts only.

export const AUDIT_ACTIONS = [
  "account.created",
  "account.edited",
  "account.banned",
  "account.unbanned",
  "account.role_changed",
  "account.deleted",
  "trip.created",
  "trip.edited",
  "trip.requested",
  "trip.withdrawn",
  "trip.left",
  "trip.approved",
  "trip.declined",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** holder = the account owner acting on their own account. */
export type ActorRole = "holder" | "admin" | "user";

export type AuditView = "account" | "activity" | "audit";

export type AuditEventRow = {
  id: string;
  createdAt: string;
  category: "account" | "trip";
  action: AuditAction;
  actor: { id: string; name: string; role: ActorRole };
  subject: {
    type: "user" | "trip";
    id: string;
    label: string;
    email: string | null;
    /** False when the user or trip has been deleted since. */
    exists: boolean;
  };
  related: { id: string; label: string } | null;
  changedFields: string[];
  reason: string | null;
  newRole: string | null;
  autoDeclined: number | null;
};

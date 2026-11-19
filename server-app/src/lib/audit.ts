import { auditEvents } from "@/db/schema";
import type { ActorRole, AuditAction } from "@/shared/audit";

export type Actor = { id: string; name: string; role: ActorRole };

export type Subject = {
  type: "user" | "trip";
  id: string;
  label: string;
  email: string | null;
};

type Extra = {
  changedFields?: string[];
  reason?: string;
  newRole?: string;
  autoDeclined?: number;
  related?: { id: string; label: string };
};

export function accountSubject(u: { id: string; name: string; email: string }): Subject {
  return { type: "user", id: u.id, label: u.name, email: u.email };
}

export function tripSubject(t: {
  id: string;
  destinationCity: string;
  destinationCountry: string;
}): Subject {
  return {
    type: "trip",
    id: t.id,
    label: `${t.destinationCity}, ${t.destinationCountry}`,
    email: null,
  };
}

export function buildEvent(action: AuditAction, actor: Actor, subject: Subject, extra: Extra = {}) {
  if (extra.reason !== undefined && action !== "account.banned") {
    throw new Error(`audit: reason is only allowed on account.banned, got ${action}`);
  }
  return {
    category: action.startsWith("account.") ? "account" : "trip",
    action,
    actorId: actor.id,
    actorRole: actor.role,
    actorName: actor.name,
    subjectType: subject.type,
    subjectId: subject.id,
    subjectLabel: subject.label,
    subjectEmail: subject.email,
    relatedId: extra.related?.id ?? null,
    relatedLabel: extra.related?.label ?? null,
    changedFields: extra.changedFields ?? [],
    reason: extra.reason ?? null,
    newRole: extra.newRole ?? null,
    autoDeclined: extra.autoDeclined ?? null,
  };
}

export type AuditEvent = ReturnType<typeof buildEvent>;

// null, undefined and "" all mean "empty" so a form round trip is not a change.
const norm = (v: unknown) => (v === undefined || v === null || v === "" ? null : v);

/** Names (never values) of the keys of `next` that differ from `before`. */
export function changedFields(
  before: Record<string, unknown>,
  next: Record<string, unknown>,
  ignore: string[] = [],
): string[] {
  return Object.keys(next).filter(
    (k) => !ignore.includes(k) && norm(before[k]) !== norm(next[k]),
  );
}

type Writer = { insert: (table: typeof auditEvents) => { values: (v: AuditEvent) => unknown } };

export async function recordEvent(tx: Writer, event: AuditEvent): Promise<void> {
  await tx.insert(auditEvents).values(event);
}

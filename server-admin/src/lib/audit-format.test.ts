import { describe, expect, it } from "vitest";
import type { AuditAction } from "server-app/shared";
import { actionLabel, actorBadge, describeChange } from "./audit-format";

// Assumed shapes (server-app/src/shared/audit.ts, T1): events carry action, actorRole ("holder" | "admin" | "user"),
// actorName, changedFields (string[]), reason, newRole, autoDeclined. Action names are the ones assumed below.
const act = (a: string) => a as AuditAction;

const base = { changedFields: [] as string[], reason: null, newRole: null, autoDeclined: 0 };

describe("actionLabel", () => {
  const cases: [string, string][] = [
    ["account.created", "Account created"],
    ["account.edited", "Account edited"],
    ["account.banned", "Account banned"],
    ["account.unbanned", "Account unbanned"],
    ["account.role_changed", "Role changed"],
    ["account.deleted", "Account deleted"],
    ["trip.created", "Trip created"],
    ["trip.edited", "Trip edited"],
    ["trip.requested", "Requested to join"],
    ["trip.withdrawn", "Withdrew request"],
    ["trip.left", "Left trip"],
    ["trip.approved", "Request approved"],
    ["trip.declined", "Request declined"],
  ];
  it.each(cases)("%s -> %s", (action, label) => {
    expect(actionLabel(act(action))).toBe(label);
  });
});

describe("describeChange", () => {
  it("lists changed field names", () => {
    expect(describeChange({ ...base, action: act("account.edited"), changedFields: ["name", "phone"] })).toBe(
      "changed name, phone",
    );
    expect(describeChange({ ...base, action: act("trip.edited"), changedFields: ["budget"] })).toBe("changed budget");
  });

  it("shows the ban reason", () => {
    expect(describeChange({ ...base, action: act("account.banned"), reason: "spam" })).toBe("banned: spam");
  });

  it("shows the new role with an arrow", () => {
    expect(describeChange({ ...base, action: act("account.role_changed"), newRole: "admin" })).toBe("role → admin");
  });

  it("shows the auto-declined count on approve", () => {
    expect(describeChange({ ...base, action: act("trip.approved"), autoDeclined: 3 })).toBe("+3 auto-declined");
  });

  it("returns an empty string for approve with nothing auto-declined", () => {
    expect(describeChange({ ...base, action: act("trip.approved") })).toBe("");
  });

  it("returns an empty string when nothing changed and there is nothing to say", () => {
    expect(describeChange({ ...base, action: act("account.created") })).toBe("");
    expect(describeChange({ ...base, action: act("account.edited") })).toBe("");
  });

  it("handles an unban without a reason", () => {
    expect(describeChange({ ...base, action: act("account.unbanned") })).toBe("");
  });
});

describe("actorBadge", () => {
  it("labels the account holder", () => {
    expect(actorBadge({ actorRole: "holder", actorName: "Ana" })).toEqual({ label: "holder", name: null });
  });

  it("labels an administrator with their name", () => {
    expect(actorBadge({ actorRole: "admin", actorName: "Root" })).toEqual({ label: "administrator", name: "Root" });
  });

  it("labels a regular user", () => {
    expect(actorBadge({ actorRole: "user", actorName: "Ana" })).toEqual({ label: "user", name: null });
  });
});

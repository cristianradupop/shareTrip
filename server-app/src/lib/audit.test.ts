import { describe, expect, it, vi } from "vitest";
import { auditEvents } from "@/db/schema";
import { accountSubject, buildEvent, changedFields, recordEvent, tripSubject } from "./audit";

// Assumed API (server-app/src/lib/audit.ts, the plan leaves the shapes open):
//   type Actor = { id: string; name: string; role: "holder" | "admin" | "user" }
//   accountSubject({ id, name, email }) -> { type: "user", id, label: name, email }
//   tripSubject({ id, destinationCity, destinationCountry }) -> { type: "trip", id, label: "City, Country", email: null }
//   buildEvent(action, actor, subject, extra?: { changedFields?, reason?, newRole?, autoDeclined?, related?: { id, label } })
//     -> flat row for the auditEvents table: { category, action, actorId, actorRole, actorName, subjectType, subjectId,
//        subjectLabel, subjectEmail, relatedId, relatedLabel, changedFields, reason, newRole, autoDeclined }
//   changedFields(before, next, ignore?: string[]) -> string[] (keys of `next` whose value differs, in `next` order)
//   recordEvent(tx, event) -> tx.insert(auditEvents).values(event)

const admin = { id: "admin-1", name: "Ada Admin", role: "admin" as const };
const account = accountSubject({ id: "u2", name: "Old Name", email: "u2@test.dev" });
const trip = tripSubject({ id: "t1", destinationCity: "Lisbon", destinationCountry: "Portugal" });

describe("buildEvent category", () => {
  it.each([
    ["account.created", "account"],
    ["account.edited", "account"],
    ["account.banned", "account"],
    ["account.unbanned", "account"],
    ["account.role_changed", "account"],
    ["account.deleted", "account"],
    ["trip.created", "trip"],
    ["trip.edited", "trip"],
    ["trip.requested", "trip"],
    ["trip.withdrawn", "trip"],
    ["trip.left", "trip"],
    ["trip.approved", "trip"],
    ["trip.declined", "trip"],
  ])("%s -> %s", (action, category) => {
    const subject = category === "account" ? account : trip;
    expect(buildEvent(action as never, admin, subject, {})).toMatchObject({ category, action });
  });
});

describe("buildEvent snapshots", () => {
  it("copies the actor and the account subject", () => {
    expect(buildEvent("account.edited", admin, account, { changedFields: ["phone"] })).toMatchObject({
      actorId: "admin-1",
      actorRole: "admin",
      actorName: "Ada Admin",
      subjectType: "user",
      subjectId: "u2",
      subjectLabel: "Old Name",
      subjectEmail: "u2@test.dev",
      changedFields: ["phone"],
    });
  });

  it("builds a trip subject label as 'City, Country' with no email", () => {
    expect(buildEvent("trip.created", { id: "u1", name: "Una", role: "user" }, trip, {})).toMatchObject({
      actorRole: "user",
      subjectType: "trip",
      subjectId: "t1",
      subjectLabel: "Lisbon, Portugal",
    });
    expect(trip.email ?? null).toBeNull();
  });

  it("defaults changedFields to an empty list", () => {
    expect(buildEvent("trip.created", admin, trip, {}).changedFields).toEqual([]);
  });

  it("copies related, newRole and autoDeclined", () => {
    expect(
      buildEvent("trip.approved", admin, trip, { related: { id: "app-1", label: "Ana B" }, autoDeclined: 3 }),
    ).toMatchObject({ relatedId: "app-1", relatedLabel: "Ana B", autoDeclined: 3 });
    expect(buildEvent("account.role_changed", admin, account, { newRole: "admin" })).toMatchObject({ newRole: "admin" });
  });
});

describe("buildEvent reason", () => {
  it("keeps the reason on a ban", () => {
    expect(buildEvent("account.banned", admin, account, { reason: "Spam" })).toMatchObject({ reason: "Spam" });
  });

  it.each(["account.edited", "account.deleted", "account.role_changed", "trip.created", "trip.declined"])(
    "rejects a reason on %s",
    (action) => {
      const subject = action.startsWith("trip") ? trip : account;
      expect(() => buildEvent(action as never, admin, subject, { reason: "because" })).toThrow();
    },
  );
});

describe("changedFields", () => {
  it("returns only the names of fields that differ", () => {
    expect(changedFields({ a: "x", b: "y", c: 1 }, { a: "x", b: "z", c: 2 })).toEqual(["b", "c"]);
  });

  it("returns an empty list when nothing changed", () => {
    expect(changedFields({ a: "x", n: 3 }, { a: "x", n: 3 })).toEqual([]);
  });

  it("treats null, undefined and '' as equal", () => {
    expect(changedFields({ a: null, b: "", c: undefined }, { a: "", b: null, c: null })).toEqual([]);
    expect(changedFields({ a: null }, { a: "x" })).toEqual(["a"]);
  });

  it("skips ignored keys even when they differ", () => {
    expect(changedFields({ name: "A", phone: "1" }, { name: "B", phone: "2" }, ["name"])).toEqual(["phone"]);
  });

  it("never returns values", () => {
    const out = changedFields({ phone: "+40700000000" }, { phone: "+40799999999" });
    expect(out).toEqual(["phone"]);
    expect(JSON.stringify(out)).not.toContain("+407");
  });
});

describe("recordEvent", () => {
  it("inserts the event into auditEvents", async () => {
    const values = vi.fn(async () => undefined);
    const tx = { insert: vi.fn(() => ({ values })) };
    const ev = buildEvent("trip.created", admin, trip, {});
    await recordEvent(tx as never, ev);
    expect(tx.insert).toHaveBeenCalledWith(auditEvents);
    expect(values).toHaveBeenCalledWith(ev);
  });
});

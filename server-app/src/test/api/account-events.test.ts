import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditEvents, session as sessionTable, user as userTable } from "@/db/schema";
import { ctx, reset, send, state, type TestSession } from "../helpers";

// Account events. The fake db returns `state.result` for every select, so `state.result = [row]` is the
// "before" row the handler reads (select ... for update) and `state.result = []` means the user is missing.
// Event payload (auditEvents insert, camelCase keys of the table): action, actorId, actorRole, actorName,
// subjectType, subjectId, subjectLabel, subjectEmail, changedFields (names only), reason, newRole.
// POST /api/admin/users logs inside createCredentialUser(u, { actor }); that part is tested in user-service.test.ts.

const createUser = vi.hoisted(() => vi.fn(async () => "new-id"));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
vi.mock("@/lib/user-service", () => ({ createCredentialUser: createUser }));

const adminUsers = await import("../../app/api/admin/users/route");
const adminUser = await import("../../app/api/admin/users/[id]/route");
const adminBan = await import("../../app/api/admin/users/[id]/ban/route");
const profile = await import("../../app/api/profile/route");

type Handler = (req: Request, c?: unknown) => Promise<Response>;

const sessionFor = (id: string, role: "user" | "admin", name: string): TestSession => ({
  user: { id, role, name, email: `${id}@test.dev` },
  session: { id: "s1" },
});
const ADMIN = () => sessionFor("admin-1", "admin", "Ada Admin");

const before = (over: object = {}) => ({
  id: "u2",
  name: "Old Name",
  email: "u2@test.dev",
  username: "old.name",
  displayUsername: "Old.Name",
  firstName: "Old",
  lastName: "Name",
  phone: "+40721000111",
  address: "Cluj",
  birthDate: "1995-04-12",
  gender: "female",
  role: "user",
  banned: false,
  ...over,
});
// A valid admin PATCH body identical to `before()`.
const body = (over: object = {}) => ({
  username: "old.name",
  email: "u2@test.dev",
  firstName: "Old",
  lastName: "Name",
  phone: "+40721000111",
  address: "Cluj",
  birthDate: "1995-04-12",
  gender: "female",
  role: "user",
  ...over,
});

const events = () => state.inserts.filter((i) => i.table === auditEvents).map((i) => i.values as Record<string, unknown>);
const patch = (b: unknown, id = "u2") => (adminUser.PATCH as Handler)(send("PATCH", `/api/admin/users/${id}`, b), ctx(id));

beforeEach(() => {
  reset();
  createUser.mockClear();
  state.session = ADMIN();
  state.result = [before()];
});

describe("POST /api/admin/users", () => {
  it("passes the admin as the actor to createCredentialUser", async () => {
    const res = await (adminUsers.POST as Handler)(
      send("POST", "/api/admin/users", { ...body({ username: "new.user", email: "n@test.dev" }), password: "Strong-Pass-123" }),
    );
    expect(res.status).toBe(200);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "n@test.dev" }),
      { actor: expect.objectContaining({ id: "admin-1", name: "Ada Admin" }) },
    );
  });
});

describe("PATCH /api/admin/users/[id] events", () => {
  it("logs account.edited with the changed field names only", async () => {
    const res = await patch(body({ phone: "+40799999999" }));
    expect(res.status).toBe(200);
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({
      action: "account.edited",
      actorId: "admin-1",
      actorRole: "admin",
      actorName: "Ada Admin",
      subjectType: "user",
      subjectId: "u2",
      subjectLabel: "Old Name",
      subjectEmail: "u2@test.dev",
      changedFields: ["phone"],
    });
    expect(JSON.stringify(evs[0])).not.toContain("+40799999999");
    expect(JSON.stringify(evs[0])).not.toContain("+40721000111");
  });

  it("lists every changed field and ignores the derived name and displayUsername", async () => {
    await patch(body({ firstName: "New", address: "Brasov" }));
    const [ev] = events();
    expect([...(ev.changedFields as string[])].sort()).toEqual(["address", "firstName"]);
  });

  it("writes no event when nothing changed", async () => {
    expect((await patch(body())).status).toBe(200);
    expect(events()).toHaveLength(0);
  });

  it("compares the normalised values: email and username case do not count as a change", async () => {
    await patch(body({ email: "U2@Test.dev", username: "OLD.name" }));
    expect(events()).toHaveLength(0);
  });

  it("adds 'password' (never the value) when a new password is set", async () => {
    const res = await patch(body({ password: "Another-Pass-123" }));
    expect(res.status).toBe(200);
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ action: "account.edited", changedFields: ["password"] });
    expect(JSON.stringify(evs)).not.toContain("Another-Pass-123");
    expect(JSON.stringify(evs)).not.toContain("hashed:");
    expect(state.deletes).toContain(sessionTable);
  });

  it("logs a role change as its own account.role_changed event with newRole", async () => {
    await patch(body({ role: "admin" }));
    const evs = events();
    expect(evs.map((e) => e.action)).toEqual(["account.role_changed"]);
    expect(evs[0]).toMatchObject({ actorRole: "admin", subjectId: "u2", newRole: "admin" });
    expect(evs[0].changedFields ?? []).toEqual([]);
  });

  it("logs the edit and the role change separately when both happen", async () => {
    await patch(body({ role: "admin", phone: "+40799999999" }));
    const byAction = Object.fromEntries(events().map((e) => [e.action as string, e]));
    expect(byAction["account.edited"]).toMatchObject({ changedFields: ["phone"] });
    expect(byAction["account.role_changed"]).toMatchObject({ newRole: "admin" });
  });

  it("returns 404 and writes nothing when the user row is missing", async () => {
    state.result = [];
    const res = await patch(body({ phone: "+40799999999" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, error: expect.any(String) });
    expect(events()).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
  });
});

describe("POST /api/admin/users/[id]/ban events", () => {
  const ban = (b: unknown, id = "u2") => (adminBan.POST as Handler)(send("POST", `/api/admin/users/${id}/ban`, b), ctx(id));

  it("logs account.banned with the reason", async () => {
    const res = await ban({ banned: true, reason: "Spam" });
    expect(res.status).toBe(200);
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({
      action: "account.banned",
      actorId: "admin-1",
      actorRole: "admin",
      actorName: "Ada Admin",
      subjectType: "user",
      subjectId: "u2",
      subjectLabel: "Old Name",
      subjectEmail: "u2@test.dev",
      reason: "Spam",
    });
  });

  it("logs account.unbanned without a reason", async () => {
    state.result = [before({ banned: true })];
    await ban({ banned: false });
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ action: "account.unbanned", actorRole: "admin", subjectId: "u2" });
    expect(evs[0].reason ?? null).toBeNull();
  });

  it("writes no event when the user is already banned with the same reason", async () => {
    state.result = [before({ banned: true, banReason: "Spam" })];
    const res = await ban({ banned: true, reason: "Spam" });
    expect(res.status).toBe(200);
    expect(events()).toHaveLength(0);
  });

  it("still logs a re-ban with a new reason", async () => {
    state.result = [before({ banned: true, banReason: "Spam" })];
    expect((await ban({ banned: true, reason: "Abuse" })).status).toBe(200);
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ action: "account.banned", reason: "Abuse" });
  });

  it("writes no event when unbanning a user who is not banned", async () => {
    state.result = [before({ banned: false, banReason: null })];
    const res = await ban({ banned: false });
    expect(res.status).toBe(200);
    expect(events()).toHaveLength(0);
  });

  it("returns 404 and writes nothing when the user row is missing", async () => {
    state.result = [];
    const res = await ban({ banned: true, reason: "Spam" });
    expect(res.status).toBe(404);
    expect(events()).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
  });
});

describe("DELETE /api/admin/users/[id] events", () => {
  const del = (id = "u2") => (adminUser.DELETE as Handler)(send("DELETE", `/api/admin/users/${id}`), ctx(id));

  it("logs account.deleted with the name and email as they were", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(state.deletes).toContain(userTable);
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({
      action: "account.deleted",
      actorId: "admin-1",
      actorRole: "admin",
      actorName: "Ada Admin",
      subjectType: "user",
      subjectId: "u2",
      subjectLabel: "Old Name",
      subjectEmail: "u2@test.dev",
    });
  });

  it("returns 404 and writes nothing when the user row is missing", async () => {
    state.result = [];
    const res = await del();
    expect(res.status).toBe(404);
    expect(events()).toHaveLength(0);
    expect(state.deletes).toHaveLength(0);
  });
});

describe("PATCH /api/profile events", () => {
  const me = () => state.session!.user.id;
  const setGender = (gender: string) => (profile.PATCH as Handler)(send("PATCH", "/api/profile", { gender }));

  beforeEach(() => {
    state.session = sessionFor("holder-1", "user", "Ana B");
    state.result = [before({ id: "holder-1", name: "Ana B", email: "holder-1@test.dev", gender: "male" })];
  });

  it("logs account.edited by the holder with the field name only", async () => {
    const res = await setGender("female");
    expect(res.status).toBe(200);
    const evs = events();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({
      action: "account.edited",
      actorId: me(),
      actorRole: "holder",
      actorName: "Ana B",
      subjectType: "user",
      subjectId: "holder-1",
      subjectLabel: "Ana B",
      subjectEmail: "holder-1@test.dev",
      changedFields: ["gender"],
    });
    expect(JSON.stringify(evs[0])).not.toContain("female");
  });

  it("logs the holder capacity even for an admin account editing its own profile", async () => {
    state.session = sessionFor("admin-1", "admin", "Ada Admin");
    state.result = [before({ id: "admin-1", name: "Ada Admin", email: "admin-1@test.dev", gender: "male", role: "admin" })];
    await setGender("female");
    expect(events()[0]).toMatchObject({ actorRole: "holder", subjectId: "admin-1" });
  });

  it("writes no event when the gender is unchanged", async () => {
    expect((await setGender("male")).status).toBe(200);
    expect(events()).toHaveLength(0);
  });
});

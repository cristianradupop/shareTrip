import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// listEvents against a db fake that records the arguments of .where(), .orderBy() and .limit(), which are
// rendered to SQL with PgDialect. The rows it returns are canned, so the mapping is checked as well.
const seen = vi.hoisted(() => ({ where: undefined as unknown, orderBy: [] as unknown[], limit: undefined as number | undefined, rows: [] as unknown[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => {
  const p: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (res: (v: unknown) => unknown) => Promise.resolve(seen.rows).then(res);
      if (prop === "where") return (w: unknown) => ((seen.where = w), p);
      if (prop === "orderBy") return (...o: unknown[]) => ((seen.orderBy = o), p);
      if (prop === "limit") return (n: number) => ((seen.limit = n), p);
      return () => p;
    },
    apply: () => p,
  });
  return { db: { select: () => p } };
});

const { listEvents } = await import("./audit");
const dialect = new PgDialect();
const sqlOf = (x: unknown) => dialect.sqlToQuery(x as never);

beforeEach(() => {
  seen.where = undefined;
  seen.orderBy = [];
  seen.limit = undefined;
  seen.rows = [];
});

describe("listEvents", () => {
  it.each([
    ["account", "category", "account"],
    ["activity", "category", "trip"],
    ["audit", "actor_role", "admin"],
  ] as const)("view %s filters on %s = %s", async (view, column, value) => {
    await listEvents(view);
    const { sql, params } = sqlOf(seen.where);
    expect(sql).toContain(`"${column}"`);
    expect(params).toEqual([value]);
  });

  it("returns at most 300 rows, newest first with id as the tie-breaker", async () => {
    await listEvents("account");
    expect(seen.limit).toBe(300);
    const order = seen.orderBy.map((o) => sqlOf(o).sql);
    expect(order).toHaveLength(2);
    expect(order[0]).toMatch(/"created_at" desc/);
    expect(order[1]).toMatch(/"id" desc/);
  });

  it("maps a row to the shared AuditEventRow shape", async () => {
    seen.rows = [
      {
        exists: false,
        e: {
          id: "e1",
          createdAt: new Date("2026-11-19T10:00:00Z"),
          category: "account",
          action: "account.banned",
          actorId: "admin-1",
          actorName: "Ada Admin",
          actorRole: "admin",
          subjectType: "user",
          subjectId: "u2",
          subjectLabel: "Old Name",
          subjectEmail: "u2@test.dev",
          relatedId: null,
          relatedLabel: null,
          changedFields: [],
          reason: "Spam",
          newRole: null,
          autoDeclined: null,
        },
      },
    ];
    const [row] = await listEvents("audit");
    expect(row).toMatchObject({
      id: "e1",
      createdAt: "2026-11-19T10:00:00.000Z",
      category: "account",
      action: "account.banned",
      actor: { id: "admin-1", name: "Ada Admin", role: "admin" },
      subject: { type: "user", id: "u2", label: "Old Name", email: "u2@test.dev", exists: false },
      related: null,
      reason: "Spam",
    });
  });
});

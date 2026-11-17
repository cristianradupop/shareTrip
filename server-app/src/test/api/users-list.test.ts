import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminSession, reset, state } from "../helpers";

// Real listUsers, with a db that records the WHERE clause and the OFFSET.
const seen = vi.hoisted(() => ({ where: undefined as unknown, offset: undefined as number | undefined }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
vi.mock("@/db/client", () => {
  const rows = (): unknown => {
    const p: unknown = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") return (res: (v: unknown) => unknown) => Promise.resolve([{ total: 0, createdAt: new Date(0) }]).then(res);
        if (prop === "where") return (w: unknown) => ((seen.where = w), p);
        if (prop === "offset") return (n: number) => ((seen.offset = n), p);
        return () => p;
      },
      apply: () => p,
    });
    return p;
  };
  return { db: { select: rows } };
});

const adminUsers = await import("../../app/api/admin/users/route");
const list = (qs: string) =>
  (adminUsers.GET as (r: Request) => Promise<Response>)(
    new Request(`http://app.test/api/admin/users?${qs}`, { headers: { cookie: "better-auth.session_token=x" } }),
  );

beforeEach(() => {
  reset();
  state.session = adminSession();
  seen.where = undefined;
  seen.offset = undefined;
});

describe("GET /api/admin/users query hardening", () => {
  it("clamps a huge page to at most 10000", async () => {
    await list("page=99999999999");
    expect(seen.offset).toBeLessThanOrEqual(9999 * 10);
    expect(Number.isSafeInteger(seen.offset)).toBe(true);
  });

  it("escapes % and _ in q before the ILIKE", async () => {
    await list(`q=${encodeURIComponent("50%_off")}`);
    const { params } = new PgDialect().sqlToQuery(seen.where as never);
    expect(params).toContain("%50\\%\\_off%");
    expect(params).not.toContain("%50%_off%");
  });
});

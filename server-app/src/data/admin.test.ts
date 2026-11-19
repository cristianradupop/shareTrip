import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// "full" is derived (nothing writes trips.status = 'full'). The fake db records what listAllTrips passes to
// .select() and .where(); both are rendered to SQL with PgDialect.
const seen = vi.hoisted(() => ({ selects: [] as unknown[], wheres: [] as unknown[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => {
  const select = (fields: unknown) => {
    const n = seen.selects.push(fields);
    const p: unknown = new Proxy(function () {}, {
      get(_t, prop) {
        // 1st select = count, 2nd = rows (none, so no mapping is needed)
        if (prop === "then") return (res: (v: unknown) => unknown) => Promise.resolve(n === 1 ? [{ total: 0 }] : []).then(res);
        if (prop === "where") return (w: unknown) => (seen.wheres.push(w), p);
        return () => p;
      },
      apply: () => p,
    });
    return p;
  };
  return { db: { select } };
});

const { listAllTrips } = await import("./admin");
const render = (x: unknown) => new PgDialect().sqlToQuery(x as never);
const squash = (s: string) => s.replace(/\s+/g, " ");

beforeEach(() => {
  seen.selects.length = 0;
  seen.wheres.length = 0;
});

describe("derived trip status in listAllTrips", () => {
  it("status=full filters on cancelled-excluded (stored 'full' OR members + 1 >= max_travelers)", async () => {
    await listAllTrips({ status: "full", page: 1 });
    const { sql, params } = render(seen.wheres[0]);
    const s = squash(sql);
    expect(s).toContain(`"trips"."status" <> 'cancelled'`);
    expect(s).toContain(`"trips"."status" = 'full'`);
    expect(s).toMatch(/select count\(\*\) from "trip_members" where "trip_members"\."trip_id" = "trips"\."id"\) \+ 1 >= "trips"\."max_travelers"/);
    expect(s).toMatch(/ or /);
    expect(params).toContain("full");
  });

  it("the returned status column checks cancelled first, then full, else active", async () => {
    await listAllTrips({ page: 1 });
    const { status } = seen.selects[1] as { status: unknown };
    const s = squash(render(status).sql);
    const cancelled = s.indexOf(`then 'cancelled'`);
    const full = s.indexOf(`then 'full'`);
    expect(cancelled).toBeGreaterThan(-1);
    expect(full).toBeGreaterThan(cancelled);
    expect(s).toContain(`else 'active'`);
    expect(s).toContain(`+ 1 >= "trips"."max_travelers"`);
  });

  it("no status and no q means no WHERE clause", async () => {
    await listAllTrips({ page: 1 });
    expect(seen.wheres[0]).toBeUndefined();
  });
});

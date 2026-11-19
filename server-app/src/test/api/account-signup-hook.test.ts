import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { auditEvents } from "@/db/schema";
import { reset, state } from "../helpers";

// Sign-up event: Better Auth creates the user, so it is logged in `databaseHooks.user.create.after`
// (queued after Better Auth's own transaction). Modelled on auth-photo-hook.test.ts.
const fail = vi.hoisted(() => ({ on: false }));

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => {
  const real = (await import("../helpers")).dbModule().db;
  const guard = <T extends (...a: never[]) => unknown>(fn: T) =>
    ((...a: never[]) => {
      if (fail.on) throw new Error("db down for ana@test.dev");
      return fn(...a);
    }) as T;
  const insert = guard(real.insert);
  return {
    db: {
      ...real,
      insert,
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({ ...real, insert }),
    },
  };
});

type After = (u: { id: string; name: string; email: string; [k: string]: unknown }) => Promise<unknown>;
let after: After;
let plugins: { id: string }[];

beforeAll(async () => {
  vi.stubEnv("SUPABASE_URL", "https://proj.supabase.co");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3001");
  const { auth } = await import("../../lib/auth");
  const opts = auth.options as unknown as {
    databaseHooks: { user: { create: { after: After } } };
    plugins: { id: string }[];
  };
  after = opts.databaseHooks.user.create.after;
  plugins = opts.plugins;
});

beforeEach(() => {
  reset();
  fail.on = false;
});

const NEW = { id: "u-new", name: "Ana B", email: "ana@test.dev", image: "https://x.test/p.jpg" };

describe("user.create.after sign-up event", () => {
  it("is defined", () => {
    expect(typeof after).toBe("function");
  });

  it("logs account.created by the holder with name and email snapshots", async () => {
    await after(NEW);
    const evs = state.inserts.filter((i) => i.table === auditEvents).map((i) => i.values);
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({
      action: "account.created",
      actorId: "u-new",
      actorRole: "holder",
      actorName: "Ana B",
      subjectType: "user",
      subjectId: "u-new",
      subjectLabel: "Ana B",
      subjectEmail: "ana@test.dev",
    });
  });

  it("never fails the sign-up: a logging error is swallowed and logged without personal data", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fail.on = true;
    await expect(after(NEW)).resolves.not.toThrow();
    expect(spy).toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).not.toContain("ana@test.dev");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("Ana B");
    spy.mockRestore();
  });

  it("keeps nextCookies() as the last plugin", () => {
    expect(plugins.at(-1)?.id).toBe("next-cookies");
  });
});

// Shared fakes for the server-app handler tests. No DB, no network.
// Usage in a test file (vi.mock calls are hoisted, so they load this module lazily):
//   vi.mock("server-only", () => ({}));
//   vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());
//   vi.mock("@/lib/auth", async () => (await import("../helpers")).authModule());
import { vi } from "vitest";

export type TestSession = { user: { id: string; role: "user" | "admin"; [k: string]: unknown }; session: { id: string } } | null;

export const state = {
  session: null as TestSession,
  inserts: [] as { table: unknown; values: unknown }[],
  deletes: [] as unknown[],
  updates: [] as unknown[],
  result: [{ id: "trip-1" }] as unknown[],
};

export const signUpEmail = vi.fn(async () => ({ ok: true }));

export function reset() {
  state.session = null;
  state.inserts.length = 0;
  state.deletes.length = 0;
  state.updates.length = 0;
  state.result = [{ id: "trip-1" }];
  signUpEmail.mockClear();
}

export const userSession = (id = "user-1"): TestSession => ({
  user: { id, role: "user", email: `${id}@test.dev` },
  session: { id: "s1" },
});
export const adminSession = (id = "admin-1"): TestSession => ({
  user: { id, role: "admin", email: `${id}@test.dev` },
  session: { id: "s1" },
});

// A chainable, awaitable query builder that records writes.
function chain(onValues?: (v: unknown) => void, onWrite?: () => void): unknown {
  const p: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve(state.result).then(resolve, reject);
      }
      if (prop === "values") {
        return (v: unknown) => {
          onValues?.(v);
          return p;
        };
      }
      return () => {
        onWrite?.();
        return p;
      };
    },
    apply: () => p,
  });
  return p;
}

function makeDb() {
  const tx = {
    select: () => chain(),
    insert: (table: unknown) => chain((values) => state.inserts.push({ table, values })),
    update: (table: unknown) => chain(undefined, () => state.updates.push(table)),
    delete: (table: unknown) => chain(undefined, () => state.deletes.push(table)),
  };
  return { ...tx, transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
}

export function dbModule() {
  return { db: makeDb() };
}

export function authModule() {
  return {
    auth: {
      api: { getSession: vi.fn(async () => state.session), signUpEmail },
      $context: Promise.resolve({ password: { hash: async (p: string) => `hashed:${p}` } }),
    },
  };
}

export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

export const get = (path: string) => new Request(`http://app.test${path}`, { headers: { cookie: "better-auth.session_token=x" } });

export const send = (method: string, path: string, body?: unknown) =>
  new Request(`http://app.test${path}`, {
    method,
    headers: { "content-type": "application/json", cookie: "better-auth.session_token=x" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

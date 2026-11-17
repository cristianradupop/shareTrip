import { beforeEach, describe, expect, it, vi } from "vitest";

const inserts: { table: unknown; values: Record<string, unknown> }[] = [];

vi.mock("@/db/client", () => {
  const tx = {
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        inserts.push({ table, values });
      },
    }),
  };
  return { db: { transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx) } };
});

vi.mock("@/lib/auth", () => ({
  auth: { $context: Promise.resolve({ password: { hash: async (p: string) => `hashed:${p}` } }) },
}));

const { createCredentialUser } = await import("./user-service");
const { account, user } = await import("@/db/schema");

const input = {
  email: "Alex@Demo.Test",
  username: "Alex.Popescu",
  password: "Demo-Pass-123!",
  firstName: "Alex",
  lastName: "Popescu",
  phone: "+40721000111",
  address: "Cluj",
  birthDate: "1995-04-12",
  role: "user" as const,
};

describe("createCredentialUser", () => {
  beforeEach(() => {
    inserts.length = 0;
  });

  it("inserts a user and a linked credential account in one transaction", async () => {
    const id = await createCredentialUser(input);

    expect(inserts).toHaveLength(2);
    expect(inserts[0].table).toBe(user);
    expect(inserts[1].table).toBe(account);
    expect(inserts[0].values.id).toBe(id);
    expect(inserts[1].values).toMatchObject({ userId: id, accountId: id, providerId: "credential" });
  });

  it("normalizes email and username to lowercase but keeps the display username", async () => {
    await createCredentialUser(input);
    expect(inserts[0].values).toMatchObject({
      email: "alex@demo.test",
      username: "alex.popescu",
      displayUsername: "Alex.Popescu",
      name: "Alex Popescu",
    });
  });

  it("stores only the hash, never the plain password", async () => {
    await createCredentialUser(input);
    expect(inserts[1].values.password).toBe("hashed:Demo-Pass-123!");
    expect(JSON.stringify(inserts[0].values)).not.toContain("Demo-Pass-123!");
  });
});

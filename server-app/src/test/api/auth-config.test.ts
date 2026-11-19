import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../helpers")).dbModule());

type Options = { advanced?: { ipAddress?: { ipAddressHeaders?: string[] } } };
let options: Options;

beforeAll(async () => {
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3001");
  const { auth } = await import("../../lib/auth");
  options = auth.options as unknown as Options;
});

const req = (xff?: string) => new Request("http://app.test/x", { headers: xff === undefined ? {} : { "x-forwarded-for": xff } });

describe("Better Auth IP configuration", () => {
  it("reads the client IP only from x-forwarded-for, explicitly", () => {
    expect(options.advanced?.ipAddress?.ipAddressHeaders).toEqual(["x-forwarded-for"]);
  });

  it("IP_ADDRESS_OPTIONS is the same list", async () => {
    const { IP_ADDRESS_OPTIONS } = await import("../../lib/client-ip");
    expect(IP_ADDRESS_OPTIONS).toEqual({ ipAddressHeaders: ["x-forwarded-for"] });
  });
});

describe("clientIp", () => {
  it("returns the single x-forwarded-for entry", async () => {
    const { clientIp } = await import("../../lib/client-ip");
    expect(clientIp(req("1.2.3.4"))).toBe("1.2.3.4");
  });

  it("does not trust a multi-entry header: getIP gives the test-env fallback", async () => {
    const { clientIp } = await import("../../lib/client-ip");
    // getIP (better-auth 1.7.25) rejects several entries, then falls back to 127.0.0.1 under NODE_ENV=test.
    expect(clientIp(req("1.2.3.4, 5.6.7.8"))).toBe("127.0.0.1");
  });
});

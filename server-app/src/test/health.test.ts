import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("./helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("./helpers")).authModule());

const root = await import("../app/route");
const health = await import("../app/api/health/route");

const call = (h: unknown) => (h as (r: Request) => Promise<Response>)(new Request("http://app.test/"));

describe("server-app health", () => {
  it("GET / returns the service banner as JSON", async () => {
    const res = await call(root.GET);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/json/);
    expect(await res.json()).toMatchObject({ name: "server-app", status: "ok" });
  });

  it("GET /api/health returns status ok as JSON", async () => {
    const res = await call(health.GET);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/json/);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });
});

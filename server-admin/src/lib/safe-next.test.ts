import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

// Contract assumed: safeNext(next?: string | null): string | null (null when unsafe or missing).
describe("safeNext", () => {
  it.each(["/", "/#trips", "/organizer?x=1", "/admin", "/a/b#c"])("accepts the same-site path %s", (p) => {
    expect(safeNext(p)).toBe(p);
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash host", "/\\evil.com"],
    ["absolute https", "https://evil.com"],
    ["absolute http", "http://evil.com/x"],
    ["javascript scheme", "javascript:alert(1)"],
    ["relative without slash", "evil.com"],
    ["tab inside the slashes", "/\t/evil.com"],
    ["empty", ""],
  ])("rejects %s", (_name, v) => {
    expect(safeNext(v)).toBeNull();
  });

  it("returns null for undefined and null", () => {
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

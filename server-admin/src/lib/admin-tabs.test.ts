import { describe, expect, it } from "vitest";
import { ADMIN_TABS, activeAdminTab } from "./admin-tabs";

describe("ADMIN_TABS", () => {
  it("lists the seven tabs in spec order", () => {
    expect(ADMIN_TABS.map((t) => [t.label, t.href])).toEqual([
      ["Statistics", "/admin/statistics"],
      ["Analytics", "/admin/analytics"],
      ["Accounts", "/admin"],
      ["Trips", "/admin/trips"],
      ["Activity", "/admin/activity"],
      ["Account history", "/admin/account-history"],
      ["Audit log", "/admin/audit-log"],
    ]);
  });
});

describe("activeAdminTab", () => {
  it("highlights Accounts only on the exact /admin path", () => {
    expect(activeAdminTab("/admin")?.href).toBe("/admin");
  });

  it("highlights each other tab on its own path", () => {
    for (const t of ADMIN_TABS) expect(activeAdminTab(t.href)?.href).toBe(t.href);
  });

  it("matches nested paths and query strings by prefix", () => {
    expect(activeAdminTab("/admin/trips/abc")?.href).toBe("/admin/trips");
    expect(activeAdminTab("/admin/trips?x=1")?.href).toBe("/admin/trips");
    expect(activeAdminTab("/admin/audit-log/")?.href).toBe("/admin/audit-log");
  });

  it("does not match a path that only shares a text prefix", () => {
    expect(activeAdminTab("/admin/tripsy")).toBeUndefined();
  });

  it("returns no tab for an unknown admin path or a non-admin path", () => {
    expect(activeAdminTab("/admin/nope")).toBeUndefined();
    expect(activeAdminTab("/organizer")).toBeUndefined();
    expect(activeAdminTab("/")).toBeUndefined();
  });
});

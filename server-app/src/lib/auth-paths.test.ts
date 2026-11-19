import { describe, expect, it } from "vitest";
import { isAllowedAuthPath } from "./auth-paths";

// Paths are relative to /api/auth (what Better Auth sees), e.g. "/sign-in/email".
describe("isAllowedAuthPath", () => {
  it.each(["/sign-in/email", "/sign-in/username", "/sign-out", "/get-session"])("allows %s", (p) => {
    expect(isAllowedAuthPath(p)).toBe(true);
  });

  it.each([
    "/sign-up/email",
    "/update-user",
    "/change-password",
    "/change-email",
    "/delete-user",
    "/admin/set-role",
    "/admin/ban-user",
    "/admin/create-user",
    "/admin/list-users",
    "/sign-in/email/",
    "/sign-out/",
    "/get-session/",
    "/sign-in/email/extra",
    "/sign-in",
    "/unknown",
    "/",
    "",
  ])("refuses %j", (p) => {
    expect(isAllowedAuthPath(p)).toBe(false);
  });
});

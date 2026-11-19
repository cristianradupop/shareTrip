// Better Auth endpoints the app actually uses, relative to /api/auth. Everything else
// (update-user, change-password, admin/*, ...) is refused so it cannot bypass our handlers.
const ALLOWED_AUTH_PATHS = new Set([
  "/sign-in/email",
  "/sign-in/username",
  "/sign-out",
  "/get-session",
  "/sign-up/email",
]);

export function isAllowedAuthPath(pathname: string): boolean {
  return ALLOWED_AUTH_PATHS.has(pathname);
}

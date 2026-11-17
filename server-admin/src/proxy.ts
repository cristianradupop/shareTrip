import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Cheap first gate: no session cookie -> go to the login page.
// This is NOT the security boundary. Every page, route and action re-checks the real session
// and the role on the server (see src/lib/session.ts).
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const { pathname, search } = request.nextUrl;
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/organizer/:path*", "/joiner/:path*", "/feed/:path*", "/admin/:path*"],
};

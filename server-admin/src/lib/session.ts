import "server-only";
import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { SessionUser } from "server-app/shared";
import { apiFetch } from "@/lib/api";

export type AppUser = SessionUser & { name: string };

// One session lookup per request, however many components ask for it.
// No session cookie means no lookup; otherwise server-app decides (expired or revoked sessions give null).
export const getSession = cache(async (): Promise<{ user: AppUser } | null> => {
  if (!getSessionCookie(await headers())) return null;
  const res = await apiFetch("/api/session");
  if (res.status >= 500) throw new Error(`server-app /api/session answered ${res.status}`);
  if (!res.ok) return null;
  const { user } = (await res.json()) as { user: SessionUser | null };
  if (!user) return null;
  return { user: { ...user, name: `${user.firstName} ${user.lastName}`.trim() } };
});

/** Any logged-in user. Redirects to /login otherwise. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

/** Administrators only. Call this in EVERY admin page: the proxy is not a security boundary, and server-app re-checks too. */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.user.role !== "admin") redirect("/?forbidden=admin");
  return session.user;
}

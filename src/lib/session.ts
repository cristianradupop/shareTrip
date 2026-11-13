import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

// One session lookup per request, however many components ask for it.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Any logged-in user. Redirects to /login otherwise. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

/** Administrators only. Call this in EVERY admin page and action: the proxy is not a security boundary. */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.user.role !== "admin") redirect("/?forbidden=admin");
  return session.user;
}

export async function assertAdmin() {
  const session = await getSession();
  if (!session || session.user.role !== "admin") throw new Error("Forbidden");
  return session.user;
}

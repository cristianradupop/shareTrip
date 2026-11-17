import "server-only";
import { auth } from "@/lib/auth";

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
type Guard = { ok: true; user: Session["user"] } | { ok: false; response: Response };

export function jsonError(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}

/** Reads the session from the request cookies. Does not refresh it (handlers are not the place to set cookies here). */
export async function getApiSession(req: Request) {
  return auth.api.getSession({ headers: req.headers, query: { disableRefresh: true } });
}

/** Any logged-in user, otherwise a 401 Response to return as is. */
export async function requireApiUser(req: Request): Promise<Guard> {
  const session = await getApiSession(req);
  if (!session) return { ok: false, response: jsonError("Not signed in", 401) };
  return { ok: true, user: session.user };
}

/** Administrators only: 401 without a session, 403 for any other role. Call it before reading the body. */
export async function requireApiAdmin(req: Request): Promise<Guard> {
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard;
  if (guard.user.role !== "admin") return { ok: false, response: jsonError("Forbidden", 403) };
  return guard;
}

/**
 * Rejects a mutating request whose Origin header names another site (CSRF defence on top of SameSite cookies).
 * A missing Origin is allowed (curl, server-to-server). Returns a 403 Response to return as is, or null.
 */
export function checkSameOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (origin === null) return null;
  let allowed: string | null = null;
  try {
    allowed = new URL(process.env.BETTER_AUTH_URL ?? "").origin;
  } catch {
    // misconfigured: nothing can match, so refuse
  }
  if (origin !== allowed) return jsonError("Cross-origin request refused", 403);
  return null;
}

/** 415 unless the body is declared as JSON. */
export function requireJson(req: Request): Response | null {
  const type = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  return type === "application/json" ? null : jsonError("Content-Type must be application/json", 415);
}

/** Parses a JSON body; null when it is missing or malformed. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function isUniqueViolation(e: unknown) {
  const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

import { listUsers } from "@/data/users";
import { checkSameOrigin, isUniqueViolation, jsonError, readJson, requireApiAdmin, requireJson } from "@/lib/api-auth";
import { createCredentialUser } from "@/lib/user-service";
import { adminCreateUserSchema } from "@/lib/validators";

export async function GET(req: Request) {
  const guard = await requireApiAdmin(req);
  if (!guard.ok) return guard.response;

  const sp = new URL(req.url).searchParams;
  const page = Math.min(10_000, Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1));
  const q = sp.get("q")?.slice(0, 100) || undefined;
  return Response.json(await listUsers({ q, page }));
}

export async function POST(req: Request) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiAdmin(req);
  if (!guard.ok) return guard.response;
  const notJson = requireJson(req);
  if (notJson) return notJson;

  const parsed = adminCreateUserSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);
  try {
    await createCredentialUser(parsed.data, { actor: { id: guard.user.id, name: guard.user.name } });
  } catch (e) {
    if (isUniqueViolation(e)) return jsonError("That username or email is already in use", 409);
    return jsonError("Could not create the user", 400);
  }
  return Response.json({ ok: true });
}

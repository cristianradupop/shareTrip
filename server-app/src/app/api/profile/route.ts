import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { checkSameOrigin, jsonError, readJson, requireApiUser, requireJson } from "@/lib/api-auth";
import { profileSchema } from "@/lib/validators";

/** Lets a signed-in user edit their own profile (for now only the gender). The row id always comes from the session. */
export async function PATCH(req: Request) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;
  const notJson = requireJson(req);
  if (notJson) return notJson;

  const parsed = profileSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);
  try {
    await db.update(user).set({ gender: parsed.data.gender }).where(eq(user.id, guard.user.id));
  } catch {
    return jsonError("Could not update the profile", 400);
  }
  return Response.json({ ok: true });
}

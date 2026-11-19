import { z } from "zod";
import { approveRequest, declineRequest, getTripOwner } from "@/data/requests";
import { checkSameOrigin, jsonError, readJson, requireApiUser, requireJson } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string; userId: string }> };

const decisionSchema = z.object({ action: z.enum(["approve", "decline"], "Choose approve or decline") });

/** The trip's organizer approves or declines one pending request. Ownership is checked here, admins get no exception. */
export async function PATCH(req: Request, ctx: Ctx) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;
  const notJson = requireJson(req);
  if (notJson) return notJson;
  const { id, userId } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError("Trip not found", 404);
  if ((await getTripOwner(id)) !== guard.user.id) return jsonError("Trip not found", 404);

  const parsed = decisionSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);

  if (parsed.data.action === "decline") {
    if (!(await declineRequest(id, userId))) return jsonError("This request is not pending", 409);
    return Response.json({ ok: true });
  }
  const result = await approveRequest(id, userId, new Date().toISOString().slice(0, 10));
  if (!result.ok) return jsonError(result.error, result.status);
  return Response.json({ ok: true, autoDeclined: result.autoDeclined });
}

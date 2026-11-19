import { z } from "zod";
import { leaveTrip, loadJoinContext } from "@/data/requests";
import { checkSameOrigin, jsonError, requireApiUser } from "@/lib/api-auth";
import { checkCanLeave } from "@/lib/join-rules";

type Ctx = { params: Promise<{ id: string }> };

/** The caller leaves a trip they joined, before departure. */
export async function DELETE(req: Request, ctx: Ctx) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError("Trip not found", 404);

  const trip = await loadJoinContext(id, guard.user.id);
  if (!trip) return jsonError("Trip not found", 404);
  const verdict = checkCanLeave(trip, new Date().toISOString().slice(0, 10));
  if (!verdict.ok) return jsonError(verdict.error, verdict.status);

  await leaveTrip(id, guard.user.id);
  return Response.json({ ok: true, viewerState: "join", joined: Math.max(0, trip.joined - 1) });
}

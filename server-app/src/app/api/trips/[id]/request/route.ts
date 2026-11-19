import { z } from "zod";
import { createJoinRequest, loadJoinContext, withdrawRequest } from "@/data/requests";
import { checkSameOrigin, jsonError, requireApiUser } from "@/lib/api-auth";
import { feedViewer } from "@/lib/feed-params";
import { checkCanRequest } from "@/lib/join-rules";

type Ctx = { params: Promise<{ id: string }> };

const today = () => new Date().toISOString().slice(0, 10);

/** Asks to join a trip. The user is always the session user. */
export async function POST(req: Request, ctx: Ctx) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError("Trip not found", 404);

  const trip = await loadJoinContext(id, guard.user.id);
  if (!trip) return jsonError("Trip not found", 404);
  const verdict = checkCanRequest(trip, feedViewer(guard.user), today());
  if (!verdict.ok) return jsonError(verdict.error, verdict.status);

  const created = await createJoinRequest(id, guard.user.id);
  if (!created.ok) return jsonError(created.error, created.status);
  return Response.json({ ok: true, viewerState: "requested", joined: trip.joined });
}

/** Withdraws the caller's pending request. */
export async function DELETE(req: Request, ctx: Ctx) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError("Trip not found", 404);

  const trip = await loadJoinContext(id, guard.user.id);
  if (!trip) return jsonError("Trip not found", 404);
  if (trip.isMember || trip.requestStatus !== "pending") return jsonError("You have no pending request for this trip", 409);
  if (!(await withdrawRequest(id, guard.user.id))) return jsonError("Your request was already decided", 409);
  return Response.json({ ok: true, viewerState: "join", joined: trip.joined });
}

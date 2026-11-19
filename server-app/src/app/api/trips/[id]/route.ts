import { z } from "zod";
import { checkSameOrigin, jsonError, readJson, requireApiUser, requireJson } from "@/lib/api-auth";
import { canEditTrip, tripSchema } from "@/lib/validators";
import { getOrganizerTripForEdit, updateOrganizerTrip } from "@/data/trips";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;
  const notJson = requireJson(req);
  if (notJson) return notJson;

  // A malformed id is treated like an unknown one (Postgres would throw on a bad uuid).
  const { id } = await ctx.params;
  if (!z.guid().safeParse(id).success) return jsonError("Trip not found", 404);

  const parsed = tripSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid trip data", 400);
  const t = parsed.data;

  // The organizer is always the logged-in user: other people's trips (admins included) are simply not found.
  const trip = await getOrganizerTripForEdit(id, guard.user.id);
  if (!trip) return jsonError("Trip not found", 404);
  if (!canEditTrip(trip)) return jsonError("Cancelled or past trips cannot be edited", 409);
  if (t.maxTravelers < trip.joined) {
    return jsonError(`${trip.joined} travelers already joined, so max travelers cannot be lower than ${trip.joined}`, 400);
  }

  if (!(await updateOrganizerTrip(id, guard.user.id, t))) return jsonError("Trip not found", 404);
  return Response.json({ ok: true });
}

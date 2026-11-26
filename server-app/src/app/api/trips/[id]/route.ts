import { z } from "zod";
import { checkSameOrigin, jsonError, requireApiUser, requireMultipart } from "@/lib/api-auth";
import { deleteTripPhoto, uploadTripPhoto } from "@/lib/storage";
import { readTripForm } from "@/lib/trip-upload";
import { canEditTrip } from "@/lib/validators";
import { getOrganizerTripForEdit, updateOrganizerTrip } from "@/data/trips";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;
  const notMultipart = requireMultipart(req);
  if (notMultipart) return notMultipart;

  // A malformed id is treated like an unknown one (Postgres would throw on a bad uuid).
  const { id } = await ctx.params;
  if (!z.guid().safeParse(id).success) return jsonError("Trip not found", 404);

  const form = await readTripForm(req);
  if (!form.ok) return form.response;
  const t = form.trip;

  // The organizer is always the logged-in user: other people's trips (admins included) are simply not found.
  const trip = await getOrganizerTripForEdit(id, guard.user.id);
  if (!trip) return jsonError("Trip not found", 404);
  if (!canEditTrip(trip)) return jsonError("Cancelled or past trips cannot be edited", 409);
  if (t.maxTravelers < trip.joined) {
    return jsonError(`${trip.joined} travelers already joined, so max travelers cannot be lower than ${trip.joined}`, 400);
  }

  // The photo is optional on edit: without one the current photo is kept.
  let newUrl: string | undefined;
  if (form.photo) {
    const photo = await uploadTripPhoto(form.photo);
    if (!photo.ok) return jsonError(photo.error, 400);
    newUrl = photo.url;
  }

  const actor = { id: guard.user.id, name: guard.user.name, role: "user" as const };
  let result: Awaited<ReturnType<typeof updateOrganizerTrip>>;
  try {
    result = await updateOrganizerTrip(id, guard.user.id, t, actor, newUrl);
  } catch {
    await deleteTripPhoto(newUrl);
    return jsonError("Could not update the trip. Try again.", 500);
  }
  if (!result) {
    await deleteTripPhoto(newUrl);
    return jsonError("Trip not found", 404);
  }
  if (newUrl) await deleteTripPhoto(result.previousPhotoUrl);
  return Response.json({ ok: true });
}

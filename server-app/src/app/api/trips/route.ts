import { db } from "@/db/client";
import { trips } from "@/db/schema";
import { buildEvent, recordEvent, tripSubject } from "@/lib/audit";
import { checkSameOrigin, jsonError, requireMultipart, requireApiUser } from "@/lib/api-auth";
import { deleteTripPhoto, uploadTripPhoto } from "@/lib/storage";
import { readTripForm } from "@/lib/trip-upload";
import { TRIP_PHOTO_REQUIRED } from "@/lib/validators";

export async function POST(req: Request) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;
  const notMultipart = requireMultipart(req);
  if (notMultipart) return notMultipart;

  const form = await readTripForm(req);
  if (!form.ok) return form.response;
  const t = form.trip;
  if (!form.photo) return jsonError(TRIP_PHOTO_REQUIRED, 400);
  const photo = await uploadTripPhoto(form.photo);
  if (!photo.ok) return jsonError(photo.error, 400);

  // The organizer is always the logged-in user, never a value from the body.
  // The actor role is the capacity (organizer), not the account role: an admin creating a trip is logged as "user".
  const actor = { id: guard.user.id, name: guard.user.name, role: "user" as const };
  let created: { id: string };
  try {
    created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(trips)
        .values({
          organizerId: guard.user.id,
          destinationCity: t.destinationCity,
          destinationCountry: t.destinationCountry,
          departureDate: t.departureDate,
          returnDate: t.returnDate || null,
          maxTravelers: t.maxTravelers,
          gender: t.gender,
          budgetEstimate: t.budgetEstimate.toFixed(2),
          currency: t.currency,
          transport: t.transport,
          theme: t.theme,
          photoUrl: photo.url,
        })
        .returning({ id: trips.id });
      await recordEvent(
        tx,
        buildEvent("trip.created", actor, tripSubject({ id: row.id, ...t })),
      );
      return row;
    });
  } catch {
    await deleteTripPhoto(photo.url);
    return jsonError("Could not create the trip. Try again.", 500);
  }

  return Response.json({ ok: true, id: created.id });
}

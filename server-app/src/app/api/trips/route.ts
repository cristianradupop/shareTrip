import { db } from "@/db/client";
import { trips } from "@/db/schema";
import { buildEvent, recordEvent, tripSubject } from "@/lib/audit";
import { checkSameOrigin, jsonError, requireJson, readJson, requireApiUser } from "@/lib/api-auth";
import { tripSchema } from "@/lib/validators";

export async function POST(req: Request) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;
  const notJson = requireJson(req);
  if (notJson) return notJson;

  const parsed = tripSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid trip data", 400);
  const t = parsed.data;

  // The organizer is always the logged-in user, never a value from the body.
  // The actor role is the capacity (organizer), not the account role: an admin creating a trip is logged as "user".
  const actor = { id: guard.user.id, name: guard.user.name, role: "user" as const };
  const created = await db.transaction(async (tx) => {
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
      })
      .returning({ id: trips.id });
    await recordEvent(
      tx,
      buildEvent("trip.created", actor, tripSubject({ id: row.id, ...t })),
    );
    return row;
  });

  return Response.json({ ok: true, id: created.id });
}

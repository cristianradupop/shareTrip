"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { trips } from "@/db/schema";
import { getTripsSince, type FeedSort, getFeed } from "@/data/trips";
import { requireUser } from "@/lib/session";
import { tripSchema, type TripFormInput } from "@/lib/validators";

export async function createTripAction(
  input: TripFormInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser(); // the organizer is always the logged-in user
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid trip data" };
  const t = parsed.data;

  const [created] = await db
    .insert(trips)
    .values({
      organizerId: user.id,
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

  // The trip is automatically shared in the community feed (spec).
  revalidatePath("/organizer", "layout");
  revalidatePath("/feed");
  return { ok: true, id: created.id };
}

// ---- Community feed (read-only for now) ----

export async function loadMoreFeedAction(opts: { city?: string; sort: FeedSort; cursor: string }) {
  await requireUser();
  return getFeed(opts);
}

/** Refresh button: only trips published since the last refresh, newest first. */
export async function refreshFeedAction(opts: { since: string; city?: string }) {
  await requireUser();
  const since = new Date(opts.since);
  if (Number.isNaN(since.getTime())) throw new Error("Invalid date");
  const now = new Date().toISOString(); // taken before the query so nothing falls between two refreshes
  return { trips: await getTripsSince(since, opts.city), now };
}

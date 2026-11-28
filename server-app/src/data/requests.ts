import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { tripMembers, tripRequests, trips, user } from "@/db/schema";
import { isUniqueViolation } from "@/lib/api-auth";
import { buildEvent, recordEvent, tripSubject, type Actor } from "@/lib/audit";
import {
  ageOn,
  checkCanApprove,
  fillsLastSeat,
  type AccountGender,
  type JoinContext,
  type RequestStatus,
  type RuleResult,
} from "@/lib/join-rules";
import type { JoinerRequest } from "@/shared/types";

const asGender = (g: string | null): AccountGender | null => (g === "male" || g === "female" ? g : null);

export type Person = { userId: string; name: string; image: string | null; age: number; gender: AccountGender | null };

export async function getJoinerRequests(joinerId: string): Promise<JoinerRequest[]> {
  return db
    .select({
      tripId: tripRequests.tripId,
      status: tripRequests.status,
      destinationCity: trips.destinationCity,
      destinationCountry: trips.destinationCountry,
      departureDate: trips.departureDate,
      returnDate: trips.returnDate,
      photoUrl: trips.photoUrl,
      organizerImage: user.image,
      organizerName: sql<string>`${user.firstName} || ' ' || left(${user.lastName}, 1) || '.''`,
    })
    .from(tripRequests)
    .innerJoin(trips, eq(trips.id, tripRequests.tripId))
    .innerJoin(user, eq(user.id, trips.organizerId))
    .where(eq(tripRequests.userId, joinerId))
    .orderBy(desc(tripRequests.createdAt));
}

/** Everything the join rules need about one trip and one user. Null when the trip does not exist. */
export async function loadJoinContext(tripId: string, userId: string): Promise<JoinContext | null> {
  const [row] = await db
    .select({
      organizerId: trips.organizerId,
      status: trips.status,
      departureDate: trips.departureDate,
      maxTravelers: trips.maxTravelers,
      tripGender: trips.gender,
      joined: sql<number>`(select count(*) from ${tripMembers} where ${tripMembers.tripId} = ${trips.id})`.mapWith(Number),
      isMember: sql<boolean>`exists (select 1 from ${tripMembers} where ${tripMembers.tripId} = ${trips.id} and ${tripMembers.userId} = ${userId})`,
      requestStatus: sql<RequestStatus | null>`(select ${tripRequests.status} from ${tripRequests} where ${tripRequests.tripId} = ${trips.id} and ${tripRequests.userId} = ${userId})`,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);
  return row ?? null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The audit subject of a trip, read inside the transaction that logs the event. */
async function tripSubjectOf(tx: Tx, tripId: string) {
  const [row] = await tx
    .select({ id: trips.id, destinationCity: trips.destinationCity, destinationCountry: trips.destinationCountry })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);
  if (!row) throw new Error("audit: trip not found");
  return tripSubject(row);
}

export async function createJoinRequest(tripId: string, userId: string, actor: Actor): Promise<RuleResult> {
  try {
    await db.transaction(async (tx) => {
      await tx.insert(tripRequests).values({ tripId, userId });
      await recordEvent(tx, buildEvent("trip.requested", actor, await tripSubjectOf(tx, tripId)));
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, status: 409, error: "You already sent a request for this trip" };
    throw e;
  }
  return { ok: true };
}

/** Deletes a still-pending request. False when there was nothing pending (it was decided meanwhile). */
export async function withdrawRequest(tripId: string, userId: string, actor: Actor): Promise<boolean> {
  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(tripRequests)
      .where(and(eq(tripRequests.tripId, tripId), eq(tripRequests.userId, userId), eq(tripRequests.status, "pending")))
      .returning({ userId: tripRequests.userId });
    if (deleted.length === 0) return false;
    await recordEvent(tx, buildEvent("trip.withdrawn", actor, await tripSubjectOf(tx, tripId)));
    return true;
  });
}

export async function leaveTrip(tripId: string, userId: string, actor: Actor): Promise<void> {
  await db.transaction(async (tx) => {
    const left = await tx
      .delete(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)))
      .returning({ userId: tripMembers.userId });
    await tx
      .delete(tripRequests)
      .where(and(eq(tripRequests.tripId, tripId), eq(tripRequests.userId, userId), eq(tripRequests.status, "approved")));
    if (left.length > 0) await recordEvent(tx, buildEvent("trip.left", actor, await tripSubjectOf(tx, tripId)));
  });
}

// ---------------- Organizer side ----------------

export async function getTripOwner(tripId: string): Promise<string | null> {
  const [row] = await db.select({ organizerId: trips.organizerId }).from(trips).where(eq(trips.id, tripId)).limit(1);
  return row?.organizerId ?? null;
}

// Only what the organizer needs to decide: no email, phone or birth date leave the server.
const personColumns = {
  userId: user.id,
  name: sql<string>`${user.firstName} || ' ' || left(${user.lastName}, 1) || '.'`,
  image: user.image,
  birthDate: user.birthDate,
  gender: user.gender,
};

type PersonRow = { userId: string; name: string; image: string | null; birthDate: string; gender: string | null };
const toPerson = (r: PersonRow, today: string): Person => ({
  userId: r.userId,
  name: r.name,
  image: r.image,
  age: ageOn(r.birthDate, today),
  gender: asGender(r.gender),
});

export async function listTripPeople(tripId: string, today: string): Promise<{ pending: Person[]; members: Person[] }> {
  const [pending, members] = await Promise.all([
    db
      .select(personColumns)
      .from(tripRequests)
      .innerJoin(user, eq(user.id, tripRequests.userId))
      .where(and(eq(tripRequests.tripId, tripId), eq(tripRequests.status, "pending")))
      .orderBy(tripRequests.createdAt),
    db
      .select(personColumns)
      .from(tripMembers)
      .innerJoin(user, eq(user.id, tripMembers.userId))
      .where(eq(tripMembers.tripId, tripId))
      .orderBy(tripMembers.joinedAt),
  ]);
  return { pending: pending.map((r) => toPerson(r, today)), members: members.map((r) => toPerson(r, today)) };
}

/**
 * Approves a pending request in one transaction. The trip row is locked first, so two approvals cannot both
 * take the last seat. When the approval fills the trip, every other pending request is declined.
 */
export async function approveRequest(
  tripId: string,
  userId: string,
  today: string,
  actor: Actor,
): Promise<{ ok: true; autoDeclined: number } | { ok: false; status: number; error: string }> {
  return db.transaction(async (tx) => {
    const [trip] = await tx
      .select({
        organizerId: trips.organizerId,
        destinationCity: trips.destinationCity,
        destinationCountry: trips.destinationCountry,
        status: trips.status,
        departureDate: trips.departureDate,
        maxTravelers: trips.maxTravelers,
        tripGender: trips.gender,
      })
      .from(trips)
      .where(eq(trips.id, tripId))
      .for("update");
    if (!trip) return { ok: false as const, status: 404, error: "Trip not found" };

    const [request] = await tx
      .select({ status: tripRequests.status, gender: user.gender, name: user.name })
      .from(tripRequests)
      .innerJoin(user, eq(user.id, tripRequests.userId))
      .where(and(eq(tripRequests.tripId, tripId), eq(tripRequests.userId, userId)))
      .for("update", { of: tripRequests });
    if (!request) return { ok: false as const, status: 404, error: "Request not found" };
    if (request.status !== "pending") return { ok: false as const, status: 409, error: "This request was already decided" };

    const [{ joined }] = await tx.select({ joined: count() }).from(tripMembers).where(eq(tripMembers.tripId, tripId));
    const verdict = checkCanApprove(
      { ...trip, joined, isMember: false, requestStatus: "pending" },
      asGender(request.gender),
      today,
    );
    if (!verdict.ok) return verdict;

    // Marking the request first, guarded by its status: if it was decided meanwhile, no member row is added.
    const approved = await tx
      .update(tripRequests)
      .set({ status: "approved", decidedAt: new Date() })
      .where(and(eq(tripRequests.tripId, tripId), eq(tripRequests.userId, userId), eq(tripRequests.status, "pending")))
      .returning({ userId: tripRequests.userId });
    if (approved.length === 0) return { ok: false as const, status: 409, error: "This request is no longer pending." };
    await tx.insert(tripMembers).values({ tripId, userId });

    let autoDeclined = 0;
    if (fillsLastSeat(joined + 1, trip.maxTravelers)) {
      const declined = await tx
        .update(tripRequests)
        .set({ status: "declined", decidedAt: new Date() })
        .where(and(eq(tripRequests.tripId, tripId), eq(tripRequests.status, "pending")))
        .returning({ userId: tripRequests.userId });
      autoDeclined = declined.length;
    }
    await recordEvent(
      tx,
      buildEvent(
        "trip.approved",
        actor,
        tripSubject({ id: tripId, destinationCity: trip.destinationCity, destinationCountry: trip.destinationCountry }),
        { autoDeclined, related: { id: userId, label: request.name } },
      ),
    );
    return { ok: true as const, autoDeclined };
  });
}

/** Declines a pending request. False when there was nothing pending. */
export async function declineRequest(tripId: string, userId: string, actor: Actor): Promise<boolean> {
  return db.transaction(async (tx) => {
    const declined = await tx
      .update(tripRequests)
      .set({ status: "declined", decidedAt: new Date() })
      .where(and(eq(tripRequests.tripId, tripId), eq(tripRequests.userId, userId), eq(tripRequests.status, "pending")))
      .returning({ userId: tripRequests.userId });
    if (declined.length === 0) return false;
    const [applicant] = await tx.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1);
    await recordEvent(
      tx,
      buildEvent("trip.declined", actor, await tripSubjectOf(tx, tripId), {
        related: { id: userId, label: applicant?.name ?? "" },
      }),
    );
    return true;
  });
}


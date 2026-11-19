import "server-only";
import { and, count, desc, eq, getTableColumns, gt, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { tripMembers, tripRequests, trips, user } from "@/db/schema";
import { encodeFeedCursor } from "@/lib/feed-params";
import { isTripFull, viewerJoinState, type AccountGender, type RequestStatus } from "@/lib/join-rules";
import type { FeedTrip, OrganizerStats, OrganizerTrip } from "@/shared/types";

const todayIso = () => new Date().toISOString().slice(0, 10);

// Number of members (joiners) per trip. The organizer is not counted here.
const joinedCounts = db
  .select({ tripId: tripMembers.tripId, n: count().as("n") })
  .from(tripMembers)
  .groupBy(tripMembers.tripId)
  .as("joined_counts");
const joinedExpr = sql<number>`coalesce(${joinedCounts.n}, 0)`.mapWith(Number);

// Pending join requests per trip, for the organizer's badge and requests dialog.
const pendingCounts = db
  .select({ tripId: tripRequests.tripId, n: count().as("pending_n") })
  .from(tripRequests)
  .where(eq(tripRequests.status, "pending"))
  .groupBy(tripRequests.tripId)
  .as("pending_counts");
// Only requests that can still be decided count: the trip is not cancelled and has not departed. Built per call because of the date.
const pendingOpen = () =>
  sql`case when ${trips.status} <> 'cancelled' and ${trips.departureDate} >= ${todayIso()} then coalesce(${pendingCounts.n}, 0) else 0 end`;

// ---------------- Organizer dashboard ----------------

export async function getOrganizerTrips(organizerId: string, limit?: number): Promise<OrganizerTrip[]> {
  const query = db
    .select({ ...getTableColumns(trips), joined: joinedExpr, pending: sql<number>`${pendingOpen()}`.mapWith(Number) })
    .from(trips)
    .leftJoin(joinedCounts, eq(joinedCounts.tripId, trips.id))
    .leftJoin(pendingCounts, eq(pendingCounts.tripId, trips.id))
    .where(eq(trips.organizerId, organizerId))
    .orderBy(desc(trips.createdAt));
  const rows = await (limit ? query.limit(limit) : query);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function getOrganizerStats(organizerId: string): Promise<OrganizerStats> {
  const [row] = await db
    .select({
      trips: count(trips.id),
      participants: sql<number>`coalesce(sum(${joinedCounts.n}), 0)`.mapWith(Number),
      upcoming: sql<number>`count(*) filter (where ${trips.departureDate} >= ${todayIso()} and ${trips.status} <> 'cancelled')`.mapWith(Number),
      pendingRequests: sql<number>`coalesce(sum(${pendingOpen()}), 0)`.mapWith(Number),
    })
    .from(trips)
    .leftJoin(joinedCounts, eq(joinedCounts.tripId, trips.id))
    .leftJoin(pendingCounts, eq(pendingCounts.tripId, trips.id))
    .where(eq(trips.organizerId, organizerId));
  return row ?? { trips: 0, participants: 0, upcoming: 0, pendingRequests: 0 };
}

// ---------------- Community feed ----------------

const feedColumns = {
  id: trips.id,
  city: trips.destinationCity,
  country: trips.destinationCountry,
  departureDate: trips.departureDate,
  returnDate: trips.returnDate,
  budget: trips.budgetEstimate,
  currency: trips.currency,
  transport: trips.transport,
  gender: trips.gender,
  theme: trips.theme,
  maxTravelers: trips.maxTravelers,
  status: trips.status,
  createdAt: trips.createdAt,
  // created_at with microseconds: JS Dates keep only milliseconds, which would skip or repeat rows between pages.
  cursorKey: sql<string>`to_char(${trips.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US')`,
  joined: joinedExpr,
  organizerName: sql<string>`${user.firstName} || ' ' || left(${user.lastName}, 1) || '.'`,
  organizerImage: user.image,
};

type FeedRow = {
  id: string;
  city: string;
  country: string;
  departureDate: string;
  returnDate: string | null;
  budget: string;
  currency: string;
  transport: string;
  gender: string;
  theme: string;
  maxTravelers: number;
  status: "active" | "full" | "cancelled";
  createdAt: Date;
  cursorKey: string;
  joined: number;
  organizerName: string;
  organizerImage: string | null;
  // Present only when the query was run for a viewer.
  isMember?: boolean;
  requestStatus?: RequestStatus | null;
};

export type FeedViewer = { id: string; gender: AccountGender | null };

// Scalar subqueries for the viewer's own membership and request; constants when there is no viewer.
const viewerColumns = (viewer?: FeedViewer) => ({
  isMember: viewer
    ? sql<boolean>`exists (select 1 from ${tripMembers} where ${tripMembers.tripId} = ${trips.id} and ${tripMembers.userId} = ${viewer.id})`
    : sql<boolean>`false`,
  requestStatus: viewer
    ? sql<RequestStatus | null>`(select ${tripRequests.status} from ${tripRequests} where ${tripRequests.tripId} = ${trips.id} and ${tripRequests.userId} = ${viewer.id})`
    : sql<RequestStatus | null>`null`,
});

export const toFeedTrip = (r: FeedRow, viewer?: FeedViewer): FeedTrip => ({
  id: r.id,
  city: r.city,
  country: r.country,
  departureDate: r.departureDate,
  returnDate: r.returnDate,
  budget: r.budget,
  currency: r.currency,
  transport: r.transport,
  gender: r.gender,
  theme: r.theme,
  maxTravelers: r.maxTravelers,
  status: r.status === "full" ? "full" : "active",
  createdAt: r.createdAt.toISOString(),
  joined: r.joined,
  organizerName: r.organizerName,
  organizerImage: r.organizerImage,
  ...(viewer && {
    viewerState: viewerJoinState({
      isMember: Boolean(r.isMember),
      requestStatus: r.requestStatus ?? null,
      full: isTripFull({ status: r.status === "full" ? "full" : "active", joined: r.joined, maxTravelers: r.maxTravelers }),
      tripGender: r.gender as "male" | "female" | "mixed",
      userGender: viewer.gender,
    }),
  }),
});

export const FEED_PAGE_SIZE = 20;

type FeedScope = { excludeOrganizerId?: string; viewer?: FeedViewer };

// Trips a visitor can still see: open or full, not yet departed, and not the caller's own.
const visibleConditions = ({ excludeOrganizerId }: FeedScope) => {
  const conditions = [inArray(trips.status, ["active", "full"]), gte(trips.departureDate, todayIso())];
  if (excludeOrganizerId) conditions.push(ne(trips.organizerId, excludeOrganizerId));
  return conditions;
};

export async function getFeed(opts: FeedScope & { city?: string; cursor?: { ts: string; id: string } }) {
  const conditions = visibleConditions(opts);
  if (opts.city) conditions.push(sql`lower(${trips.destinationCity}) = ${opts.city.toLowerCase()}`);

  // Keyset pagination on (created_at, id), newest first; the cursor timestamp keeps microseconds.
  if (opts.cursor) {
    conditions.push(sql`(${trips.createdAt}, ${trips.id}) < (${opts.cursor.ts}::timestamp, ${opts.cursor.id}::uuid)`);
  }

  const rows = await db
    .select({ ...feedColumns, ...viewerColumns(opts.viewer) })
    .from(trips)
    .innerJoin(user, eq(user.id, trips.organizerId))
    .leftJoin(joinedCounts, eq(joinedCounts.tripId, trips.id))
    .where(and(...conditions))
    .orderBy(desc(trips.createdAt), desc(trips.id))
    .limit(FEED_PAGE_SIZE + 1);

  const hasMore = rows.length > FEED_PAGE_SIZE;
  const page = rows.slice(0, FEED_PAGE_SIZE);
  const last = page.at(-1);
  return {
    trips: page.map((r) => toFeedTrip(r, opts.viewer)),
    nextCursor: hasMore && last ? encodeFeedCursor(last.cursorKey, last.id) : null,
  };
}

/** Trips published after `since` (used by the Refresh button). Newest first. */
export async function getTripsSince(since: Date, city?: string, scope: FeedScope = {}) {
  const conditions = [...visibleConditions(scope), gt(trips.createdAt, since)];
  if (city) conditions.push(sql`lower(${trips.destinationCity}) = ${city.toLowerCase()}`);
  const rows = await db
    .select({ ...feedColumns, ...viewerColumns(scope.viewer) })
    .from(trips)
    .innerJoin(user, eq(user.id, trips.organizerId))
    .leftJoin(joinedCounts, eq(joinedCounts.tripId, trips.id))
    .where(and(...conditions))
    .orderBy(desc(trips.createdAt), desc(trips.id))
    .limit(50);
  return rows.map((r) => toFeedTrip(r, scope.viewer));
}

/** Cities of the currently visible upcoming trips, for the filter drop-down. */
export async function getActiveCities(scope: FeedScope = {}) {
  const rows = await db
    .select({ city: sql<string>`min(${trips.destinationCity})` })
    .from(trips)
    .where(and(...visibleConditions(scope)))
    .groupBy(sql`lower(${trips.destinationCity})`)
    .orderBy(sql`min(${trips.destinationCity})`);
  return rows.map((r) => r.city);
}

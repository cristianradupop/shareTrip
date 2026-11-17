import "server-only";
import { and, asc, count, desc, eq, getTableColumns, gt, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { tripMembers, trips, user } from "@/db/schema";

const todayIso = () => new Date().toISOString().slice(0, 10);

// Number of members (joiners) per trip. The organizer is not counted here.
const joinedCounts = db
  .select({ tripId: tripMembers.tripId, n: count().as("n") })
  .from(tripMembers)
  .groupBy(tripMembers.tripId)
  .as("joined_counts");
const joinedExpr = sql<number>`coalesce(${joinedCounts.n}, 0)`.mapWith(Number);

// ---------------- Organizer dashboard ----------------

export async function getOrganizerTrips(organizerId: string, limit?: number) {
  const query = db
    .select({ ...getTableColumns(trips), joined: joinedExpr })
    .from(trips)
    .leftJoin(joinedCounts, eq(joinedCounts.tripId, trips.id))
    .where(eq(trips.organizerId, organizerId))
    .orderBy(desc(trips.createdAt));
  return limit ? query.limit(limit) : query;
}
export type OrganizerTrip = Awaited<ReturnType<typeof getOrganizerTrips>>[number];

export async function getOrganizerStats(organizerId: string) {
  const [row] = await db
    .select({
      trips: count(trips.id),
      participants: sql<number>`coalesce(sum(${joinedCounts.n}), 0)`.mapWith(Number),
      upcoming: sql<number>`count(*) filter (where ${trips.departureDate} >= ${todayIso()} and ${trips.status} <> 'cancelled')`.mapWith(Number),
    })
    .from(trips)
    .leftJoin(joinedCounts, eq(joinedCounts.tripId, trips.id))
    .where(eq(trips.organizerId, organizerId));
  return row ?? { trips: 0, participants: 0, upcoming: 0 };
}

// ---------------- Community feed ----------------

export type FeedSort = "asc" | "desc";

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
  createdAt: trips.createdAt,
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
  createdAt: Date;
  joined: number;
  organizerName: string;
  organizerImage: string | null;
};

/** JSON-safe shape that can be passed to client components. */
export type FeedTrip = Omit<FeedRow, "createdAt"> & { createdAt: string };
const toFeedTrip = (r: FeedRow): FeedTrip => ({ ...r, createdAt: r.createdAt.toISOString() });

export const FEED_PAGE_SIZE = 8;

export async function getFeed(opts: { city?: string; sort: FeedSort; cursor?: string }) {
  const conditions = [eq(trips.status, "active"), gte(trips.departureDate, todayIso())];
  if (opts.city) conditions.push(sql`lower(${trips.destinationCity}) = ${opts.city.toLowerCase()}`);

  // Keyset pagination on (departure_date, id): stable and fast even with many rows.
  if (opts.cursor) {
    const [d, id] = opts.cursor.split("|");
    if (d && id && /^\d{4}-\d{2}-\d{2}$/.test(d) && /^[0-9a-f-]{36}$/i.test(id)) {
      const op = opts.sort === "asc" ? sql`>` : sql`<`;
      conditions.push(sql`(${trips.departureDate}, ${trips.id}) ${op} (${d}::date, ${id}::uuid)`);
    }
  }

  const order = opts.sort === "asc" ? [asc(trips.departureDate), asc(trips.id)] : [desc(trips.departureDate), desc(trips.id)];
  const rows = await db
    .select(feedColumns)
    .from(trips)
    .innerJoin(user, eq(user.id, trips.organizerId))
    .leftJoin(joinedCounts, eq(joinedCounts.tripId, trips.id))
    .where(and(...conditions))
    .orderBy(...order)
    .limit(FEED_PAGE_SIZE + 1);

  const hasMore = rows.length > FEED_PAGE_SIZE;
  const page = rows.slice(0, FEED_PAGE_SIZE);
  const last = page.at(-1);
  return {
    trips: page.map(toFeedTrip),
    nextCursor: hasMore && last ? `${last.departureDate}|${last.id}` : null,
  };
}

/** Trips published after `since` (used by the Refresh button). Newest first. */
export async function getTripsSince(since: Date, city?: string) {
  const conditions = [eq(trips.status, "active"), gte(trips.departureDate, todayIso()), gt(trips.createdAt, since)];
  if (city) conditions.push(sql`lower(${trips.destinationCity}) = ${city.toLowerCase()}`);
  const rows = await db
    .select(feedColumns)
    .from(trips)
    .innerJoin(user, eq(user.id, trips.organizerId))
    .leftJoin(joinedCounts, eq(joinedCounts.tripId, trips.id))
    .where(and(...conditions))
    .orderBy(desc(trips.createdAt))
    .limit(50);
  return rows.map(toFeedTrip);
}

/** Cities of the currently active upcoming trips, for the filter drop-down. */
export async function getActiveCities() {
  const rows = await db
    .select({ city: sql<string>`min(${trips.destinationCity})` })
    .from(trips)
    .where(and(eq(trips.status, "active"), gte(trips.departureDate, todayIso())))
    .groupBy(sql`lower(${trips.destinationCity})`)
    .orderBy(sql`min(${trips.destinationCity})`);
  return rows.map((r) => r.city);
}

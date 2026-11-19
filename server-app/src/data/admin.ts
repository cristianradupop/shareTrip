import "server-only";
import { count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { tripMembers, tripRequests, trips, user } from "@/db/schema";
import type { AdminStats, AdminTripRow } from "@/shared/types";

export const ADMIN_TRIPS_PAGE_SIZE = 10;

const todayIso = () => new Date().toISOString().slice(0, 10);
// Postgres LIKE treats % and _ as wildcards and backslash as the escape character.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");
const num = (expr: SQL) => expr.mapWith(Number);

// Nothing writes trips.status = 'full', so "full" is derived like isTripFull: organizer + approved members
// reach max_travelers. Cancelled stays the stored status.
const memberCount = sql`(select count(*) from ${tripMembers} where ${tripMembers.tripId} = ${trips.id})`;
const isFull = sql`(${trips.status} <> 'cancelled' and (${trips.status} = 'full' or ${memberCount} + 1 >= ${trips.maxTravelers}))`;
const derivedStatus = sql<"active" | "full" | "cancelled">`case when ${trips.status} = 'cancelled' then 'cancelled' when ${isFull} then 'full' else 'active' end`;

export async function getAdminStats(): Promise<AdminStats> {
  const today = todayIso();
  const [[u], [t], [r], [m]] = await Promise.all([
    db
      .select({
        total: num(sql`count(*)`),
        banned: num(sql`count(*) filter (where ${user.banned} is true)`),
        admins: num(sql`count(*) filter (where ${user.role} = 'admin')`),
        last7Days: num(sql`count(*) filter (where ${user.createdAt} >= now() - interval '7 days')`),
        last30Days: num(sql`count(*) filter (where ${user.createdAt} >= now() - interval '30 days')`),
      })
      .from(user),
    db
      .select({
        active: num(sql`count(*) filter (where ${trips.status} <> 'cancelled' and not ${isFull})`),
        full: num(sql`count(*) filter (where ${isFull})`),
        cancelled: num(sql`count(*) filter (where ${trips.status} = 'cancelled')`),
        upcoming: num(sql`count(*) filter (where ${trips.status} <> 'cancelled' and ${trips.departureDate} >= ${today})`),
        departed: num(sql`count(*) filter (where ${trips.status} <> 'cancelled' and ${trips.departureDate} < ${today})`),
      })
      .from(trips),
    db
      .select({
        pending: num(sql`count(*) filter (where ${tripRequests.status} = 'pending')`),
        approved: num(sql`count(*) filter (where ${tripRequests.status} = 'approved')`),
        declined: num(sql`count(*) filter (where ${tripRequests.status} = 'declined')`),
      })
      .from(tripRequests),
    db.select({ members: count() }).from(tripMembers),
  ]);
  return { users: { ...u, active: u.total - u.banned }, trips: t, requests: r, members: m.members };
}

export async function listAllTrips(opts: { q?: string; status?: "active" | "full" | "cancelled"; page: number }) {
  const q = opts.q?.trim();
  const pattern = `%${escapeLike(q ?? "")}%`;
  const search = q
    ? or(ilike(trips.destinationCity, pattern), ilike(user.name, pattern), ilike(user.email, pattern))
    : undefined;
  const statusFilter = opts.status ? sql`${derivedStatus} = ${opts.status}` : undefined;
  const where = search && statusFilter ? sql`(${search}) and ${statusFilter}` : (search ?? statusFilter);

  const [{ total }] = await db
    .select({ total: count() })
    .from(trips)
    .innerJoin(user, eq(user.id, trips.organizerId))
    .where(where);
  const rows = await db
    .select({
      t: trips,
      organizerName: user.name,
      organizerEmail: user.email,
      members: num(memberCount),
      status: derivedStatus,
    })
    .from(trips)
    .innerJoin(user, eq(user.id, trips.organizerId))
    .where(where)
    .orderBy(desc(trips.createdAt), desc(trips.id))
    .limit(ADMIN_TRIPS_PAGE_SIZE)
    .offset((opts.page - 1) * ADMIN_TRIPS_PAGE_SIZE);

  const list: AdminTripRow[] = rows.map((row) => ({
    id: row.t.id,
    city: row.t.destinationCity,
    country: row.t.destinationCountry,
    departureDate: row.t.departureDate,
    returnDate: row.t.returnDate,
    status: row.status,
    maxTravelers: row.t.maxTravelers,
    members: row.members,
    budget: row.t.budgetEstimate,
    currency: row.t.currency,
    transport: row.t.transport,
    gender: row.t.gender,
    theme: row.t.theme,
    organizerName: row.organizerName,
    organizerEmail: row.organizerEmail,
    createdAt: row.t.createdAt.toISOString(),
  }));
  return { trips: list, total, page: opts.page, pageSize: ADMIN_TRIPS_PAGE_SIZE };
}

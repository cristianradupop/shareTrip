import type { Metadata } from "next";
import type { AdminStats } from "server-app/shared";
import { apiGet } from "@/lib/api";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Statistics" };

export default async function AdminStatisticsPage() {
  await requireAdmin(); // checked again here: layouts do not protect direct data access
  const s = await apiGet<AdminStats>("/api/admin/stats");

  const groups: { title: string; tiles: [string, number][] }[] = [
    {
      title: "Accounts",
      tiles: [
        ["Total", s.users.total],
        ["Active", s.users.active],
        ["Banned", s.users.banned],
        ["Admins", s.users.admins],
        ["New, last 7 days", s.users.last7Days],
        ["New, last 30 days", s.users.last30Days],
      ],
    },
    {
      title: "Trips",
      tiles: [
        ["Active", s.trips.active],
        ["Full", s.trips.full],
        ["Cancelled", s.trips.cancelled],
        ["Upcoming", s.trips.upcoming],
        ["Departed", s.trips.departed],
      ],
    },
    {
      title: "Join requests",
      tiles: [
        ["Pending", s.requests.pending],
        ["Approved", s.requests.approved],
        ["Declined", s.requests.declined],
      ],
    },
    { title: "Members", tiles: [["Trip members", s.members]] },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Statistics</h1>
        <p className="mt-1 text-muted-foreground">Counts across the whole platform, as of now.</p>
      </div>
      {groups.map((g) => (
        <section key={g.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{g.title}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {g.tiles.map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-card p-4">
                <p className="text-2xl font-bold tabular-nums">{value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

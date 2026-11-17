import { Briefcase, CalendarClock, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrganizerTripCard } from "@/components/trips/organizer-trip-card";
import { CreateTripButton } from "@/components/trips/create-trip-dialog";
import { getOrganizerStats, getOrganizerTrips } from "@/data/trips";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Organizer" };

export default async function OrganizerDashboard({ searchParams }: PageProps<"/organizer">) {
  const user = await requireUser();
  const { new: openNew } = await searchParams;
  const [stats, trips] = await Promise.all([getOrganizerStats(user.id), getOrganizerTrips(user.id, 6)]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user.firstName}! 👋</h1>
          <p className="mt-1 text-muted-foreground">Plan your next adventure.</p>
        </div>
        <CreateTripButton defaultOpen={openNew === "1"} />
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Briefcase className="size-6" />} value={stats.trips} label="My Trips" tone="orange" />
        <StatCard icon={<Users className="size-6" />} value={stats.participants} label="Total Participants" tone="teal" />
        <StatCard icon={<CalendarClock className="size-6" />} value={stats.upcoming} label="Upcoming Trips" tone="amber" />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Trips</h2>
          {trips.length > 0 && (
            <Link href="/organizer/trips" className="text-sm font-medium text-primary hover:underline">
              View all →
            </Link>
          )}
        </div>

        {trips.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
            <p className="font-medium">You haven&apos;t organized any trips yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first trip and share it with the community.</p>
            <div className="mt-5 flex justify-center">
              <CreateTripButton label="Organize a trip" />
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {trips.map((t) => (
              <OrganizerTripCard key={t.id} trip={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const TONES = {
  orange: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  teal: "bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
};

function StatCard({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: keyof typeof TONES }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div className={`flex size-14 items-center justify-center rounded-xl ${TONES[tone]}`}>{icon}</div>
      <div>
        <p className="text-3xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

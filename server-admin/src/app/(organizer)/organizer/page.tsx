import { Briefcase, CalendarClock, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrganizerTripCard } from "@/components/trips/organizer-trip-card";
import { CreateTripButton } from "@/components/trips/create-trip-dialog";
import type { OrganizerStats, OrganizerTrip } from "server-app/shared";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Organizer" };

export default async function OrganizerDashboard({ searchParams }: PageProps<"/organizer">) {
  const user = await requireUser();
  const { new: openNew } = await searchParams;
  const [{ stats }, { trips }] = await Promise.all([
    apiGet<{ stats: OrganizerStats }>("/api/organizer/stats"),
    apiGet<{ trips: OrganizerTrip[] }>("/api/organizer/trips?limit=6"),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {user.firstName}! 👋</h1>
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
          <div className="rounded-[1.75rem] border border-dashed bg-card p-10 text-center">
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

// Bento tiles: red, ink and white, like the landing page.
const TONES = {
  orange: { tile: "bg-primary text-primary-foreground", icon: "bg-white/15", label: "text-primary-foreground/80" },
  teal: { tile: "bg-ink text-ink-foreground", icon: "bg-white/10 text-primary", label: "text-ink-foreground/65" },
  amber: { tile: "bg-card ring-1 ring-border", icon: "bg-primary/10 text-primary", label: "text-muted-foreground" },
};

function StatCard({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: keyof typeof TONES }) {
  const t = TONES[tone];
  return (
    <div className={`flex min-h-40 flex-col justify-between rounded-[1.75rem] p-6 ${t.tile}`}>
      <div className={`flex size-12 items-center justify-center rounded-full ${t.icon}`}>{icon}</div>
      <div>
        <p className="text-4xl font-semibold leading-none tracking-tight">{value}</p>
        <p className={`mt-2 text-sm ${t.label}`}>{label}</p>
      </div>
    </div>
  );
}

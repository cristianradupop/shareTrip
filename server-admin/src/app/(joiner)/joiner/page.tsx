import { ArrowRight, CalendarDays, Compass, Plane, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinerRequestCard } from "@/components/joiner/joiner-request-card";
import { JoinerTripCard } from "@/components/joiner/joiner-trip-card";
import { apiGet } from "@/lib/api";
import type { JoinerOverviewResponse, JoinerTripsResponse } from "server-app/shared";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Joiner Dashboard" };

export default async function JoinerPage() {
  const user = await requireUser();
  const [{ overview }, activity] = await Promise.all([
    apiGet<JoinerOverviewResponse>("/api/joiner/overview"),
    apiGet<JoinerTripsResponse>("/api/joiner/trips"),
  ]);
  const upcoming = activity.trips.filter((trip) => trip.status !== "cancelled" && trip.departureDate >= new Date().toISOString().slice(0, 10));
  const recentRequests = activity.requests.slice(0, 3);

  return (
    <div className="space-y-8">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-ink p-6 text-white sm:p-8 lg:p-10">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,oklch(0.64_0.205_19/0.45),transparent_55%)]" />
        <p className="text-sm font-medium text-white/65">Your traveler dashboard</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Ready for your next adventure, {user.firstName}?</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">Keep track of your trips, follow your requests, and discover a crew to travel with.</p>
        <Link href="/#trips" className="group mt-6 inline-flex h-12 items-center gap-3 rounded-full bg-white py-1 pl-5 pr-1.5 text-sm font-semibold text-ink transition-colors hover:bg-white/90">
          Explore trips <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><ArrowRight className="size-4" /></span>
        </Link>
      </section>

      <section aria-label="Joiner activity summary" className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={<Plane className="size-5" />} value={overview.trips} label="Trips you're joining" href="/joiner/trips" tone="ink" />
        <SummaryCard icon={<CalendarDays className="size-5" />} value={upcoming.length} label="Upcoming adventures" href="/joiner/trips" tone="primary" />
        <SummaryCard icon={<Compass className="size-5" />} value={overview.requests.pending} label="Requests awaiting a reply" href="/joiner/requests" tone="card" />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-sm font-medium text-primary">On your calendar</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Your next trips</h2></div>
          <Link href="/joiner/trips" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">All my trips <ArrowRight className="size-4" /></Link>
        </div>
        {upcoming.length ? (
          <div className="grid gap-4 xl:grid-cols-2">{upcoming.slice(0, 2).map((trip) => <JoinerTripCard key={trip.id} trip={trip} />)}</div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed bg-muted/40 p-7 text-center sm:p-9">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Compass className="size-6" /></span>
            <h3 className="mt-4 font-semibold">Your next adventure is waiting</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Browse community trips and send a request to join a group that fits your plans.</p>
            <Link href="/#trips" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Discover trips <ArrowRight className="size-4" /></Link>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-sm font-medium text-primary">Stay in the loop</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Recent requests</h2></div>
          <Link href="/joiner/requests" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">All requests <ArrowRight className="size-4" /></Link>
        </div>
        {recentRequests.length ? <div className="grid gap-3">{recentRequests.map((request) => <JoinerRequestCard key={request.tripId} request={request} />)}</div> : (
          <div className="rounded-[1.5rem] border border-dashed bg-muted/40 p-6 text-center">
            <p className="font-medium">No requests yet</p><p className="mt-1 text-sm text-muted-foreground">When you ask to join a trip, its progress will show here.</p>
          </div>
        )}
      </section>

      <Link href="/joiner/profile" className="flex items-center justify-between gap-4 rounded-[1.5rem] bg-primary/8 p-5 ring-1 ring-primary/15 transition-colors hover:bg-primary/12">
        <span className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-5" /></span><span><span className="block font-semibold">Complete your traveler profile</span><span className="text-sm text-muted-foreground">Keep your contact details up to date.</span></span></span><ArrowRight className="size-5 shrink-0 text-primary" />
      </Link>
    </div>
  );
}
function SummaryCard({ icon, value, label, href, tone }: { icon: React.ReactNode; value: number; label: string; href: string; tone: "ink" | "primary" | "card" }) {
  const styles = {
    ink: "bg-ink text-ink-foreground",
    primary: "bg-primary text-primary-foreground",
    card: "bg-card text-card-foreground ring-1 ring-border",
  };
  return (
    <Link href={href} className={`flex min-h-36 flex-col justify-between rounded-[1.5rem] p-5 transition-transform hover:-translate-y-0.5 ${styles[tone]}`}>
      <span className={`flex size-10 items-center justify-center rounded-full ${tone === "card" ? "bg-primary/10 text-primary" : "bg-white/12"}`}>{icon}</span>
      <span><span className="block text-3xl font-semibold leading-none">{value}</span><span className={`mt-2 block text-sm ${tone === "card" ? "text-muted-foreground" : "opacity-70"}`}>{label}</span></span>
    </Link>
  );
}

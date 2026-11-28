import { ArrowRight, CalendarDays, Compass, Plane, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinerRequestCard } from "@/components/joiner/joiner-request-card";
import { JoinerTripCard } from "@/components/joiner/joiner-trip-card";
import { FeedTripCard } from "@/components/trips/feed-trip-card";
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

  // Calculate profile completion (4 fields: firstName, lastName, username, image)
  const completionFields = [user.firstName, user.lastName, user.username, user.image];
  const completedFields = completionFields.filter((field) => field && field.trim() !== "").length;
  const completionPercent = Math.round((completedFields / 4) * 100);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-white p-6 ring-1 ring-border sm:p-8 lg:p-10">
        <p className="text-sm font-medium">Your traveler dashboard</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Ready for your next adventure, {user.firstName}?</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed sm:text-base">Keep track of your trips, follow your requests, and discover a crew to travel with.</p>
        <Link href="/#trips" className="group mt-6 inline-flex h-12 items-center gap-3 rounded-full bg-primary py-1 pl-5 pr-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          Explore trips <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><ArrowRight className="size-4" /></span>
        </Link>
      </section>

      <section aria-label="Joiner activity summary" className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={<Plane className="size-5" />} value={overview.trips} label="Trips you're joining" href="/joiner/trips" tone="primary" />\r\n        <SummaryCard icon={<CalendarDays className="size-5" />} value={upcoming.length} label="Upcoming adventures" href="/joiner/trips" tone="primary" />
        <SummaryCard icon={<Compass className="size-5" />} value={overview.requests.pending} label="Requests awaiting a reply" href="/joiner/requests" tone="card" />
      </section>

      {/* Profile Completion Banner */}
      {completionPercent < 100 && (
        <section className="rounded-[1.75rem] bg-gradient-to-r from-primary/5 to-primary/10 p-6 ring-1 ring-primary/15 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary"><UserRound className="size-5" /></span>
                <div>
                  <h3 className="font-semibold text-foreground">Complete your traveler profile</h3>
                  <p className="text-sm text-muted-foreground">Increase your chances of being accepted by organizers.</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Profile completeness</span>
                  <span className="font-semibold text-primary">{completionPercent}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Profile completion"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={completionPercent}
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${completionPercent}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{completedFields} of 4 fields complete</p>
              </div>
            </div>
            <Link href="/joiner/profile" className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 whitespace-nowrap">
              Complete profile <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-sm font-medium text-primary">On your calendar</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Your next trips</h2></div>
          <Link href="/joiner/trips" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">All my trips <ArrowRight className="size-4" /></Link>
        </div>
        {upcoming.length ? (
          <div className="grid gap-4 xl:grid-cols-2">{upcoming.slice(0, 2).map((trip) => <JoinerTripCard key={trip.id} trip={trip} />)}</div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-[1.5rem] border border-border bg-muted/40 p-7 text-center sm:p-9">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Compass className="size-6" /></span>
              <h3 className="mt-4 font-semibold text-foreground">Your next adventure is waiting</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Browse community trips and send a request to join a group that fits your plans.</p>
              <Link href="/#trips" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Discover trips <ArrowRight className="size-4" /></Link>
            </div>

            {/* Suggested Trips Preview */}
            {activity.suggestedTrips && activity.suggestedTrips.length > 0 && (
              <div>
                <p className="mb-4 text-sm font-medium text-primary">Handpicked for you</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {activity.suggestedTrips.slice(0, 3).map((trip) => (
                    <FeedTripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-sm font-medium text-primary">Stay in the loop</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Recent requests</h2></div>
          <Link href="/joiner/requests" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">All requests <ArrowRight className="size-4" /></Link>
        </div>
        {recentRequests.length ? <div className="grid gap-3">{recentRequests.map((request) => <JoinerRequestCard key={request.tripId} request={request} />)}</div> : (
          <div className="rounded-[1.5rem] border border-border bg-muted/40 p-6 text-center">
            <p className="font-medium text-foreground">No requests yet</p><p className="mt-1 text-sm text-muted-foreground">When you ask to join a trip, its progress will show here.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ icon, value, label, href, tone }: { icon: React.ReactNode; value: number; label: string; href: string; tone: "primary" | "card" }) {
  const styles = {
    primary: "bg-primary text-primary-foreground",
    card: "bg-card text-card-foreground ring-1 ring-border",
  };
  return (
    <Link href={href} className={`flex min-h-36 flex-col justify-between rounded-[1.5rem] p-5 transition-transform hover:-translate-y-0.5 ${styles[tone]}`}>
      <span className={`flex size-10 items-center justify-center rounded-full ${tone === "card" ? "bg-muted text-foreground" : "bg-white/12"}`}>{icon}</span>
      <span><span className="block text-3xl font-semibold leading-none">{value}</span><span className={`mt-2 block text-sm ${tone === "card" ? "text-muted-foreground" : "opacity-80"}`}>{label}</span></span>
    </Link>
  );
}


import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinerTripCard } from "@/components/joiner/joiner-trip-card";
import { apiGet } from "@/lib/api";
import type { JoinerTripsResponse } from "server-app/shared";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My Trips" };

export default async function JoinerTripsPage() {
  await requireUser();
  const { trips } = await apiGet<JoinerTripsResponse>("/api/joiner/trips");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm font-medium text-primary">Your travel plans</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">My Trips</h1><p className="mt-2 text-sm text-muted-foreground">Trips where the organizer has approved your request.</p></div>
        <Link href="/#trips" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Find a trip</Link>
      </header>
      {trips.length ? <div className="grid gap-4 xl:grid-cols-2">{trips.map((trip) => <JoinerTripCard key={trip.id} trip={trip} />)}</div> : (
        <div className="rounded-[1.75rem] border border-dashed bg-muted/40 px-6 py-12 text-center sm:px-10">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Compass className="size-7" /></span>
          <h2 className="mt-4 text-xl font-semibold">No joined trips yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Once an organizer approves your request, the trip will appear here. You can explore trips while you wait.</p>
          <Link href="/#trips" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Explore community trips</Link>
        </div>
      )}
    </div>
  );
}

import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinerTripCard } from "@/components/joiner/joiner-trip-card";
import { apiGet } from "@/lib/api";
import type { JoinerTrip, JoinerTripsResponse } from "server-app/shared";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My Trips" };

// Example trips for demonstration purposes
const EXAMPLE_TRIPS: JoinerTrip[] = [
  {
    id: "example-1",
    destinationCity: "Brasov",
    destinationCountry: "Romania",
    departureDate: "2026-12-15",
    returnDate: "2026-12-18",
    organizerName: "Ana R.",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&h=400&fit=crop",
  },
  {
    id: "example-2",
    destinationCity: "Paris",
    destinationCountry: "France",
    departureDate: "2027-01-20",
    returnDate: "2027-01-24",
    organizerName: "Mihai P.",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=400&fit=crop",
  },
  {
    id: "example-3",
    destinationCity: "Barcelona",
    destinationCountry: "Spain",
    departureDate: "2027-02-10",
    returnDate: "2027-02-15",
    organizerName: "Laura M.",
    status: "active",
    photoUrl: "https://images.unsplash.com/photo-1562883676-8c5bffe20c4d?w=800&h=400&fit=crop",
  },
];

export default async function JoinerTripsPage() {
  await requireUser();
  const { trips } = await apiGet<JoinerTripsResponse>("/api/joiner/trips");
  
  // Show example trips if no real trips exist
  const displayTrips = trips.length > 0 ? trips : EXAMPLE_TRIPS;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm font-medium text-primary">Your travel plans</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">My Trips</h1><p className="mt-2 text-sm text-muted-foreground">Trips where the organizer has approved your request.</p></div>
        <Link href="/#trips" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Find a trip</Link>
      </header>
      {trips.length ? (
        <div className="grid gap-4 xl:grid-cols-2">{trips.map((trip) => <JoinerTripCard key={trip.id} trip={trip} />)}</div>
      ) : (
        <>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
            <p className="font-medium">Example Trips</p>
            <p className="mt-1">These are sample trips to demonstrate how your joined trips will appear.</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">{displayTrips.map((trip) => <JoinerTripCard key={trip.id} trip={trip} />)}</div>
          <div className="rounded-[1.75rem] border border-dashed bg-muted/40 px-6 py-12 text-center sm:px-10">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Compass className="size-7" /></span>
            <h2 className="mt-4 text-xl font-semibold">Ready to join a trip?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Explore available trips and request to join. Once an organizer approves your request, the trip will appear in your joined trips.</p>
            <Link href="/#trips" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Explore community trips</Link>
          </div>
        </>
      )}
    </div>
  );
}

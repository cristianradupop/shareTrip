import type { Metadata } from "next";
import { CreateTripButton } from "@/components/trips/create-trip-dialog";
import { OrganizerTripCard } from "@/components/trips/organizer-trip-card";
import type { OrganizerTrip } from "server-app/shared";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My Trips" };

export default async function MyTripsPage() {
  await requireUser();
  const { trips } = await apiGet<{ trips: OrganizerTrip[] }>("/api/organizer/trips");

  return (
    <div className="space-y-6 pt-2">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">My Trips</h1>
        <CreateTripButton />
      </header>
      {trips.length === 0 ? (
        <p className="text-muted-foreground">No trips yet. Create your first one!</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {trips.map((t) => (
            <OrganizerTripCard key={t.id} trip={t} />
          ))}
        </div>
      )}
    </div>
  );
}

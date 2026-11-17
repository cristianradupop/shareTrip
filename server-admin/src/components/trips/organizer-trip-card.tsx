import { Users } from "lucide-react";
import { TripCover } from "@/components/trips/trip-cover";
import { TripStatusBadge } from "@/components/trips/trip-status-badge";
import { formatDateRange } from "@/lib/format";
import type { OrganizerTrip } from "@/data/trips";

export function OrganizerTripCard({ trip }: { trip: OrganizerTrip }) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="h-36 overflow-hidden">
        <TripCover seed={trip.destinationCity} />
      </div>
      <div className="space-y-1 p-4">
        <h3 className="font-semibold">
          {trip.destinationCity}, {trip.destinationCountry}
        </h3>
        <p className="text-sm text-muted-foreground">{formatDateRange(trip.departureDate, trip.returnDate)}</p>
        <div className="flex items-center justify-between pt-2">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" /> {trip.joined} joined
            <span className="text-xs">/ {trip.maxTravelers}</span>
          </span>
          <TripStatusBadge status={trip.status} />
        </div>
      </div>
    </article>
  );
}

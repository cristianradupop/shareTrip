import { Users } from "lucide-react";
import { EditTripButton } from "@/components/trips/edit-trip-button";
import { TripCover } from "@/components/trips/trip-cover";
import { TripRequestsDialog } from "@/components/trips/trip-requests-dialog";
import { TripStatusBadge } from "@/components/trips/trip-status-badge";
import { formatDateRange } from "@/lib/format";
import { canEditTrip, type OrganizerTrip } from "server-app/shared";

export function OrganizerTripCard({ trip }: { trip: OrganizerTrip }) {
  return (
    <article className="group overflow-hidden rounded-[1.75rem] bg-card p-2 ring-1 ring-border transition-shadow hover:shadow-xl hover:shadow-black/5">
      <div className="relative h-44 overflow-hidden rounded-[1.35rem]">
        <TripCover seed={trip.destinationCity} className="transition-transform duration-700 group-hover:scale-105" />
      </div>
      <div className="space-y-1 px-3 pb-3 pt-4">
        <h3 className="text-lg font-semibold tracking-tight">
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
        <div className="flex flex-wrap gap-2 pt-2">
          {canEditTrip(trip) && <EditTripButton trip={trip} />}
          <TripRequestsDialog trip={trip} />
        </div>
      </div>
    </article>
  );
}

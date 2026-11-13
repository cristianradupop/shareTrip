import { CalendarDays, ChevronDown, MapPin, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { UserAvatar } from "@/components/user-menu";
import type { FeedTrip } from "@/data/trips";
import { formatDateRange, formatMoney, GENDER_LABEL, TRANSPORT_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One trip in the community feed.
 * `action` is a slot for the Joiner part: pass the "Join" button here.
 */
export function FeedTripCard({ trip, isNew, action }: { trip: FeedTrip; isNew?: boolean; action?: ReactNode }) {
  const spotsLeft = Math.max(trip.maxTravelers - trip.joined, 0);
  return (
    <article className={cn("rounded-2xl border bg-card p-4 shadow-sm", isNew && "ring-2 ring-primary/50")}>
      <div className="flex items-start gap-3">
        <UserAvatar name={trip.organizerName} image={trip.organizerImage} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {trip.organizerName}
            {isNew && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">New</span>}
          </p>
          <h3 className="flex items-center gap-1.5 font-semibold">
            <MapPin className="size-4 text-primary" /> {trip.city}, {trip.country}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {formatDateRange(trip.departureDate, trip.returnDate)}
            </span>
            <span className="flex items-center gap-1.5">
              <Wallet className="size-4" /> Estimated budget: {formatMoney(trip.budget, trip.currency)}
            </span>
          </p>
        </div>
        {action}
      </div>

      <details className="group mt-3 border-t pt-2 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-center gap-1 text-muted-foreground hover:text-foreground">
          Details <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Detail label="Travelers" value={`${trip.joined + 1} of ${trip.maxTravelers} (${spotsLeft} spots left)`} />
          <Detail label="Gender" value={GENDER_LABEL[trip.gender] ?? trip.gender} />
          <Detail label="Transport" value={TRANSPORT_LABEL[trip.transport] ?? trip.transport} />
        </dl>
        <p className="mt-3 text-muted-foreground">{trip.theme}</p>
      </details>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

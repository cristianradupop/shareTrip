import { Bus, CalendarDays, Car, Compass, Plane, Ship, TrainFront, Users, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TripCover } from "@/components/trips/trip-cover";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-menu";
import type { FeedTrip } from "server-app/shared";
import { feedCardView, type TransportKey } from "@/lib/feed-card";
import { formatDay, formatMoney, GENDER_LABEL, TRANSPORT_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Record<TransportKey, LucideIcon> = {
  plane: Plane,
  car: Car,
  bus: Bus,
  train: TrainFront,
  ship: Ship,
  other: Compass,
};

/**
 * One trip in the community feed.
 * `action` is a slot for the Joiner part: pass the "Join" button here.
 */
export function FeedTripCard({ trip, isNew, action }: { trip: FeedTrip; isNew?: boolean; action?: ReactNode }) {
  const view = feedCardView(trip);
  const TransportIcon = ICONS[view.icon];
  return (
    <article
      className={cn(
        "group overflow-hidden rounded-[1.75rem] bg-card p-2 text-card-foreground ring-1 ring-border transition-shadow hover:shadow-xl hover:shadow-black/5 sm:grid sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]",
        isNew && "ring-2 ring-primary",
      )}
    >
      <div className={cn("relative isolate flex min-h-48 flex-col justify-between overflow-hidden rounded-[1.35rem] bg-gradient-to-br p-4 text-white", view.gradient)}>
        <TripCover seed={trip.city} photoUrl={trip.photoUrl} sizes="(max-width: 640px) 100vw, 240px" className="-z-20 transition-transform duration-700 group-hover:scale-105" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />
        <div className="flex flex-wrap items-center gap-2">
          {isNew && <Badge className="bg-primary text-primary-foreground">New</Badge>}
          {view.isFull && <Badge className="bg-black/60 text-white">Full</Badge>}
          <span className="ml-auto flex size-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-md">
            <TransportIcon aria-hidden className="size-4.5" />
          </span>
        </div>
        <div>
          <h3 className="min-w-0 break-words text-2xl font-semibold leading-tight tracking-tight">{trip.city}</h3>
          <p className="min-w-0 break-words text-sm text-white/85">{trip.country}</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="space-y-3 p-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <CalendarDays className="size-4 text-primary" /> {formatDay(trip.departureDate)}
            </span>
            {trip.returnDate && (
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                <CalendarDays className="size-4 text-muted-foreground" /> {formatDay(trip.returnDate)}
              </span>
            )}
            <span className="ml-auto flex items-center gap-1.5">
              <Wallet className="size-4 text-primary" />
              <span className="font-semibold">{formatMoney(trip.budget, trip.currency)}</span>
              <span className="sr-only">estimated budget</span>
            </span>
          </div>

          <p className="line-clamp-2 break-words text-[0.95rem] leading-relaxed">{trip.theme}</p>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="size-4" /> {view.seatsLabel}
              </span>
              <span className={cn("font-medium", view.isFull ? "text-destructive" : "text-primary")}>
                {view.spotsLabel}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Seats taken"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={view.fillPercent}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn("h-full rounded-full", view.isFull ? "bg-destructive" : "bg-primary")}
                style={{ width: `${view.fillPercent}%` }}
              />
            </div>
          </div>

          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{GENDER_LABEL[trip.gender] ?? trip.gender}</span>
            <span className="flex items-center gap-1.5">
              <TransportIcon className="size-4" /> {TRANSPORT_LABEL[trip.transport] ?? trip.transport}
            </span>
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar name={trip.organizerName} image={trip.organizerImage} className="size-8" />
            <span className="truncate text-sm font-medium">{trip.organizerName}</span>
          </div>
          {action}
        </div>
      </div>
    </article>
  );
}

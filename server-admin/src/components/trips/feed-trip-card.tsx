import { Bus, CalendarDays, Car, Compass, Plane, Ship, TrainFront, Users, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
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
        "overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 text-slate-100 shadow-xl shadow-black/30 backdrop-blur-md",
        isNew && "ring-2 ring-orange-400",
      )}
    >
      <div className={cn("relative bg-gradient-to-br px-5 py-4 text-white", view.gradient)}>
        <TransportIcon aria-hidden className="absolute right-4 top-3 size-12 opacity-30" />
        <div className="flex flex-wrap items-center gap-2">
          {isNew && <Badge className="bg-orange-500 text-white">New</Badge>}
          {view.isFull && <Badge className="bg-slate-900/70 text-white">Full</Badge>}
        </div>
        <h3 className="mt-1 min-w-0 break-words pr-12 text-2xl font-bold leading-tight">{trip.city}</h3>
        <p className="min-w-0 break-words text-sm text-white/90">{trip.country}</p>
      </div>

      <div className="space-y-3 p-5">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-orange-800 dark:bg-orange-950 dark:text-orange-200">
            <CalendarDays className="size-4" /> {formatDay(trip.departureDate)}
          </span>
          {trip.returnDate && (
            <span className="flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
              <CalendarDays className="size-4" /> {formatDay(trip.returnDate)}
            </span>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-sm">
          <Wallet className="size-4 text-orange-500" />
          <span className="font-semibold">{formatMoney(trip.budget, trip.currency)}</span>
          <span className="text-muted-foreground">estimated budget</span>
        </p>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-4" /> {view.seatsLabel}
            </span>
            <span className={cn("font-medium", view.isFull ? "text-red-400" : "text-teal-300")}>
              {view.spotsLabel}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Seats taken"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={view.fillPercent}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn("h-full rounded-full", view.isFull ? "bg-red-500" : "bg-teal-500")}
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

        <p className="line-clamp-2 break-words text-sm">{trip.theme}</p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <UserAvatar name={trip.organizerName} image={trip.organizerImage} className="size-8" />
          <span className="truncate text-sm font-medium">{trip.organizerName}</span>
        </div>
        {action}
      </div>
    </article>
  );
}

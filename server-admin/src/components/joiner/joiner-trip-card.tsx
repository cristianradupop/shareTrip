import { CalendarDays, MapPin, Users } from "lucide-react";
import type { JoinerTrip } from "server-app/shared";
import { formatDateRange } from "@/lib/format";

const statusStyles: Record<JoinerTrip["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  full: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
};

export function JoinerTripCard({ trip }: { trip: JoinerTrip }) {
  const departed = trip.departureDate < new Date().toISOString().slice(0, 10);
  const label = trip.status === "cancelled" ? "Cancelled" : departed ? "Completed" : trip.status === "full" ? "Full" : "Upcoming";
  return (
    <article className="overflow-hidden rounded-[1.5rem] bg-card ring-1 ring-border transition-shadow hover:shadow-lg hover:shadow-black/5">
      <div className="relative isolate flex min-h-40 flex-col justify-between overflow-hidden bg-cover bg-center bg-no-repeat p-5 text-white" style={trip.photoUrl ? { backgroundImage: `url('${trip.photoUrl}')` } : { background: "linear-gradient(135deg, var(--color-ink) 0%, var(--color-ink) 100%)" }}>
        <div aria-hidden className="absolute inset-0 -z-10 bg-black/40" />
        {!trip.photoUrl && <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,oklch(0.64_0.205_19/0.55),transparent_60%)]" />}
        <div className="relative z-10 flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-white/10"><MapPin className="size-5 text-primary" /></span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[trip.status]}`}>{label}</span>
        </div>
        <div className="relative z-10">
          <h3 className="text-2xl font-semibold leading-tight">{trip.destinationCity}</h3>
          <p className="text-sm text-white/65">{trip.destinationCountry}</p>
        </div>
      </div>
      <dl className="grid gap-3 p-5 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
          <div><dt className="text-xs text-muted-foreground">Travel dates</dt><dd className="mt-0.5 font-medium">{formatDateRange(trip.departureDate, trip.returnDate)}</dd></div>
        </div>
        <div className="flex items-start gap-2">
          <Users className="mt-0.5 size-4 shrink-0 text-primary" />
          <div><dt className="text-xs text-muted-foreground">Trip organizer</dt><dd className="mt-0.5 font-medium">{trip.organizerName}</dd></div>
        </div>
      </dl>
    </article>
  );
}

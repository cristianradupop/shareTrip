import { CalendarDays, MapPin } from "lucide-react";
import type { JoinerRequest } from "server-app/shared";
import { formatDateRange } from "@/lib/format";

const statusStyles: Record<JoinerRequest["status"], string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  declined: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<JoinerRequest["status"], string> = {
  pending: "Awaiting organizer",
  approved: "Approved",
  declined: "Not approved",
};

export function JoinerRequestCard({ request }: { request: JoinerRequest }) {
  return (
    <article className="flex flex-col gap-4 rounded-[1.5rem] bg-card p-5 ring-1 ring-border sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MapPin className="size-5" /></span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{request.destinationCity}, {request.destinationCountry}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" /> {formatDateRange(request.departureDate, request.returnDate)}
          </p>
        </div>
      </div>
      <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[request.status]}`}>
        {statusLabels[request.status]}
      </span>
    </article>
  );
}

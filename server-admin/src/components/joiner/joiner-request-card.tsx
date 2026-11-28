import { CalendarDays, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { JoinerRequest } from "server-app/shared";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDateRange } from "@/lib/format";
import { cn } from "@/lib/utils";

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
    <article className="group overflow-hidden rounded-[1.5rem] bg-card ring-1 ring-border transition-all hover:shadow-md hover:shadow-black/5">
      <div className="relative isolate flex flex-col">
        {/* Trip Photo Background */}
        {request.photoUrl && (
          <>
            <div className="relative h-32 w-full overflow-hidden bg-muted">
              <Image
                src={request.photoUrl}
                alt={`${request.destinationCity} trip photo`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 400px"
              />
              {/* Dark gradient overlay for text legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            </div>
          </>
        )}

        {/* Card Content */}
        <div className={cn("flex flex-col gap-4 p-5", !request.photoUrl && "gap-3")}>
          {/* Location and Status Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight">
                {request.destinationCity}, {request.destinationCountry}
              </h2>
            </div>
            <span className={`w-fit shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[request.status]}`}>
              {statusLabels[request.status]}
            </span>
          </div>

          {/* Travel Dates */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" />
            <span>{formatDateRange(request.departureDate, request.returnDate)}</span>
          </div>

          {/* Organizer Info */}
          {request.organizerName && (
            <div className="flex items-center gap-3 border-t pt-3">
              <Avatar className="size-10">
                {request.organizerImage && (
                  <AvatarImage src={request.organizerImage} alt={request.organizerName} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {request.organizerName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{request.organizerName}</p>
                <p className="text-xs text-muted-foreground">Trip organizer</p>
              </div>
            </div>
          )}

          {/* Action Buttons - Visible on hover */}
          <div className="flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Link
              href={`/joiner/trips/${request.tripId}`}
              className="flex-1 inline-flex items-center justify-center rounded-full border border-border bg-background text-sm font-medium hover:bg-muted hover:text-foreground transition-colors px-4 py-2"
            >
              View Trip
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Withdraw request"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}


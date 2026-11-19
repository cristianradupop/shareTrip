"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FeedTrip, JoinState } from "server-app/shared";
import { clientFetch } from "@/lib/client-api";
import { formatDateRange, formatMoney, GENDER_LABEL, TRANSPORT_LABEL } from "@/lib/format";
import { joinActionView } from "@/lib/join-action";
import { cn } from "@/lib/utils";

type Reply = { viewerState: JoinState; joined: number };

const ACCENT = "bg-orange-500 text-white hover:bg-orange-400";
const QUIET = "border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white";

/** The join button of a feed card: request, withdraw and leave. `onPatched` receives the trip fields the server changed. */
export function JoinAction({ trip, onPatched }: { trip: FeedTrip; onPatched: (patch: Pick<FeedTrip, "viewerState" | "joined">) => void }) {
  const view = joinActionView(trip);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function call(path: string, method: "POST" | "DELETE", success: string) {
    setBusy(true);
    const res = await clientFetch<Reply>(path, { method });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setConfirming(false);
    toast.success(success);
    onPatched({ viewerState: res.viewerState, joined: res.joined });
  }

  const requestPath = `/api/trips/${trip.id}/request`;

  if (view.href) {
    return (
      <Link href={view.href} className={cn(buttonVariants({ size: "lg" }), ACCENT)}>
        {view.label}
      </Link>
    );
  }

  const opensDialog = trip.viewerState === "join";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {view.secondary === "withdraw" && (
          <Button variant="outline" size="lg" disabled={busy} className={QUIET} onClick={() => void call(requestPath, "DELETE", "Request withdrawn")}>
            Withdraw
          </Button>
        )}
        {view.secondary === "leave" && (
          <Button variant="outline" size="lg" disabled={busy} className={QUIET} onClick={() => void call(`/api/trips/${trip.id}/membership`, "DELETE", "You left the trip")}>
            Leave
          </Button>
        )}
        <Button
          size="lg"
          disabled={view.disabled || (!opensDialog && Boolean(view.secondary))}
          className={opensDialog ? ACCENT : view.secondary ? "bg-teal-600 text-white disabled:opacity-90" : undefined}
          onClick={opensDialog ? () => setConfirming(true) : undefined}
        >
          {view.label}
        </Button>
      </div>
      {view.reason && <p className="text-xs text-muted-foreground">{view.reason}</p>}

      <Dialog open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Join {trip.city}, {trip.country}?
            </DialogTitle>
            <DialogDescription>The organizer, {trip.organizerName}, will see your request and decide.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Dates</dt>
            <dd className="text-right font-medium">{formatDateRange(trip.departureDate, trip.returnDate)}</dd>
            <dt className="text-muted-foreground">Budget</dt>
            <dd className="text-right font-medium">{formatMoney(trip.budget, trip.currency)}</dd>
            <dt className="text-muted-foreground">Transport</dt>
            <dd className="text-right font-medium">{TRANSPORT_LABEL[trip.transport] ?? trip.transport}</dd>
            <dt className="text-muted-foreground">Group</dt>
            <dd className="text-right font-medium">{GENDER_LABEL[trip.gender] ?? trip.gender}</dd>
          </dl>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button disabled={busy} className="bg-orange-500 text-white hover:bg-orange-400" onClick={() => void call(requestPath, "POST", "Request sent")}>
              {busy ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

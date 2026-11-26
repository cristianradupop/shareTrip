"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-menu";
import { clientFetch } from "@/lib/client-api";
import type { OrganizerTrip } from "server-app/shared";

type Person = { userId: string; name: string; image: string | null; age: number; gender: string | null };
type People = { pending: Person[]; members: Person[] };

/** "Requests (n)" button of an organizer trip card: lists pending requests and members, and decides on requests. */
export function TripRequestsDialog({ trip }: { trip: OrganizerTrip }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<People | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await clientFetch<People>(`/api/organizer/trips/${trip.id}/requests`);
    if (res.ok) {
      setPeople({ pending: res.pending, members: res.members });
      setLoadError(null);
    } else {
      setLoadError(res.error);
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setPeople(null);
      void load();
    }
  }

  async function decide(userId: string, action: "approve" | "decline") {
    setBusyId(userId);
    const res = await clientFetch<{ autoDeclined?: number }>(`/api/organizer/trips/${trip.id}/requests/${userId}`, {
      method: "PATCH",
      json: { action },
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const auto = action === "approve" ? (res.autoDeclined ?? 0) : 0;
    toast.success(
      action === "approve"
        ? `Request approved${auto > 0 ? `. The trip is full, so ${auto} other ${auto === 1 ? "request was" : "requests were"} declined` : ""}`
        : "Request declined",
    );
    await load();
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => onOpenChange(true)}>
        Requests
        {trip.pending > 0 && <Badge className="ml-1 bg-primary text-primary-foreground">{trip.pending}</Badge>}
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {trip.destinationCity}, {trip.destinationCountry}
            </DialogTitle>
            <DialogDescription>Decide who joins this trip.</DialogDescription>
          </DialogHeader>

          {loadError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {loadError}
            </p>
          )}
          {!people && !loadError && <p className="text-sm text-muted-foreground">Loading…</p>}

          {people && (
            <div className="space-y-5">
              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Pending requests ({people.pending.length})</h4>
                {people.pending.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
                {people.pending.map((p) => (
                  <div key={p.userId} className="flex items-center gap-3">
                    <PersonInfo person={p} />
                    <Button size="sm" disabled={busyId === p.userId} onClick={() => void decide(p.userId, "approve")}>
                      Approve
                    </Button>
                    <Button variant="outline" size="sm" disabled={busyId === p.userId} onClick={() => void decide(p.userId, "decline")}>
                      Decline
                    </Button>
                  </div>
                ))}
              </section>
              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Approved members ({people.members.length})</h4>
                {people.members.length === 0 && <p className="text-sm text-muted-foreground">Nobody has joined yet.</p>}
                {people.members.map((p) => (
                  <div key={p.userId} className="flex items-center gap-3">
                    <PersonInfo person={p} />
                  </div>
                ))}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PersonInfo({ person }: { person: Person }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <UserAvatar name={person.name} image={person.image} className="size-9" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{person.name}</p>
        <p className="text-xs text-muted-foreground">
          {person.age} years{person.gender ? `, ${person.gender === "female" ? "Female" : "Male"}` : ""}
        </p>
      </div>
    </div>
  );
}

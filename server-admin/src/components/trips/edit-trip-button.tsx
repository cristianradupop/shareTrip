"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { TripFormDialog } from "@/components/trips/trip-form-dialog";
import { Button } from "@/components/ui/button";
import type { OrganizerTrip, TripInput } from "server-app/shared";
import { trackInteraction } from "@/lib/analytics";
import { clientFetch } from "@/lib/client-api";
import { toTripFormValues } from "@/lib/trip-form";

/** "Edit" button + the pre-filled "Edit trip" pop-up. */
export function EditTripButton({ trip }: { trip: OrganizerTrip }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onSubmit(values: TripInput) {
    const result = await clientFetch(`/api/trips/${trip.id}`, { method: "PATCH", json: values });
    if (!result.ok) return result.error;
    trackInteraction("trip_edited");
    toast.success("Trip updated");
    router.refresh();
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label={`Edit trip to ${trip.destinationCity}`}
        onClick={() => setOpen(true)}
      >
        <Pencil /> Edit
      </Button>

      <TripFormDialog
        open={open}
        title="Edit trip"
        description="Update the trip details below. All fields are required."
        submitLabel="Save"
        pendingLabel="Saving…"
        initialValues={toTripFormValues(trip)}
        requireChanges
        discard={{
          title: "Discard changes?",
          description: "Your changes to this trip will be lost.",
          keepLabel: "Keep editing",
          discardLabel: "Discard",
        }}
        onSubmit={onSubmit}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { TripFormDialog } from "@/components/trips/trip-form-dialog";
import { Button } from "@/components/ui/button";
import type { TripFormInput, TripInput } from "server-app/shared";
import { trackInteraction } from "@/lib/analytics";
import { clientFetch } from "@/lib/client-api";
import { toTripFormData } from "@/lib/trip-form";

const EMPTY = {
  destinationCity: "",
  destinationCountry: "",
  departureDate: "",
  returnDate: "",
  maxTravelers: "",
  gender: "",
  budgetEstimate: "",
  currency: "EUR",
  transport: "",
  theme: "",
} as unknown as TripFormInput;

/** "Organize trip" button + the "Trip details" pop-up. */
export function CreateTripButton({
  defaultOpen = false,
  label = "Create New Trip",
  className,
}: {
  defaultOpen?: boolean;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);

  function close() {
    setOpen(false);
    router.replace("/organizer"); // back to the home page of the organizer, dropping ?new=1
  }

  async function onSubmit(values: TripInput, photo: File | null) {
    const result = await clientFetch<{ id: string }>("/api/trips", { form: toTripFormData(values, photo) });
    if (!result.ok) return result.error;
    trackInteraction("trip_created");
    toast.success("Your trip was created and shared with the community");
    router.refresh();
    return null;
  }

  return (
    <>
      <Button size="lg" data-track="create-trip" className={className ?? "h-11 rounded-full px-6 text-base"} onClick={() => setOpen(true)}>
        {label} <Plus />
      </Button>

      <TripFormDialog
        open={open}
        title="Trip details"
        description="Please insert the trip details below. All fields are required."
        submitLabel="Create"
        pendingLabel="Creating…"
        initialValues={EMPTY}
        photoRequired
        discard={{
          title: "Trip details",
          description: "Are you sure you want to cancel this trip? Your data for this trip will be lost",
          keepLabel: "Go back",
          discardLabel: "Cancel trip",
        }}
        onSubmit={onSubmit}
        onClose={close}
      />
    </>
  );
}

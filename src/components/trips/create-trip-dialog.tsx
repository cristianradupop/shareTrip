"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { createTripAction } from "@/app/actions/trips";
import { FormField } from "@/components/form-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CURRENCIES,
  GENDER_OPTIONS,
  TRANSPORT_OPTIONS,
  tripSchema,
  type TripFormInput,
  type TripInput,
} from "@/lib/validators";

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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false); // highlight all invalid fields after a click on the disabled button

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty, touchedFields, isSubmitting },
  } = useForm<TripFormInput, unknown, TripInput>({
    resolver: zodResolver(tripSchema),
    mode: "onChange",
    defaultValues: EMPTY,
  });

  const invalid = (name: keyof TripFormInput) =>
    Boolean(errors[name]) && (showAll || Boolean(touchedFields[name]));
  const err = (name: keyof TripFormInput) => errors[name]?.message as string | undefined;

  function closeAndReset() {
    setOpen(false);
    setConfirmCancel(false);
    setServerError(null);
    setShowAll(false);
    reset(EMPTY);
    router.replace("/organizer"); // back to the home page of the organizer, dropping ?new=1
  }

  // "Close": warn first if there is anything typed in (spec: data for this trip will be lost).
  function requestClose() {
    if (isDirty) setConfirmCancel(true);
    else closeAndReset();
  }

  async function onSubmit(values: TripInput) {
    setServerError(null);
    const result = await createTripAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    toast.success("Your trip was created and shared with the community");
    setOpen(false);
    reset(EMPTY);
    setShowAll(false);
    router.replace("/organizer");
    router.refresh();
  }

  const selectField = (
    name: "gender" | "transport",
    options: readonly { value: string; label: string }[],
    placeholder: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select items={options} value={field.value || null} onValueChange={(v) => field.onChange(v ?? "")}>
          <SelectTrigger id={name} className="w-full" aria-invalid={invalid(name)} onBlur={field.onBlur}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );

  return (
    <>
      <Button size="lg" className={className ?? "h-11 rounded-full px-6 text-base"} onClick={() => setOpen(true)}>
        {label} <Plus />
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : requestClose())}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-xl text-primary">Trip details</DialogTitle>
            <DialogDescription>Please insert the trip details below. All fields are required.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Town" htmlFor="destinationCity" error={err("destinationCity")} invalid={invalid("destinationCity")}>
                <Input id="destinationCity" aria-invalid={invalid("destinationCity")} {...register("destinationCity")} />
              </FormField>
              <FormField label="Country" htmlFor="destinationCountry" error={err("destinationCountry")} invalid={invalid("destinationCountry")}>
                <Input id="destinationCountry" aria-invalid={invalid("destinationCountry")} {...register("destinationCountry")} />
              </FormField>
              <FormField label="Departure date" htmlFor="departureDate" error={err("departureDate")} invalid={invalid("departureDate")}>
                <Input id="departureDate" type="date" aria-invalid={invalid("departureDate")} {...register("departureDate")} />
              </FormField>
              <FormField label="Return date (optional)" htmlFor="returnDate" error={err("returnDate")} invalid={invalid("returnDate")} hint="Leave empty for a one-day trip">
                <Input id="returnDate" type="date" aria-invalid={invalid("returnDate")} {...register("returnDate")} />
              </FormField>
              <FormField label="Number of travelers" htmlFor="maxTravelers" error={err("maxTravelers")} invalid={invalid("maxTravelers")}>
                <Input id="maxTravelers" type="number" inputMode="numeric" min={2} max={50} aria-invalid={invalid("maxTravelers")} {...register("maxTravelers")} />
              </FormField>
              <FormField label="Gender" htmlFor="gender" error={err("gender")} invalid={invalid("gender")}>
                {selectField("gender", GENDER_OPTIONS, "Choose…")}
              </FormField>
              <FormField label="Estimated budget" htmlFor="budgetEstimate" error={err("budgetEstimate")} invalid={invalid("budgetEstimate")}>
                <div className="flex gap-2">
                  <Input id="budgetEstimate" type="number" inputMode="decimal" min={1} step="any" aria-invalid={invalid("budgetEstimate")} {...register("budgetEstimate")} />
                  <Controller
                    control={control}
                    name="currency"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "EUR")}>
                        <SelectTrigger className="w-24" aria-label="Currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </FormField>
              <FormField label="Transport" htmlFor="transport" error={err("transport")} invalid={invalid("transport")}>
                {selectField("transport", TRANSPORT_OPTIONS, "Choose…")}
              </FormField>
            </div>

            <FormField label="Theme / description" htmlFor="theme" error={err("theme")} invalid={invalid("theme")}>
              <Textarea id="theme" rows={4} placeholder="Cultural trip, mountain hike, city break…" aria-invalid={invalid("theme")} {...register("theme")} />
            </FormField>

            {serverError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {serverError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="destructive" onClick={requestClose}>
                Close
              </Button>
              {/* A disabled button swallows clicks, so the wrapper reveals which fields are still missing. */}
              <span onClick={() => !isValid && setShowAll(true)}>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={!isValid || isSubmitting}
                  style={isValid ? undefined : { pointerEvents: "none" }}
                >
                  {isSubmitting ? "Creating…" : "Create"}
                </Button>
              </span>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <TriangleAlert className="size-6" />
            </div>
            <AlertDialogTitle>Trip details</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this trip? Your data for this trip will be lost
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={closeAndReset}>
              Cancel trip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

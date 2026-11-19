"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
} from "server-app/shared";

export type TripFormDialogProps = {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  initialValues: TripFormInput;
  /** Keep the submit button disabled until something changed (edit). */
  requireChanges?: boolean;
  discard: { title: string; description: string; keepLabel: string; discardLabel: string };
  /** Returns an error message to show in the dialog, or null on success (the dialog then closes). */
  onSubmit: (values: TripInput) => Promise<string | null>;
  onClose: () => void;
};

/** The "Trip details" pop-up shared by create and edit. The form is mounted only while open, so it starts fresh every time. */
export function TripFormDialog(props: TripFormDialogProps) {
  const { open, onClose } = props;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg" showCloseButton={false}>
        {open && <TripForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function TripForm({
  title,
  description,
  submitLabel,
  pendingLabel,
  initialValues,
  requireChanges = false,
  discard,
  onSubmit,
  onClose,
}: TripFormDialogProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false); // highlight all invalid fields after a click on the disabled button

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isValid, isDirty, touchedFields, isSubmitting },
  } = useForm<TripFormInput, unknown, TripInput>({
    resolver: zodResolver(tripSchema),
    mode: "onChange",
    defaultValues: initialValues,
  });

  const invalid = (name: keyof TripFormInput) =>
    Boolean(errors[name]) && (showAll || Boolean(touchedFields[name]));
  const err = (name: keyof TripFormInput) => errors[name]?.message as string | undefined;

  // "Close": warn first if there is anything changed (spec: data for this trip will be lost).
  function requestClose() {
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  }

  async function submit(values: TripInput) {
    setServerError(null);
    const error = await onSubmit(values);
    if (error) setServerError(error);
    else onClose();
  }

  const canSubmit = isValid && (!requireChanges || isDirty);

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
      <DialogHeader>
        <DialogTitle className="text-xl text-primary">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
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
              disabled={!canSubmit || isSubmitting}
              style={canSubmit ? undefined : { pointerEvents: "none" }}
            >
              {isSubmitting ? pendingLabel : submitLabel}
            </Button>
          </span>
        </div>
      </form>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <TriangleAlert className="size-6" />
            </div>
            <AlertDialogTitle>{discard.title}</AlertDialogTitle>
            <AlertDialogDescription>{discard.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{discard.keepLabel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onClose}>
              {discard.discardLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

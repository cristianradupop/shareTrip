"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  TRIP_PHOTO_REQUIRED,
  tripSchema,
  type TripFormInput,
  type TripInput,
} from "server-app/shared";
import { photoFileError } from "@/lib/trip-form";

export type TripFormDialogProps = {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  initialValues: TripFormInput;
  /** The photo the trip has now (edit), shown until a new one is chosen. */
  currentPhotoUrl?: string | null;
  /** Keep the submit button disabled until a valid photo is chosen (create). */
  photoRequired?: boolean;
  /** Keep the submit button disabled until something changed (edit). */
  requireChanges?: boolean;
  discard: { title: string; description: string; keepLabel: string; discardLabel: string };
  /** Returns an error message to show in the dialog, or null on success (the dialog then closes). */
  onSubmit: (values: TripInput, photo: File | null) => Promise<string | null>;
  onClose: () => void;
};

/** The "Trip details" pop-up shared by create and edit. The form is mounted only while open, so it starts fresh every time. */
export function TripFormDialog(props: TripFormDialogProps) {
  const { open, onClose } = props;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-[2rem] p-0 sm:max-w-4xl"
        showCloseButton={false}
      >
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
  currentPhotoUrl = null,
  photoRequired = false,
  requireChanges = false,
  discard,
  onSubmit,
  onClose,
}: TripFormDialogProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false); // highlight all invalid fields after a click on the disabled button
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

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

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function onPhotoChange(file: File | undefined) {
    if (!file) return;
    const problem = photoFileError(file);
    setPhotoError(problem);
    if (problem) return; // keep the previously chosen photo
    setServerError(null);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  const invalid = (name: keyof TripFormInput) =>
    Boolean(errors[name]) && (showAll || Boolean(touchedFields[name]));
  const err = (name: keyof TripFormInput) => errors[name]?.message as string | undefined;

  // "Close": warn first if there is anything changed (spec: data for this trip will be lost).
  function requestClose() {
    if (isDirty || photo) setConfirmDiscard(true);
    else onClose();
  }

  async function submit(values: TripInput) {
    setServerError(null);
    const error = await onSubmit(values, photo);
    if (error) setServerError(error);
    else onClose();
  }

  const canSubmit = isValid && (!photoRequired || photo !== null) && (!requireChanges || isDirty || photo !== null);
  const shownPhoto = preview ?? currentPhotoUrl;

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
      <DialogHeader className="border-b px-6 pt-6 pb-4 sm:px-8">
        <DialogTitle className="text-2xl font-semibold tracking-tight">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(submit)} className="flex min-h-0 flex-1 flex-col" noValidate>
        {/* Only this middle part scrolls, so the buttons below are always on screen. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
          <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
            <div className="space-y-2">
              <p className={`text-sm font-medium ${photoError || (showAll && photoRequired && !photo) ? "text-destructive" : ""}`}>
                Cover photo
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  onPhotoChange(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[1.5rem] bg-muted text-muted-foreground ring-1 ring-border transition-shadow hover:ring-primary md:aspect-[4/5]"
                aria-label={shownPhoto ? "Replace photo" : "Choose photo"}
              >
                {shownPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shownPhoto} alt="Trip cover preview" className="size-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-2 px-4 text-center text-sm">
                    <ImagePlus className="size-7 text-primary" />
                    JPG or PNG, max 2 MB
                  </span>
                )}
              </button>
              <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => fileRef.current?.click()}>
                <ImagePlus /> {shownPhoto ? "Replace photo" : "Choose photo"}
              </Button>
              {(photoError || (showAll && photoRequired && !photo)) && (
                <p className="text-xs text-destructive" role="alert">
                  {photoError ?? TRIP_PHOTO_REQUIRED}
                </p>
              )}
            </div>

            <div className="min-w-0 space-y-4">
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
              <Textarea id="theme" rows={3} placeholder="Cultural trip, mountain hike, city break…" aria-invalid={invalid("theme")} {...register("theme")} />
            </FormField>

            </div>
          </div>
        </div>

        <div className="space-y-3 border-t bg-popover px-6 py-4 sm:px-8">
          {serverError && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {serverError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 px-6" onClick={requestClose}>
              Close
            </Button>
            {/* A disabled button swallows clicks, so the wrapper reveals which fields are still missing. */}
            <span onClick={() => !canSubmit && setShowAll(true)}>
              <Button
                type="submit"
                className="h-11 w-full px-7 sm:w-auto"
                disabled={!canSubmit || isSubmitting}
                style={canSubmit ? undefined : { pointerEvents: "none" }}
              >
                {isSubmitting ? pendingLabel : submitLabel}
              </Button>
            </span>
          </div>
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

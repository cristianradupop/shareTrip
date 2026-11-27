"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { UserAvatar } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clientFetch } from "@/lib/client-api";
import { PHOTO_MAX_BYTES, PHOTO_TYPES, profileSchema, type ProfileInput } from "server-app/shared";

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

type ProfileFormProps = {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  gender: "male" | "female" | null;
  image: string | null;
};

export function ProfileForm({ firstName, lastName, phone, address, gender, image }: ProfileFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting, isValid },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    mode: "onChange",
    defaultValues: { firstName, lastName, phone, address, gender: gender ?? undefined },
  });

  useEffect(() => {
    reset({ firstName, lastName, phone, address, gender: gender ?? undefined });
  }, [address, firstName, gender, lastName, phone, reset]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function onPhotoChange(file: File | undefined) {
    if (!file) return;
    if (!PHOTO_TYPES.some((type) => type === file.type)) {
      setPhoto(null);
      setPreview(null);
      setPhotoError("Photo must be a JPG or PNG image");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setPhoto(null);
      setPreview(null);
      setPhotoError("Photo must be 2 MB or smaller");
      return;
    }
    setPhotoError(null);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function onSubmit(values: ProfileInput) {
    setServerError(null);
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) form.set(key, String(value));
    }
    if (photo) form.set("photo", photo);

    const result = await clientFetch("/api/profile", { method: "PATCH", form });
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setPhoto(null);
    setPreview(null);
    setPhotoError(null);
    reset(values);
    toast.success("Profile saved");
    router.refresh();
  }

  const canSave = isValid && (isDirty || photo !== null) && !photoError && !isSubmitting;
  const displayName = `${firstName} ${lastName}`.trim();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7" noValidate>
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Personal details</h2>
          <p className="text-sm text-muted-foreground">Update the information other travelers use to get in touch.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="firstName" error={errors.firstName?.message} invalid={Boolean(errors.firstName)}>
            <Input id="firstName" autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} {...register("firstName")} />
          </FormField>
          <FormField label="Last name" htmlFor="lastName" error={errors.lastName?.message} invalid={Boolean(errors.lastName)}>
            <Input id="lastName" autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} {...register("lastName")} />
          </FormField>
          <FormField label="Phone number" htmlFor="phone" error={errors.phone?.message} invalid={Boolean(errors.phone)}>
            <Input id="phone" type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} {...register("phone")} />
          </FormField>
          <FormField label="Home address" htmlFor="address" error={errors.address?.message} invalid={Boolean(errors.address)}>
            <Input id="address" autoComplete="street-address" aria-invalid={Boolean(errors.address)} {...register("address")} />
          </FormField>
          <FormField label="Gender" htmlFor="gender">
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select
                  items={GENDERS}
                  value={field.value ?? null}
                  onValueChange={(value) => field.onChange(value ?? undefined)}
                  onOpenChange={(open) => !open && field.onBlur()}
                >
                  <SelectTrigger id="gender" className="w-full" aria-label="Gender">
                    <SelectValue placeholder="Choose your gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <div>
          <h2 className="text-lg font-semibold">Profile photo</h2>
          <p className="text-sm text-muted-foreground">Use a JPG or PNG image up to 2 MB.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar name={displayName} image={preview ?? image} className="size-16" />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(event) => onPhotoChange(event.target.files?.[0])}
          />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <ImagePlus /> {photo ? "Choose another photo" : "Change photo"}
          </Button>
          {photo && <span className="text-sm text-muted-foreground">{photo.name}</span>}
        </div>
        {photoError && <p className="text-sm text-destructive" role="alert">{photoError}</p>}
      </section>

      {serverError && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{serverError}</p>}

      <Button type="submit" size="lg" disabled={!canSave}>
        {isSubmitting ? "Saving profile…" : "Save changes"}
      </Button>
    </form>
  );
}

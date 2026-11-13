"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ImagePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { signUpAction } from "@/app/actions/auth";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PHOTO_MAX_BYTES, signUpSchema, type SignUpInput } from "@/lib/validators";

const FIELDS: { name: keyof SignUpInput; label: string; type?: string; autoComplete?: string }[] = [
  { name: "username", label: "Username", autoComplete: "username" },
  { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
  { name: "firstName", label: "First name", autoComplete: "given-name" },
  { name: "lastName", label: "Last name", autoComplete: "family-name" },
  { name: "email", label: "Email address", type: "email", autoComplete: "email" },
  { name: "phone", label: "Phone number", type: "tel", autoComplete: "tel" },
  { name: "birthDate", label: "Birth date", type: "date", autoComplete: "bday" },
  { name: "address", label: "Home address", autoComplete: "street-address" },
];

export function SignUpForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false); // highlight every invalid field (after a click on the disabled button)
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, touchedFields, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: "onChange",
    defaultValues: { username: "", password: "", firstName: "", lastName: "", email: "", phone: "", address: "", birthDate: "" },
  });

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const canSubmit = isValid && photo !== null && !photoError;
  const showInvalid = (name: keyof SignUpInput) => Boolean(errors[name]) && (showAll || Boolean(touchedFields[name]));

  function onPhotoChange(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setPhoto(null); setPreview(null); setPhotoError("Photo must be a JPG or PNG image");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setPhoto(null); setPreview(null); setPhotoError("Photo must be 2 MB or smaller");
      return;
    }
    setPhotoError(null);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function onSubmit(values: SignUpInput) {
    if (!photo) return;
    setServerError(null);
    const data = new FormData();
    Object.entries(values).forEach(([k, v]) => data.append(k, v));
    data.append("photo", photo);
    const result = await signUpAction(data);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    // Do not refresh here: /signup redirects logged-in users, which would hide the success message.
    setCreated(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 2200);
  }

  if (created) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center" role="status">
        <CheckCircle2 className="size-14 text-emerald-500" />
        <p className="text-xl font-semibold">Your account has been successfully created</p>
        <p className="text-sm text-muted-foreground">Taking you to the home page…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <p className="text-center text-sm font-medium text-destructive">
        {canSubmit ? "" : "Please fill in all the fields"}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const invalid = showInvalid(f.name);
          const wide = f.name === "address" || f.name === "email";
          return (
            <FormField
              key={f.name}
              label={f.label}
              htmlFor={f.name}
              error={errors[f.name]?.message}
              invalid={invalid}
              className={wide ? "sm:col-span-2" : undefined}
            >
              <Input
                id={f.name}
                type={f.type ?? "text"}
                autoComplete={f.autoComplete}
                aria-invalid={invalid}
                {...register(f.name)}
              />
            </FormField>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <p className={`text-sm font-medium ${photoError || (showAll && !photo) ? "text-destructive" : ""}`}>
          Upload your photo here
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => onPhotoChange(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <ImagePlus /> {photo ? "Change photo" : "Choose photo"}
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="Your photo" className="size-12 rounded-full object-cover" />}
          {photo && !photoError && <span className="text-xs text-emerald-600">Photo successfully uploaded</span>}
        </div>
        {(photoError || (showAll && !photo)) && (
          <p className="text-xs text-destructive" role="alert">
            {photoError ?? "Upload at least one photo (JPG or PNG, max 2 MB)"}
          </p>
        )}
      </div>

      {serverError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      {/* A disabled button swallows clicks, so the wrapper reveals what is still missing. */}
      <span className="block" onClick={() => !canSubmit && setShowAll(true)}>
        <Button type="submit" size="lg" className="h-10 w-full" disabled={!canSubmit || isSubmitting} style={canSubmit ? undefined : { pointerEvents: "none" }}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </span>

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in here
        </Link>
      </p>
    </form>
  );
}

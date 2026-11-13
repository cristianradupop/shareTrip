"use server";

import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { deleteProfilePhoto, uploadProfilePhoto } from "@/lib/storage";
import { signUpSchema } from "@/lib/validators";

export type ActionResult = { ok: true } | { ok: false; error: string };

const FIELDS = ["username", "password", "firstName", "lastName", "email", "phone", "address", "birthDate"] as const;

/** Creates the account: validate -> upload photo -> sign up (which also logs the user in). */
export async function signUpAction(formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const data = parsed.data;

  const photo = formData.get("photo");
  if (!(photo instanceof File)) return { ok: false, error: "Upload at least one photo (JPG or PNG)" };
  const uploaded = await uploadProfilePhoto(photo);
  if (!uploaded.ok) return uploaded;

  try {
    await auth.api.signUpEmail({
      body: {
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        password: data.password,
        username: data.username,
        image: uploaded.url,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        address: data.address,
        birthDate: data.birthDate,
      },
    });
    return { ok: true };
  } catch (e) {
    await deleteProfilePhoto(uploaded.url); // do not leave an orphan file behind
    const message = e instanceof APIError ? e.message : "";
    if (/exist|taken|already/i.test(message)) {
      return { ok: false, error: "That username or email is already in use" };
    }
    return { ok: false, error: "Could not create the account. Please try again." };
  }
}

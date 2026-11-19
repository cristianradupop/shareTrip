import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { checkSameOrigin, jsonError } from "@/lib/api-auth";
import { SIGNUP_LIMIT_MESSAGE, consumeSignupAttempt } from "@/lib/signup-limit";
import { deleteProfilePhoto, uploadProfilePhoto } from "@/lib/storage";
import { signUpSchema } from "@/lib/validators";

const FIELDS = ["username", "password", "firstName", "lastName", "email", "phone", "address", "birthDate", "gender"] as const;

/** Creates the account: validate -> upload photo -> sign up (which also logs the user in). */
export async function POST(req: Request) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  // Every attempt counts, also invalid ones, and before the body or the photo is touched.
  const verdict = await consumeSignupAttempt(req);
  if (!verdict.allowed) {
    return Response.json(
      { ok: false, error: SIGNUP_LIMIT_MESSAGE },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } },
    );
  }
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError("Invalid data", 400);
  }
  const raw = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);
  const data = parsed.data;

  const photo = formData.get("photo");
  if (!(photo instanceof File)) return jsonError("Upload at least one photo (JPG or PNG)", 400);
  const uploaded = await uploadProfilePhoto(photo);
  if (!uploaded.ok) return jsonError(uploaded.error, 400);

  try {
    // nextCookies() sets the session cookie on this response.
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
        gender: data.gender,
      },
    });
    return Response.json({ ok: true });
  } catch (e) {
    await deleteProfilePhoto(uploaded.url); // do not leave an orphan file behind
    const message = e instanceof APIError ? e.message : "";
    if (/exist|taken|already/i.test(message)) return jsonError("That username or email is already in use", 409);
    return jsonError("Could not create the account. Please try again.", 400);
  }
}

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { accountSubject, buildEvent, changedFields, recordEvent } from "@/lib/audit";
import {
  checkSameOrigin,
  jsonError,
  readJson,
  requireApiUser,
  requireJson,
  requireMultipart,
} from "@/lib/api-auth";
import { deleteProfilePhoto, uploadProfilePhoto } from "@/lib/storage";
import { profileSchema } from "@/lib/validators";

async function removeProfilePhotoBestEffort(url: string | null | undefined) {
  try {
    await deleteProfilePhoto(url);
  } catch (error) {
    console.error("Could not clean up a profile photo", error);
  }
}

/** Lets a signed-in user edit their own profile. The row id always comes from the session. */
export async function PATCH(req: Request) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;

  const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const multipart = contentType === "multipart/form-data";
  const badContentType = multipart ? requireMultipart(req) : requireJson(req);
  if (badContentType) return badContentType;

  let photo: File | undefined;
  const formFields: Record<string, string> = {};
  let body: unknown;
  if (multipart) {
    try {
      const form = await req.formData();
      for (const key of ["firstName", "lastName", "phone", "address", "gender"] as const) {
        const value = form.get(key);
        if (typeof value === "string") formFields[key] = value;
      }
      const photoField = form.get("photo");
      if (typeof photoField === "string") return jsonError("Photo must be an image file", 400);
      if (photoField) photo = photoField;
      body = formFields;
    } catch {
      return jsonError("Invalid form data", 400);
    }
  } else {
    body = await readJson(req);
  }

  const parsed = profileSchema.safeParse(body);
  const photoOnly = multipart && photo !== undefined && Object.keys(formFields).length === 0;
  if (!parsed.success && !photoOnly) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);
  }
  const values = parsed.success ? parsed.data : {};

  let uploadedUrl: string | undefined;
  if (photo) {
    try {
      const uploaded = await uploadProfilePhoto(photo);
      if (!uploaded.ok) return jsonError(uploaded.error, 400);
      uploadedUrl = uploaded.url;
    } catch (error) {
      console.error("Could not upload a profile photo", error);
      return jsonError("Could not upload the photo. Try again.", 500);
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(user).where(eq(user.id, guard.user.id)).for("update");
      if (!before) return null;

      const updates: Partial<typeof user.$inferInsert> = { ...values };
      if (values.firstName !== undefined || values.lastName !== undefined) {
        const firstName = values.firstName ?? before.firstName;
        const lastName = values.lastName ?? before.lastName;
        updates.name = `${firstName} ${lastName}`.trim();
      }
      if (uploadedUrl) updates.image = uploadedUrl;

      const fields = changedFields(before, updates, ["name", "image"]);
      if (updates.image !== undefined && before.image !== updates.image) fields.push("photo");
      await tx.update(user).set(updates).where(eq(user.id, guard.user.id));
      if (fields.length > 0) {
        const actor = { id: guard.user.id, name: guard.user.name, role: "holder" as const };
        await recordEvent(tx, buildEvent("account.edited", actor, accountSubject(before), { changedFields: fields }));
      }
      return { oldImage: before.image };
    });
    if (!result) {
      if (uploadedUrl) await removeProfilePhotoBestEffort(uploadedUrl);
      return jsonError("Profile not found", 404);
    }
    if (uploadedUrl && result.oldImage !== uploadedUrl) {
      await removeProfilePhotoBestEffort(result.oldImage);
    }
  } catch (error) {
    console.error("Could not update the profile", error);
    if (uploadedUrl) await removeProfilePhotoBestEffort(uploadedUrl);
    return jsonError("Could not update the profile", 500);
  }
  return Response.json({ ok: true });
}

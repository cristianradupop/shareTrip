import "server-only";
import { createClient } from "@supabase/supabase-js";
import { PHOTO_MAX_BYTES, TRIP_PHOTO_REQUIRED } from "@/lib/validators";

const bucket = process.env.SUPABASE_PHOTOS_BUCKET || "profile-photos";

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY are not set");
  // Secret key: server only, never exposed to the browser.
  return createClient(url, key, { auth: { persistSession: false } });
}

// Check the real file signature, not just the browser-provided MIME type.
function detectImageType(bytes: Uint8Array): "jpg" | "png" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  const png = [0x89, 0x50, 0x4e, 0x47];
  if (png.every((b, i) => bytes[i] === b)) return "png";
  return null;
}

export type PhotoResult = { ok: true; url: string } | { ok: false; error: string };

async function uploadPhoto(file: File, prefix: string, emptyError: string): Promise<PhotoResult> {
  if (!file || file.size === 0) return { ok: false, error: emptyError };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: "Photo must be 2 MB or smaller" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectImageType(bytes);
  if (!ext) return { ok: false, error: "Photo must be a JPG or PNG image" };

  const path = `${prefix}${crypto.randomUUID()}.${ext}`; // generated name: never trust the client's file name
  const supabase = client();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: ext === "jpg" ? "image/jpeg" : "image/png",
  });
  if (error) return { ok: false, error: "Could not upload the photo. Try again." };

  return { ok: true, url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl };
}

export const uploadProfilePhoto = (file: File) =>
  uploadPhoto(file, "", "Upload at least one photo (JPG or PNG)");

export const uploadTripPhoto = (file: File) => uploadPhoto(file, "trips/", TRIP_PHOTO_REQUIRED);

export async function deleteProfilePhoto(url: string | null | undefined) {
  if (!url) return;
  const marker = `/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return;
  await client().storage.from(bucket).remove([url.slice(i + marker.length)]);
}

// Best effort: a leftover file is harmless, a failed cleanup must not fail the request.
export async function deleteTripPhoto(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const marker = `/${bucket}/trips/`;
  const i = url.indexOf(marker);
  if (i === -1) return;
  try {
    await client().storage.from(bucket).remove([url.slice(i + marker.length - "trips/".length)]);
  } catch {
    // ignored on purpose
  }
}

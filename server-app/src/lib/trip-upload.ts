import "server-only";
import type { z } from "zod";
import { jsonError } from "@/lib/api-auth";
import { TRIP_FIELDS, tripSchema } from "@/lib/validators";

type TripForm =
  | { ok: true; trip: z.output<typeof tripSchema>; photo: File | null }
  | { ok: false; response: Response };

/**
 * Reads a multipart trip form: the TRIP_FIELDS validated by tripSchema, plus the optional `photo` file
 * (null when missing or empty). Any other field, such as `photoUrl`, is ignored.
 */
export async function readTripForm(req: Request): Promise<TripForm> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { ok: false, response: jsonError("Invalid form data", 400) };
  }

  const raw: Record<string, string> = {};
  for (const key of TRIP_FIELDS) {
    const value = form.get(key);
    if (typeof value === "string") raw[key] = value;
  }
  const parsed = tripSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: jsonError(parsed.error.issues[0]?.message ?? "Invalid trip data", 400) };
  }

  const file = form.get("photo");
  const photo = file instanceof File && file.size > 0 ? file : null;
  return { ok: true, trip: parsed.data, photo };
}

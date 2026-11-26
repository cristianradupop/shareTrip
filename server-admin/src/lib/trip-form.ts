import { PHOTO_MAX_BYTES, PHOTO_TYPES, TRIP_FIELDS, type OrganizerTrip, type TripFormInput } from "server-app/shared";

/** The form fields of a trip, as the "Trip details" form expects them. */
export const toTripFormValues = (trip: OrganizerTrip): TripFormInput => ({
  destinationCity: trip.destinationCity,
  destinationCountry: trip.destinationCountry,
  departureDate: trip.departureDate,
  returnDate: trip.returnDate ?? "",
  maxTravelers: trip.maxTravelers,
  gender: trip.gender as TripFormInput["gender"],
  budgetEstimate: trip.budgetEstimate,
  currency: trip.currency as TripFormInput["currency"],
  transport: trip.transport as TripFormInput["transport"],
  theme: trip.theme,
});

/** The multipart body of create/edit: the trip fields as strings, plus the photo when one was chosen. */
export function toTripFormData(values: Partial<Record<(typeof TRIP_FIELDS)[number], unknown>>, photo: File | null): FormData {
  const data = new FormData();
  for (const key of TRIP_FIELDS) data.append(key, String(values[key] ?? ""));
  if (photo) data.append("photo", photo);
  return data;
}

/** Same rules as the server (JPG/PNG, max 2 MB). Returns a message, or null when the file is fine. */
export function photoFileError(file: { type: string; size: number }): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return "Photo must be a JPG or PNG image";
  if (file.size > PHOTO_MAX_BYTES) return "Photo must be 2 MB or smaller";
  return null;
}

import type { OrganizerTrip, TripFormInput } from "server-app/shared";

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

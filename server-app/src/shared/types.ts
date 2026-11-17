// JSON-safe types shared by server-app (producer) and server-admin (consumer).
// Keep this file free of `@/` imports: server-admin type-checks it with its own alias.

export type FeedSort = "asc" | "desc";

export type FeedTrip = {
  id: string;
  city: string;
  country: string;
  departureDate: string;
  returnDate: string | null;
  budget: string;
  currency: string;
  transport: string;
  gender: string;
  theme: string;
  maxTravelers: number;
  createdAt: string;
  joined: number;
  organizerName: string;
  organizerImage: string | null;
};

export type OrganizerTrip = {
  id: string;
  organizerId: string;
  destinationCity: string;
  destinationCountry: string;
  departureDate: string;
  returnDate: string | null;
  budgetEstimate: string;
  currency: string;
  transport: string;
  gender: string;
  theme: string;
  maxTravelers: number;
  status: string;
  createdAt: string;
  joined: number;
};

export type OrganizerStats = {
  trips: number;
  participants: number;
  upcoming: number;
};

export type AdminUserRow = {
  id: string;
  username: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  birthDate: string;
  role: "user" | "admin";
  banned: boolean;
  image: string | null;
  createdAt: string;
};

export type SessionUser = {
  id: string;
  username: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  birthDate: string;
  image: string | null;
  role: "user" | "admin";
};

export type ApiResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

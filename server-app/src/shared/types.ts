// JSON-safe types shared by server-app (producer) and server-admin (consumer).
// Keep this file free of `@/` imports: server-admin type-checks it with its own alias.

/** What the signed-in viewer can do with a feed trip. */
export type JoinState = "join" | "requested" | "declined" | "joined" | "full" | "wrong_gender";

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
  status: "active" | "full";
  createdAt: string;
  joined: number;
  organizerName: string;
  organizerImage: string | null;
  photoUrl: string | null;
  /** Only present when the request has a session. */
  viewerState?: JoinState;
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
  photoUrl: string | null;
  joined: number;
  pending: number;
};

export type OrganizerStats = {
  trips: number;
  participants: number;
  upcoming: number;
  pendingRequests: number;
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
  gender: "male" | "female" | null;
  role: "user" | "admin";
  banned: boolean;
  image: string | null;
  createdAt: string;
};

export type AdminStats = {
  users: { total: number; active: number; banned: number; admins: number; last7Days: number; last30Days: number };
  trips: { active: number; full: number; cancelled: number; upcoming: number; departed: number };
  requests: { pending: number; approved: number; declined: number };
  members: number;
};

export type AdminTripRow = {
  id: string;
  city: string;
  country: string;
  departureDate: string;
  returnDate: string | null;
  status: "active" | "full" | "cancelled";
  maxTravelers: number;
  members: number;
  budget: string;
  currency: string;
  transport: string;
  gender: string;
  theme: string;
  organizerName: string;
  organizerEmail: string;
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
  gender: "male" | "female" | null;
  image: string | null;
  role: "user" | "admin";
};

export type ApiResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

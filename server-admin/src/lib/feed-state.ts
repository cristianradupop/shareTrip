import type { FeedTrip } from "server-app/shared";

export type FeedState = {
  trips: FeedTrip[];
  cursor: string | null;
  done: boolean;
  gen: number;
  city: string | undefined;
  since: string;
  error: boolean;
};

export type FeedPage = { trips: FeedTrip[]; nextCursor: string | null; now?: string };

export type FeedAction =
  | { type: "reset"; city: string | undefined }
  | { type: "pageLoaded"; gen: number; page: FeedPage }
  | { type: "refreshed"; gen: number; trips: FeedTrip[]; now: string }
  | { type: "failed"; gen: number }
  | { type: "tripPatched"; id: string; patch: Partial<FeedTrip> };

export function feedQuery(params: { city?: string; cursor?: string; since?: string }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  return q.toString();
}

export function mergeTrips(existing: FeedTrip[], incoming: FeedTrip[], mode: "append" | "prepend") {
  const known = new Set(existing.map((t) => t.id));
  const fresh = incoming.filter((t) => !known.has(t.id));
  return mode === "append" ? [...existing, ...fresh] : [...fresh, ...existing];
}

export function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "reset":
      return { ...state, city: action.city, trips: [], cursor: null, gen: state.gen + 1, done: false, error: false };
    case "pageLoaded":
      if (action.gen !== state.gen) return state;
      return {
        ...state,
        trips: mergeTrips(state.trips, action.page.trips, "append"),
        cursor: action.page.nextCursor,
        done: action.page.nextCursor === null,
        // An empty list means this is the generation's first page, so its `now` becomes the new baseline.
        since: state.trips.length === 0 ? (action.page.now ?? state.since) : state.since,
        error: false,
      };
    case "refreshed":
      if (action.gen !== state.gen) return state;
      return { ...state, trips: mergeTrips(state.trips, action.trips, "prepend"), since: action.now };
    case "tripPatched":
      if (!state.trips.some((t) => t.id === action.id)) return state;
      return { ...state, trips: state.trips.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)) };
    case "failed":
      return action.gen === state.gen ? { ...state, error: true } : state;
  }
}

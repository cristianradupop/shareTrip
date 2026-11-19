import type { FeedTrip } from "server-app/shared";

export type JoinActionView = {
  label: string;
  disabled: boolean;
  /** Set only for the logged-out Join link. */
  href: string | null;
  secondary: "withdraw" | "leave" | null;
  /** Set only when the viewer's gender does not match the trip. */
  reason: string | null;
};

const view = (label: string, o: Partial<JoinActionView> = {}): JoinActionView => ({
  label,
  disabled: false,
  href: null,
  secondary: null,
  reason: null,
  ...o,
});

/** What the join button of a feed card shows, from the trip and the viewer's state (absent when logged out). */
export function joinActionView(trip: FeedTrip): JoinActionView {
  switch (trip.viewerState) {
    case undefined:
      if (trip.status === "full" || trip.joined + 1 >= trip.maxTravelers) return view("Full", { disabled: true });
      return view("Join", { href: `/login?next=${encodeURIComponent("/#trips")}` });
    case "join":
      return view("Join");
    case "requested":
      return view("Requested", { secondary: "withdraw" });
    case "joined":
      return view("Joined", { secondary: "leave" });
    case "declined":
      return view("Declined", { disabled: true });
    case "full":
      return view("Full", { disabled: true });
    case "wrong_gender":
      return view("Join", { disabled: true, reason: trip.gender === "female" ? "Women only" : "Men only" });
  }
}

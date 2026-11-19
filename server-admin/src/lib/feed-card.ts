import type { FeedTrip } from "server-app/shared";

export type TransportKey = "plane" | "car" | "bus" | "train" | "ship" | "other";

const GRADIENT: Record<TransportKey, string> = {
  plane: "from-sky-500 to-teal-500",
  car: "from-orange-500 to-amber-400",
  bus: "from-emerald-500 to-teal-400",
  train: "from-indigo-500 to-sky-400",
  ship: "from-cyan-600 to-blue-500",
  other: "from-orange-400 to-teal-500",
};

function transportKey(transport: string): TransportKey {
  return Object.hasOwn(GRADIENT, transport) ? (transport as TransportKey) : "other";
}

export function feedCardView(trip: FeedTrip) {
  const seatsTotal = trip.maxTravelers;
  const seatsTaken = trip.joined + 1; // the organizer holds a seat
  const isFull = trip.status === "full" || seatsTaken >= seatsTotal;
  const spotsLeft = Math.max(seatsTotal - seatsTaken, 0);
  const raw = seatsTotal > 0 ? Math.round((seatsTaken / seatsTotal) * 100) : 100;
  const fillPercent = Math.min(Math.max(raw, 0), 100);
  const icon = transportKey(trip.transport);
  return {
    seatsTaken,
    seatsTotal,
    fillPercent,
    isFull,
    spotsLeft,
    seatsLabel: `${Math.min(seatsTaken, seatsTotal)} of ${seatsTotal} seats taken`,
    spotsLabel: isFull ? "Full" : `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left`,
    icon,
    gradient: GRADIENT[icon],
  };
}

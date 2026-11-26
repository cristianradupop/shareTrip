import type { FeedTrip } from "server-app/shared";

export type TransportKey = "plane" | "car" | "bus" | "train" | "ship" | "other";

const GRADIENT: Record<TransportKey, string> = {
  plane: "from-[oklch(0.2_0.02_17)] to-[oklch(0.42_0.12_19)]",
  car: "from-[oklch(0.58_0.2_19)] to-[oklch(0.72_0.16_35)]",
  bus: "from-[oklch(0.3_0.03_286)] to-[oklch(0.52_0.06_286)]",
  train: "from-[oklch(0.15_0.012_17)] to-[oklch(0.33_0.02_17)]",
  ship: "from-[oklch(0.45_0.15_19)] to-[oklch(0.64_0.205_19)]",
  other: "from-[oklch(0.25_0.02_17)] to-[oklch(0.58_0.2_19)]",
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

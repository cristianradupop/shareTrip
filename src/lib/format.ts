// Dates come from Postgres as "YYYY-MM-DD" strings. Format them in UTC so they never shift a day.
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function formatDateRange(departure: string, back?: string | null) {
  const a = parse(departure);
  const opts = { timeZone: "UTC" } as const;
  const month = (d: Date) => d.toLocaleDateString("en-US", { ...opts, month: "short" });
  const day = (d: Date) => d.toLocaleDateString("en-US", { ...opts, day: "numeric" });
  const year = (d: Date) => d.toLocaleDateString("en-US", { ...opts, year: "numeric" });

  if (!back || back === departure) return `${month(a)} ${day(a)}, ${year(a)}`;
  const b = parse(back);
  if (month(a) === month(b) && year(a) === year(b)) return `${month(a)} ${day(a)} – ${day(b)}, ${year(a)}`;
  if (year(a) === year(b)) return `${month(a)} ${day(a)} – ${month(b)} ${day(b)}, ${year(a)}`;
  return `${month(a)} ${day(a)}, ${year(a)} – ${month(b)} ${day(b)}, ${year(b)}`;
}

export function formatMoney(amount: string | number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export const GENDER_LABEL: Record<string, string> = {
  mixed: "Male and female",
  female: "Females only",
  male: "Males only",
};

export const TRANSPORT_LABEL: Record<string, string> = {
  plane: "Plane",
  car: "Car",
  bus: "Bus",
  train: "Train",
  ship: "Ship",
  other: "Other",
};

export function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

import { cn } from "@/lib/utils";

// Placeholder "photo" for a trip: a mountain landscape whose colors depend on the city name.
const PALETTES = [
  ["#fdba74", "#f97316", "#1e3a5f"],
  ["#99f6e4", "#14b8a6", "#134e4a"],
  ["#fde68a", "#f59e0b", "#3b2f63"],
  ["#bae6fd", "#38bdf8", "#1e3a5f"],
  ["#fecdd3", "#fb7185", "#4c1d4f"],
  ["#bbf7d0", "#22c55e", "#14532d"],
];

function hash(text: string) {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function TripCover({ seed, className }: { seed: string; className?: string }) {
  const [sky, sun, ground] = PALETTES[hash(seed) % PALETTES.length];
  const id = `cover-${hash(seed)}`;
  return (
    <svg
      viewBox="0 0 300 160"
      preserveAspectRatio="xMidYMid slice"
      className={cn("h-full w-full", className)}
      role="img"
      aria-label={`Illustration for ${seed}`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky} />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <rect width="300" height="160" fill={`url(#${id})`} />
      <circle cx={80 + (hash(seed) % 140)} cy="52" r="20" fill={sun} opacity="0.85" />
      <path d="M0 120 70 58l45 50 40-36 70 62 75-44v70H0Z" fill={ground} opacity="0.55" />
      <path d="M0 140 60 96l50 40 55-34 60 48 75-32v42H0Z" fill={ground} />
    </svg>
  );
}

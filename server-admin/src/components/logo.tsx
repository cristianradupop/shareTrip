import Link from "next/link";
import { cn } from "@/lib/utils";

export function MountainMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" fill="none" className={cn("h-7 w-10", className)} aria-hidden="true">
      <path
        d="M2 29 17 6l7 11 5-7 17 19"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m13 14 4 4 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <MountainMark />
      <span className="text-xl">TripTogether</span>
    </Link>
  );
}

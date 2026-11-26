import Link from "next/link";
import { cn } from "@/lib/utils";

/** A folded red flag on a peak: the TripTogether mark. Inherits its color from `text-*`. */
export function MountainMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("size-7", className)} aria-hidden="true">
      <path d="M8 3v26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 4.5 25 9.5 8 16.5Z" fill="currentColor" />
      <path d="M8 16.5 17 13v8.5Z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-1.5 font-semibold tracking-tight", className)}>
      <MountainMark className="text-primary" />
      <span className="text-xl">
        Trip<span className="text-primary">Together</span>
      </span>
    </Link>
  );
}

import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** The round red arrow used on tiles and pill buttons across the site. */
export function ArrowBadge({
  direction = "up-right",
  tone = "primary",
  className,
}: {
  direction?: "up-right" | "right";
  tone?: "primary" | "light" | "dark";
  className?: string;
}) {
  const Icon = direction === "right" ? ArrowRight : ArrowUpRight;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:rotate-45",
        direction === "right" && "group-hover:rotate-0 group-hover:translate-x-0.5",
        tone === "primary" && "bg-primary text-primary-foreground",
        tone === "light" && "bg-white text-primary",
        tone === "dark" && "bg-ink text-ink-foreground",
        className,
      )}
    >
      <Icon className="size-4.5" />
    </span>
  );
}

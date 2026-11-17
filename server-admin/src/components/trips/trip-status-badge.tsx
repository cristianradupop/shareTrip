import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  full: { label: "Full", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export function TripStatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? STYLES.active;
  return (
    <Badge variant="secondary" className={cn("rounded-full border-0 px-3 font-medium", s.className)}>
      {s.label}
    </Badge>
  );
}

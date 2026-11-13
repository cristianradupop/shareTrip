import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label + control + error message. `invalid` turns the message on; the control itself must also
 * receive aria-invalid so it gets the red border from the shadcn styles.
 */
export function FormField({
  label,
  htmlFor,
  error,
  invalid,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  invalid?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className={cn(invalid && "text-destructive")}>
        {label}
      </Label>
      {children}
      {invalid && error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

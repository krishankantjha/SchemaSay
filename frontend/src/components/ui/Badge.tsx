import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "pii" | "accent" | "info";

const variants: Record<BadgeVariant, string> = {
  default: "bg-bg-elevated text-text-secondary border-border-default",
  success: "bg-[var(--color-success-muted)] text-success border-success/30",
  warning: "bg-[var(--color-warning-muted)] text-warning border-warning/30",
  danger: "bg-[var(--color-danger-muted)] text-danger border-danger/30",
  pii: "bg-[var(--color-pii-muted)] text-pii border-pii/30",
  accent: "bg-accent-muted text-accent border-accent/30",
  info: "bg-[var(--color-accent-muted)] text-accent border-accent/30",
};

type BadgeProps = {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-none",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

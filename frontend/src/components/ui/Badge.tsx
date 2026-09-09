type BadgeVariant = "default" | "success" | "warning" | "danger" | "pii" | "accent";

const variants: Record<BadgeVariant, string> = {
  default: "bg-bg-elevated text-text-secondary border-border-default",
  success: "bg-[var(--color-success-muted)] text-success border-success/30",
  warning: "bg-[var(--color-warning-muted)] text-warning border-warning/30",
  danger: "bg-[var(--color-danger-muted)] text-danger border-danger/30",
  pii: "bg-[var(--color-pii-muted)] text-pii border-pii/30",
  accent: "bg-accent-muted text-accent border-accent/30",
};

type BadgeProps = {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
};

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        variants[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

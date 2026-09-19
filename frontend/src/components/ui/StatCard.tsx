import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  variant?: "default" | "accent" | "warning" | "danger" | "success";
};

const variantStyles = {
  default: "border-border-subtle",
  accent: "border-accent/30 bg-accent-muted/20",
  warning: "border-warning/30 bg-[var(--color-warning-muted)]/30",
  danger: "border-danger/30 bg-[var(--color-danger-muted)]/30",
  success: "border-success/30 bg-[var(--color-success-muted)]/30",
};

export function StatCard({ label, value, icon: Icon, hint, variant = "default" }: StatCardProps) {
  return (
    <div className={cn("surface-card p-4 transition-[border-color,box-shadow] duration-150 ease-out hover:border-border-default", variantStyles[variant])}>
      <div className="flex items-start justify-between gap-2">
        <p className="type-meta">{label}</p>
        {Icon ? <Icon className="icon-md text-text-muted" strokeWidth={2} aria-hidden /> : null}
      </div>
      <p className="type-display mt-1.5 text-2xl tabular-nums">{value}</p>
      {hint ? <p className="type-meta mt-1 normal-case tracking-normal">{hint}</p> : null}
    </div>
  );
}

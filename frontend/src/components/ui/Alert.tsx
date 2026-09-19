import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "info" | "success" | "warning" | "danger";

const variantStyles: Record<AlertVariant, { box: string; icon: typeof Info }> = {
  info: {
    box: "border-accent/30 bg-[var(--color-accent-muted)] text-text-primary",
    icon: Info,
  },
  success: {
    box: "border-success/30 bg-[var(--color-success-muted)] text-text-primary",
    icon: CheckCircle2,
  },
  warning: {
    box: "border-warning/30 bg-[var(--color-warning-muted)] text-text-primary",
    icon: AlertTriangle,
  },
  danger: {
    box: "border-danger/30 bg-[var(--color-danger-muted)] text-text-primary",
    icon: AlertCircle,
  },
};

const iconColors: Record<AlertVariant, string> = {
  info: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

type AlertProps = {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Alert({ variant = "info", title, children, className }: AlertProps) {
  const { box, icon: Icon } = variantStyles[variant];

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-[var(--radius-md)] border px-3.5 py-3 text-sm leading-relaxed animate-reveal",
        box,
        className,
      )}
    >
      <Icon className={cn("icon-md mt-0.5", iconColors[variant])} strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-0.5 font-medium text-text-primary">{title}</p> : null}
        <div className="text-text-secondary [&_p]:m-0">{children}</div>
      </div>
    </div>
  );
}

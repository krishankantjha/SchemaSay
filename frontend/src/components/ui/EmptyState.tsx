import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Primary CTA slot (button or link) */
  action?: ReactNode;
  /** Secondary CTA slot, shown beside primary */
  secondaryAction?: ReactNode;
  className?: string;
  compact?: boolean;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  const hasActions = action || secondaryAction;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center animate-reveal",
        compact ? "py-8" : "min-h-[40vh] py-12",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-border-subtle bg-bg-elevated shadow-sm">
          <Icon className="icon-lg text-accent" strokeWidth={2} aria-hidden />
        </div>
      ) : null}
      <h2 className="type-display text-lg">{title}</h2>
      {description ? (
        <p className="type-body mt-2 max-w-md leading-relaxed">{description}</p>
      ) : null}
      {hasActions ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

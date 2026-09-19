import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  compact = false,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        compact ? "mb-4" : "mb-0",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? <p className="type-meta">{eyebrow}</p> : null}
        <h1 className={cn("page-title", compact && "text-xl")}>{title}</h1>
        {description ? <p className="page-description max-w-2xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

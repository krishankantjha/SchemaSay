import { memo, useMemo, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import type { InsightResponse } from "@/lib/api/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { deriveResultStats, escapeRegExp } from "@/lib/result-stats";
import { cn } from "@/lib/utils";

type InsightPanelProps = {
  insight: InsightResponse | null;
  isLoading: boolean;
  error: string | null;
  rows?: Record<string, unknown>[];
  onRetry?: () => void;
  onHighlightColumn?: (column: string) => void;
};

export const InsightPanel = memo(function InsightPanel({
  insight,
  isLoading,
  error,
  rows = [],
  onRetry,
  onHighlightColumn,
}: InsightPanelProps) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const stats = useMemo(() => deriveResultStats(rows), [rows]);

  if (isLoading) {
    return (
      <div
        className="rounded-[var(--radius-md)] border border-brand/20 bg-[var(--color-brand-muted)] px-4 py-4"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Sparkles className="h-4 w-4 text-brand" strokeWidth={2} aria-hidden />
          Writing a concise answer from these results…
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-4/5" />
          <Skeleton className="h-2.5 w-2/3" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="warning" title="Answer unavailable">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p>{error}</p>
          {onRetry ? (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      </Alert>
    );
  }

  if (!insight?.insight) return null;

  return (
    <div
      className={cn(
        "animate-reveal rounded-[var(--radius-md)] border border-brand/25 bg-[var(--color-brand-muted)] px-4 py-4",
        "shadow-sm",
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand" strokeWidth={2} aria-hidden />
        <p className="text-meta text-brand normal-case">Answer</p>
      </div>
      <p className="mt-2 text-base leading-relaxed text-text-primary">
        {renderLinkedInsight(insight.insight, columns, onHighlightColumn)}
      </p>
      {stats.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {stats.map((stat) => (
            <li key={stat.label}>
              <button
                type="button"
                disabled={!stat.column || !onHighlightColumn}
                onClick={() => stat.column && onHighlightColumn?.(stat.column)}
                className={cn(
                  "rounded-full border border-brand/20 bg-bg-surface/50 px-2.5 py-1 text-left text-[11px]",
                  stat.column && onHighlightColumn
                    ? "cursor-pointer hover:border-brand/40"
                    : "cursor-default",
                )}
              >
                <span className="text-text-muted">{stat.label}</span>
                <span className="ml-1.5 font-medium tabular-nums text-text-primary">{stat.value}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});

function renderLinkedInsight(
  text: string,
  columns: string[],
  onHighlightColumn?: (column: string) => void,
): ReactNode {
  const parts: ReactNode[] = [];
  const columnPattern =
    columns.filter((c) => c.length > 1).length > 0
      ? columns
          .filter((c) => c.length > 1)
          .slice()
          .sort((a, b) => b.length - a.length)
          .map(escapeRegExp)
          .join("|")
      : null;
  const pattern = new RegExp(
    `${columnPattern ? `(${columnPattern})|` : ""}(\\$[\\d,]+(?:\\.\\d+)?%?)|(\\b\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?%?\\b)|(\\b\\d+\\.\\d+%?\\b)|(\\b\\d{2,}%\\b)`,
    "gi",
  );

  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  const columnSet = new Set(columns.map((c) => c.toLowerCase()));

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const isColumn = columnSet.has(token.toLowerCase());
    if (isColumn) {
      parts.push(
        <button
          key={`c-${key++}`}
          type="button"
          onClick={() => onHighlightColumn?.(columns.find((c) => c.toLowerCase() === token.toLowerCase()) ?? token)}
          className="rounded-sm bg-brand/15 px-0.5 font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
        >
          {token}
        </button>,
      );
    } else {
      parts.push(
        <span key={`n-${key++}`} className="font-medium tabular-nums text-brand">
          {token}
        </span>,
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

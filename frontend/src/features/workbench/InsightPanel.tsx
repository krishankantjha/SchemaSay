import { Loader2 } from "lucide-react";
import type { InsightResponse } from "@/lib/api/types";

type InsightPanelProps = {
  insight: InsightResponse | null;
  isLoading: boolean;
  error: string | null;
};

export function InsightPanel({ insight, isLoading, error }: InsightPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border-subtle bg-bg-elevated/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          Summarizing results…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border-subtle bg-bg-surface px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Answer</p>
        <p className="mt-1.5 text-sm text-text-muted">{error}</p>
      </div>
    );
  }

  if (!insight?.insight) return null;

  return (
    <div className="rounded-lg border border-accent/20 bg-accent-muted/20 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Answer</p>
      <p className="mt-1.5 text-base leading-relaxed text-text-primary">{insight.insight}</p>
    </div>
  );
}

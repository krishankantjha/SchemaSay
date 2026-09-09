import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { QueryExplanation } from "@/lib/api/types";
import { resolutionSourceLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { ConfidenceRing } from "@/components/ui/ConfidenceRing";

type ExplanationPanelProps = {
  explanation: QueryExplanation | null;
  correlationId?: string | null;
  error?: string | null;
};

export function ExplanationPanel({ explanation, correlationId, error }: ExplanationPanelProps) {
  if (error && !explanation) {
    return (
      <aside className="flex h-full flex-col border-l border-border-subtle bg-bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Inspector
        </h2>
        <div className="mt-4 flex gap-2 rounded-lg border border-danger/30 bg-[var(--color-danger-muted)] p-3">
          <XCircle className="h-4 w-4 shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      </aside>
    );
  }

  if (!explanation) {
    return (
      <aside className="flex h-full flex-col border-l border-border-subtle bg-bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Inspector
        </h2>
        <p className="mt-4 text-sm text-text-muted">
          Run a query to see confidence, grounding, and assumptions.
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex h-full flex-col overflow-y-auto border-l border-border-subtle bg-bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Inspector
      </h2>

      <div className="mt-4 flex justify-center">
        <ConfidenceRing value={explanation.confidence} />
      </div>

      {explanation.resolution_source ? (
        <div className="mt-4">
          <SectionLabel>Resolution</SectionLabel>
          <Badge variant="accent">{resolutionSourceLabel(explanation.resolution_source)}</Badge>
        </div>
      ) : null}

      <div className="mt-4">
        <SectionLabel>What this query does</SectionLabel>
        <p className="text-sm text-text-secondary">{explanation.summary}</p>
      </div>

      <div className="mt-4">
        <SectionLabel>Grounding</SectionLabel>
        <div className="flex items-center gap-2 text-sm">
          {explanation.grounded ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-success">Grounded in schema</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-danger" />
              <span className="text-danger">Not fully grounded</span>
            </>
          )}
        </div>
        {explanation.unknown_tables.length ? (
          <p className="mt-1 text-xs text-danger">
            Unknown tables: {explanation.unknown_tables.join(", ")}
          </p>
        ) : null}
        {explanation.unknown_columns.length ? (
          <p className="mt-1 text-xs text-danger">
            Unknown columns: {explanation.unknown_columns.join(", ")}
          </p>
        ) : null}
      </div>

      {explanation.tables_used.length ? (
        <div className="mt-4">
          <SectionLabel>Tables used</SectionLabel>
          <div className="flex flex-wrap gap-1">
            {explanation.tables_used.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        </div>
      ) : null}

      {explanation.assumptions.length ? (
        <div className="mt-4">
          <SectionLabel>Assumptions</SectionLabel>
          <ul className="list-inside list-disc space-y-1 text-sm text-text-secondary">
            {explanation.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {explanation.warnings.length ? (
        <div className="mt-4 rounded-lg border border-warning/30 bg-[var(--color-warning-muted)] p-3">
          <div className="mb-1 flex items-center gap-1.5 text-warning">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase">Warnings</span>
          </div>
          <ul className="list-inside list-disc space-y-1 text-xs text-text-secondary">
            {explanation.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {correlationId ? (
        <div className="mt-4 border-t border-border-subtle pt-3">
          <SectionLabel>Correlation ID</SectionLabel>
          <code className="break-all text-[10px] text-text-muted">{correlationId}</code>
        </div>
      ) : null}
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
      {children}
    </p>
  );
}

import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { QueryExplanation } from "@/lib/api/types";
import { resolutionSourceLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { ConfidenceRing } from "@/components/ui/ConfidenceRing";

type QueryTrustPanelProps = {
  explanation: QueryExplanation | null;
  correlationId?: string | null;
  error?: string | null;
  sql?: string | null;
};

export function QueryTrustPanel({
  explanation,
  correlationId,
  error,
  sql,
}: QueryTrustPanelProps) {
  if (error && !explanation) {
    return (
      <aside className="flex h-full flex-col border-l border-border-subtle bg-bg-surface p-4">
        <PanelHeader />
        <div className="mt-3 flex gap-2 rounded-lg border border-danger/30 bg-[var(--color-danger-muted)] p-3">
          <XCircle className="h-4 w-4 shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      </aside>
    );
  }

  if (!explanation) {
    return (
      <aside className="flex h-full flex-col border-l border-border-subtle bg-bg-surface p-4">
        <PanelHeader />
        <div className="mt-3 rounded-lg border border-border-subtle bg-bg-elevated/50 p-3">
          <div className="flex items-center gap-2 rounded-md border border-accent/20 bg-accent-muted/30 px-2 py-1.5">
            <Lock className="h-3.5 w-3.5 text-accent" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
              Read only
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-text-muted">
            <li>Query validated</li>
            <li>Schema matched</li>
            <li>Relationships verified</li>
            <li>Confidence score</li>
          </ul>
          <p className="mt-3 text-xs text-text-muted">
            Run a query to populate trust signals.
          </p>
        </div>
      </aside>
    );
  }

  const schemaMatchPct = explanation.grounded
    ? Math.min(100, Math.round(explanation.confidence))
    : Math.max(0, Math.round(explanation.confidence * 0.6));

  const columnsUsed = extractColumnsFromSql(sql, explanation.tables_used);

  return (
    <aside className="flex h-full flex-col overflow-y-auto border-l border-border-subtle bg-bg-surface p-4">
      <PanelHeader />

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent/25 bg-accent-muted/40 px-3 py-2">
        <Lock className="h-4 w-4 shrink-0 text-accent" />
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">
          Read only
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        <TrustCheck ok label="Query validated" />
        <TrustCheck ok={explanation.grounded} label="Schema matched" />
        <TrustCheck
          ok={!explanation.unknown_tables.length && !explanation.unknown_columns.length}
          label="Relationships verified"
        />
      </ul>

      <div className="mt-4 flex justify-center">
        <ConfidenceRing value={explanation.confidence} />
      </div>

      <div className="mt-3 text-center">
        <p className="text-[10px] uppercase tracking-wide text-text-muted">Schema match</p>
        <p className="text-lg font-semibold tabular-nums text-text-primary">{schemaMatchPct}%</p>
        <p className="mt-0.5 text-[10px] text-text-muted">How well the query fits your tables</p>
      </div>

      <div className="mt-4">
        <SectionLabel>What ran</SectionLabel>
        <p className="text-sm text-text-secondary">{explanation.summary}</p>
        {explanation.metric_label ? (
          <p className="mt-1 text-xs text-ai">Using metric: {explanation.metric_label}</p>
        ) : explanation.resolution_source ? (
          <p className="mt-1 text-xs text-text-muted">
            {resolutionSourceLabel(explanation.resolution_source)}
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

      {columnsUsed.length ? (
        <div className="mt-4">
          <SectionLabel>Columns referenced</SectionLabel>
          <div className="flex flex-wrap gap-1">
            {columnsUsed.slice(0, 12).map((c) => (
              <Badge key={c} variant="default">
                {c}
              </Badge>
            ))}
          </div>
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

    </aside>
  );
}

function PanelHeader() {
  return (
    <div className="flex items-center gap-2">
      <ShieldCheck className="h-4 w-4 text-accent" />
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Query Trust
      </h2>
    </div>
  );
}

function TrustCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-warning" />
      )}
      <span className={ok ? "text-text-secondary" : "text-warning"}>{label}</span>
    </li>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
      {children}
    </p>
  );
}

function extractColumnsFromSql(sql: string | null | undefined, tables: string[]): string[] {
  if (!sql) return [];
  const found = new Set<string>();
  const pattern = /\b([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql)) !== null) {
    if (!tables.length || tables.includes(match[1])) {
      found.add(`${match[1]}.${match[2]}`);
    }
  }
  return [...found];
}

import { memo, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronsRight,
  GitBranch,
  Loader2,
  Lock,
  ShieldCheck,
  Table2,
  XCircle,
} from "lucide-react";
import type { QueryExplanation } from "@/lib/api/types";
import { resolutionSourceLabel, routingDecisionLabel } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ConfidenceRing } from "@/components/ui/ConfidenceRing";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

type PipelineStatus = "pending" | "running" | "pass" | "fail";

type PipelineStep = {
  id: string;
  label: string;
  detail: string;
  status: PipelineStatus;
  tooltip: string;
};

type QueryTrustPanelProps = {
  explanation: QueryExplanation | null;
  correlationId?: string | null;
  error?: string | null;
  sql?: string | null;
  running?: boolean;
  className?: string;
  onCollapse?: () => void;
};

export const QueryTrustPanel = memo(function QueryTrustPanel({
  explanation,
  correlationId,
  error,
  sql,
  running = false,
  className,
  onCollapse,
}: QueryTrustPanelProps) {
  const steps = useVerificationSteps({ explanation, error, sql, running });

  return (
    <aside
      aria-label="Query trust and validation"
      className={cn(
        "flex h-full flex-col overflow-y-auto overscroll-contain bg-transparent p-4 touch-pan-y",
        className,
      )}
    >
      <PanelHeader onCollapse={onCollapse} />

      {error && !explanation && !running ? (
        <Alert variant="danger" className="mt-3">
          {error}
        </Alert>
      ) : null}

      <div className="mt-3 rounded-[var(--radius-md)] border border-accent/25 bg-accent-muted/30 px-3 py-2">
        <Tooltip content="SchemaSay only generates and executes a single SELECT. Writes, unions, and stacked statements are blocked.">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
            <span className="text-meta text-accent normal-case">Read-only workspace</span>
          </div>
        </Tooltip>
      </div>

      {explanation ? (
        <ConfidenceCard explanation={explanation} />
      ) : running ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated/40 px-3 py-3 text-center">
          <p className="text-sm font-medium text-text-primary">Verifying…</p>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="type-meta mb-2">Verification</p>
        <VerificationPipeline steps={steps} />
      </div>

      {explanation ? (
        <>
          <div className="mt-5">
            <SectionLabel>How we interpreted this</SectionLabel>
            <p className="text-sm leading-relaxed text-text-secondary">
              {confidenceExplanation(explanation)}
            </p>
            <InterpretationBadges explanation={explanation} />
          </div>

          {explanation.summary ? (
            <div className="mt-4">
              <SectionLabel>Explanation</SectionLabel>
              <p className="text-sm leading-relaxed text-text-secondary">{explanation.summary}</p>
            </div>
          ) : null}

          {explanation.assumptions.length ? (
            <div className="mt-4">
              <SectionLabel>Assumptions</SectionLabel>
              <ul className="space-y-1 text-xs text-text-secondary">
                {explanation.assumptions.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-border-default" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {explanation.tables_used.length ? (
            <div className="mt-4">
              <SectionLabel>Tables used</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {explanation.tables_used.map((t) => (
                  <Badge key={t} variant="accent">
                    <Table2 className="h-3 w-3" aria-hidden />
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {explanation.joins.length ? (
            <div className="mt-4">
              <SectionLabel>Relationships</SectionLabel>
              <ul className="space-y-1.5">
                {explanation.joins.map((join, i) => (
                  <li key={`${join.from_column}-${join.to_column}-${i}`} className="flex items-start gap-2 text-xs text-text-secondary">
                    <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                    <span>
                      <span className="font-mono">{join.from_column}</span>
                      <span className="mx-1 text-text-muted">→</span>
                      <span className="font-mono">{join.to_column}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {extractColumnsFromSql(sql, explanation.tables_used).length ? (
            <div className="mt-4">
              <SectionLabel>Columns referenced</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {extractColumnsFromSql(sql, explanation.tables_used)
                  .slice(0, 12)
                  .map((c) => (
                    <Badge key={c} variant="default">
                      {c}
                    </Badge>
                  ))}
              </div>
            </div>
          ) : null}

          {explanation.warnings.length ? (
            <Alert variant="warning" title="Warnings" className="mt-4">
              <ul className="list-inside list-disc space-y-1">
                {explanation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {correlationId ? (
            <p className="mt-4 truncate text-[10px] text-text-muted" title={correlationId}>
              ID {correlationId.slice(0, 8)}…
            </p>
          ) : null}
        </>
      ) : !running && !error ? (
        <p className="mt-3 text-xs text-text-muted">
          Run a query to see validation steps and a confidence score.
        </p>
      ) : null}
    </aside>
  );
});

function ConfidenceCard({ explanation }: { explanation: QueryExplanation }) {
  const label =
    explanation.confidence >= 71 ? "High" : explanation.confidence >= 41 ? "Medium" : "Low";
  const tone =
    explanation.confidence >= 71
      ? "border-success/30 bg-[var(--color-success-muted)]/40"
      : explanation.confidence >= 41
        ? "border-warning/30 bg-[var(--color-warning-muted)]/40"
        : "border-danger/30 bg-[var(--color-danger-muted)]/40";

  return (
    <div className={cn("mt-4 flex items-center gap-4 rounded-[var(--radius-md)] border px-3 py-3 animate-reveal", tone)}>
      <ConfidenceRing value={explanation.confidence} size={72} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{label} confidence</p>
        <p className="mt-0.5 text-xs text-text-secondary">
          {explanation.grounded ? "Schema grounded." : "Review warnings before trusting."}
        </p>
        {explanation.warnings.length ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-warning">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {explanation.warnings.length} warning{explanation.warnings.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function VerificationPipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <ol className="trust-pipeline">
      {steps.map((step, index) => (
        <li key={step.id} className="trust-step">
          <div className="trust-step-rail">
            <StepIcon status={step.status} />
            {index < steps.length - 1 ? (
              <span className="trust-step-line" data-state={step.status} aria-hidden />
            ) : null}
          </div>
          <div className={cn("min-w-0", index < steps.length - 1 ? "pb-2" : "")}>
            <Tooltip content={step.tooltip}>
              <p
                className={cn(
                  "text-sm font-medium",
                  step.status === "fail"
                    ? "text-warning"
                    : step.status === "pass"
                      ? "text-text-primary"
                      : step.status === "running"
                        ? "text-accent"
                        : "text-text-muted",
                )}
              >
                {step.label}
                <span className="sr-only">
                  {step.status === "pass"
                    ? " — passed"
                    : step.status === "fail"
                      ? " — needs attention"
                      : step.status === "running"
                        ? " — in progress"
                        : " — waiting"}
                </span>
              </p>
            </Tooltip>
            {step.status !== "pending" ? (
              <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{step.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ status }: { status: PipelineStatus }) {
  const base =
    "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]";
  if (status === "pass") {
    return (
      <span className={cn(base, "border-success/40 bg-[var(--color-success-muted)] text-success")}>
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span className={cn(base, "border-warning/40 bg-[var(--color-warning-muted)] text-warning")}>
        <XCircle className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className={cn(base, "border-accent/40 bg-accent-muted text-accent")}>
        <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden />
      </span>
    );
  }
  return (
    <span className={cn(base, "border-border-subtle text-text-muted")}>
      <span className="h-1.5 w-1.5 rounded-full bg-border-default" aria-hidden />
    </span>
  );
}

function useVerificationSteps({
  explanation,
  error,
  sql,
  running,
}: {
  explanation: QueryExplanation | null;
  error?: string | null;
  sql?: string | null;
  running: boolean;
}): PipelineStep[] {
  const [runningIndex, setRunningIndex] = useState(0);

  useEffect(() => {
    if (!running || explanation) {
      setRunningIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setRunningIndex((i) => (i < 3 ? i + 1 : i));
    }, 700);
    return () => window.clearInterval(interval);
  }, [running, explanation]);

  return useMemo(() => {
    const idle: PipelineStep[] = [
      {
        id: "validate",
        label: "Query validation",
        detail: "Single SELECT only.",
        status: "pending",
        tooltip: "The SQL gate allows one dialect-specific SELECT. Stacked statements and mutations are rejected.",
      },
      {
        id: "schema",
        label: "Schema match",
        detail: "Tables and columns verified.",
        status: "pending",
        tooltip: "Grounding checks every table and column against the synced schema cache.",
      },
      {
        id: "relationships",
        label: "Relationships",
        detail: "Joins checked against keys.",
        status: "pending",
        tooltip: "Join paths are compared with foreign keys discovered during schema sync.",
      },
      {
        id: "readonly",
        label: "Read-only",
        detail: "SELECT-only execution.",
        status: "pending",
        tooltip: "Read-only is enforced in the SQL gate and by using a read-only database account.",
      },
    ];

    if (running && !explanation) {
      return idle.map((step, index) => ({
        ...step,
        status: index < runningIndex ? "pass" : index === runningIndex ? "running" : "pending",
        detail:
          index < runningIndex
            ? "Checked"
            : index === runningIndex
              ? "In progress…"
              : step.detail,
      }));
    }

    if (error && !explanation) {
      return idle.map((step, index) =>
        index === 0
          ? {
              ...step,
              status: "fail" as const,
              detail: "Could not validate or execute this statement.",
            }
          : { ...step, status: "pending" as const },
      );
    }

    if (!explanation) return idle;

    const unknown =
      explanation.unknown_tables.length + explanation.unknown_columns.length;
    const columns = extractColumnsFromSql(sql, explanation.tables_used);
    const relationshipsOk = unknown === 0;

    return [
      {
        id: "validate",
        label: "Query validated",
        detail: sql?.trim() ? "Single read-only SELECT." : "Passed SQL gate.",
        status: "pass",
        tooltip: "The SQL gate allows one dialect-specific SELECT. Stacked statements and mutations are rejected.",
      },
      {
        id: "schema",
        label: explanation.grounded ? "Schema matched" : "Schema mismatch",
        detail: explanation.grounded
          ? `${explanation.tables_used.length || columns.length || "Known"} table${explanation.tables_used.length === 1 ? "" : "s"} matched.`
          : unknown
            ? `Unknown: ${[...explanation.unknown_tables, ...explanation.unknown_columns].slice(0, 3).join(", ")}`
            : "Unmatched identifiers.",
        status: explanation.grounded ? "pass" : "fail",
        tooltip: "Grounding checks every table and column against the synced schema cache.",
      },
      {
        id: "relationships",
        label: relationshipsOk ? "Relationships verified" : "Relationship gaps",
        detail: explanation.joins.length
          ? `${explanation.joins.length} join${explanation.joins.length === 1 ? "" : "s"} verified.`
          : relationshipsOk
            ? "Single-table query."
            : "Relationship check incomplete.",
        status: relationshipsOk ? "pass" : "fail",
        tooltip: "Join paths are compared with foreign keys discovered during schema sync.",
      },
      {
        id: "readonly",
        label: "Read-only",
        detail: "SELECT-only · writes blocked.",
        status: "pass",
        tooltip: "Read-only is enforced in the SQL gate and by using a read-only database account.",
      },
    ];
  }, [explanation, error, sql, running, runningIndex]);
}

function confidenceExplanation(explanation: QueryExplanation): string {
  const parts: string[] = [];
  parts.push(explanation.grounded ? "Schema matched" : "Schema gaps");
  if (explanation.metric_label) {
    parts.push(`used metric “${explanation.metric_label}”`);
  } else if (explanation.resolution_source) {
    parts.push(resolutionSourceLabel(explanation.resolution_source).toLowerCase());
  } else if (explanation.routing_decision) {
    parts.push(routingDecisionLabel(explanation.routing_decision).toLowerCase());
  }
  if (explanation.validation_passed === true) {
    parts.push("validated before running");
  } else if (explanation.validation_passed === false) {
    parts.push("some validation checks did not pass");
  }
  if (explanation.joins.length) {
    parts.push(`${explanation.joins.length} join${explanation.joins.length === 1 ? "" : "s"} verified`);
  }
  if (explanation.warnings.length) {
    parts.push(`${explanation.warnings.length} warning${explanation.warnings.length === 1 ? "" : "s"}`);
  }
  return `${parts.join(" · ")}.`;
}

function InterpretationBadges({ explanation }: { explanation: QueryExplanation }) {
  const sourceLabel = explanation.metric_label
    ? `Metric: ${explanation.metric_label}`
    : explanation.resolution_source
      ? resolutionSourceLabel(explanation.resolution_source)
      : explanation.routing_decision
        ? routingDecisionLabel(explanation.routing_decision)
        : null;

  if (!sourceLabel && explanation.validation_passed == null) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {sourceLabel ? <Badge variant="accent">{sourceLabel}</Badge> : null}
      {explanation.validation_passed === true ? (
        <Badge variant="success">Validated</Badge>
      ) : explanation.validation_passed === false ? (
        <Badge variant="warning">Needs review</Badge>
      ) : null}
    </div>
  );
}

function PanelHeader({ onCollapse }: { onCollapse?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <ShieldCheck className="icon-md text-accent" strokeWidth={2} aria-hidden />
        <h2 className="type-meta">Query Trust</h2>
      </div>
      {onCollapse ? (
        <button
          type="button"
          onClick={onCollapse}
          className="workbench-panel-toggle hidden xl:inline-flex"
          aria-label="Collapse query trust panel"
          title="Collapse query trust panel"
        >
          <ChevronsRight className="icon-sm" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">{children}</p>
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

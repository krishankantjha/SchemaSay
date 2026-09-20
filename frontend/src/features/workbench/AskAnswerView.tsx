import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import type { InsightResponse, QueryResponse } from "@/lib/api/types";
import {
  classifyAnswer,
  shouldShowDataByDefault,
} from "@/features/workbench/answerTypes";
import {
  buildSimpleAnswer,
  buildSimpleInterpretation,
  isScalarResult,
} from "@/features/workbench/buildSimpleAnswer";
import { buildColumnLabelMap } from "@/features/workbench/friendlyColumnLabels";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable } from "@/features/workbench/DataTable";
import { FeedbackBar } from "@/features/workbench/FeedbackBar";
import { InsightPanel } from "@/features/workbench/InsightPanel";
import { QueryProgressSteps } from "@/features/workbench/QueryProgressSteps";
import { ResultsLoadingSkeleton } from "@/features/workbench/ResultsLoadingSkeleton";
import { SqlBlock } from "@/features/workbench/SqlBlock";

const ChartPanel = lazy(() =>
  import("@/features/workbench/ChartPanel").then((m) => ({ default: m.ChartPanel })),
);

type AskAnswerViewProps = {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  onDismissError?: () => void;
  onClear?: () => void;
  onCancel?: () => void;
  lastQuestion: string;
  result: QueryResponse | null;
  insight: InsightResponse | null;
  insightLoading: boolean;
  insightError: string | null;
  onRetryInsight?: () => void;
  onRequestInsight?: () => void;
  insightRequested?: boolean;
  connectionId?: number | null;
  onRefineQuestion?: (nextQuestion: string) => void;
  onShowTrustDetails?: () => void;
};

export function AskAnswerView({
  loading,
  error,
  onRetry,
  onDismissError,
  onClear,
  onCancel,
  lastQuestion,
  result,
  insight,
  insightLoading,
  insightError,
  onRetryInsight,
  onRequestInsight,
  insightRequested = false,
  connectionId,
  onRefineQuestion,
  onShowTrustDetails,
}: AskAnswerViewProps) {
  const [dataOpen, setDataOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const rows = result?.results ?? [];
  const succeeded = Boolean(result?.success);
  const hasSql = Boolean(result?.sql);
  const answerType = classifyAnswer(rows);
  const showDataByDefault = shouldShowDataByDefault(rows);
  const showData = showDataByDefault || dataOpen;

  const heroAnswer = useMemo(
    () => (lastQuestion ? buildSimpleAnswer(lastQuestion, rows, result?.explanation) : null),
    [lastQuestion, rows, result?.explanation],
  );

  const columnLabels = useMemo(
    () => (rows.length ? buildColumnLabelMap(Object.keys(rows[0]), lastQuestion) : undefined),
    [rows, lastQuestion],
  );

  useEffect(() => {
    setDataOpen(false);
    setDetailsOpen(false);
  }, [result]);

  if (loading) {
    return (
      <div className="ask-answer-view mx-auto w-full max-w-3xl animate-reveal">
        <QuestionHeader question={lastQuestion} onClear={onClear} />
        <QueryProgressSteps active />
        {onCancel ? (
          <div className="mb-3 flex justify-end">
            <Button size="sm" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        ) : null}
        <ResultsLoadingSkeleton />
      </div>
    );
  }

  if (error && !succeeded) {
    return (
      <div className="ask-answer-view mx-auto w-full max-w-3xl animate-reveal space-y-4">
        <QuestionHeader question={lastQuestion} onClear={onClear} />
        <Alert variant="danger" title="Couldn't answer that">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm leading-relaxed">{error}</p>
            <div className="flex shrink-0 flex-wrap gap-2">
              {onRetry ? (
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  <RotateCcw className="icon-sm" strokeWidth={2} aria-hidden />
                  Try again
                </Button>
              ) : null}
              {onDismissError ? (
                <Button size="sm" variant="ghost" onClick={onDismissError}>
                  Start over
                </Button>
              ) : null}
            </div>
          </div>
        </Alert>
        {hasSql && result?.sql ? <SqlBlock sql={result.sql} defaultCollapsed disclosure /> : null}
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="ask-answer-view mx-auto w-full max-w-3xl animate-reveal space-y-5 pb-2">
      <QuestionHeader question={lastQuestion} onClear={onClear} />

      {heroAnswer ? (
        <p className="text-2xl font-semibold leading-snug tracking-tight text-text-primary sm:text-3xl">
          {heroAnswer}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
        {answerType === "scalar" && rows.length && !dataOpen ? (
          <ActionLink onClick={() => setDataOpen(true)}>Show data</ActionLink>
        ) : null}
        {answerType === "scalar" && dataOpen ? (
          <ActionLink onClick={() => setDataOpen(false)}>Hide data</ActionLink>
        ) : null}
        {hasSql && result.sql ? (
          <>
            {answerType === "scalar" ? <ActionDivider /> : null}
            <SqlBlock sql={result.sql} defaultCollapsed disclosure />
          </>
        ) : null}
        {onShowTrustDetails ? (
          <>
            <ActionDivider />
            <ActionLink onClick={onShowTrustDetails}>Validation details</ActionLink>
          </>
        ) : null}
        {!detailsOpen ? (
          <>
            <ActionDivider />
            <ActionLink onClick={() => setDetailsOpen(true)}>How we got this</ActionLink>
          </>
        ) : null}
      </div>

      {detailsOpen ? (
        <div className="text-sm leading-relaxed text-text-secondary animate-reveal">
          <p>{buildSimpleInterpretation(result.explanation)}</p>
          <button
            type="button"
            onClick={() => setDetailsOpen(false)}
            className="mt-2 text-xs font-medium text-text-muted hover:text-text-primary"
          >
            Hide
          </button>
        </div>
      ) : null}

      {showData && rows.length ? (
        <section className="space-y-4 animate-reveal">
          {isScalarResult(rows) ? (
            <ScalarDetail rows={rows} columnLabels={columnLabels} />
          ) : (
            <>
              {answerType !== "scalar" && result.chart_config ? (
                <Suspense
                  fallback={
                    <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface p-4">
                      <Skeleton className="mb-3 h-4 w-32" />
                      <Skeleton className="h-[220px] w-full" />
                    </div>
                  }
                >
                  <ChartPanel config={result.chart_config} rows={rows} question={lastQuestion} />
                </Suspense>
              ) : null}
              <DataTable
                rows={rows}
                columnLabels={columnLabels}
                caption="Results"
                minimal={answerType === "small_table"}
              />
            </>
          )}
        </section>
      ) : null}

      {succeeded && !rows.length ? (
        <EmptyState
          title="No matching data"
          description="The question ran successfully but nothing matched. Try broadening your filters or rephrasing."
          compact
          action={
            onRetry ? (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {succeeded && rows.length && onRequestInsight ? (
        <InsightPanel
          insight={insight}
          isLoading={insightLoading}
          error={insightError}
          rows={rows}
          onRetry={onRetryInsight}
          optIn
          requested={insightRequested}
          onRequest={onRequestInsight}
          canRequest={Boolean(onRequestInsight)}
        />
      ) : null}

      {succeeded && result.sql && lastQuestion && connectionId ? (
        <FeedbackBar
          key={`${lastQuestion}-${result.correlation_id ?? "local"}`}
          connectionId={connectionId}
          question={lastQuestion}
          generatedSql={result.sql}
          correlationId={result.correlation_id}
          explanation={result.explanation}
          rowCount={rows.length}
          columns={rows.length ? Object.keys(rows[0]) : []}
          onRefineQuestion={onRefineQuestion}
          simpleView
          inline
        />
      ) : null}
    </div>
  );
}

function QuestionHeader({
  question,
  onClear,
}: {
  question: string;
  onClear?: () => void;
}) {
  if (!question) return null;
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="min-w-0 text-sm leading-relaxed text-text-secondary">{question}</p>
      {onClear ? (
        <Button size="sm" variant="ghost" className="shrink-0" onClick={onClear}>
          New question
        </Button>
      ) : null}
    </div>
  );
}

function ActionLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-medium text-accent transition-colors hover:text-accent-hover"
    >
      {children}
    </button>
  );
}

function ActionDivider() {
  return <span className="text-text-muted/40" aria-hidden>·</span>;
}

function ScalarDetail({
  rows,
  columnLabels,
}: {
  rows: Record<string, unknown>[];
  columnLabels?: Record<string, string>;
}) {
  const column = Object.keys(rows[0])[0];
  const label = columnLabels?.[column] ?? column.replace(/_/g, " ");
  const value = rows[0][column];

  return (
    <dl className="flex items-baseline justify-between gap-4 rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated/30 px-4 py-3">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums text-text-primary">
        {formatScalarValue(value)}
      </dd>
    </dl>
  );
}

function formatScalarValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

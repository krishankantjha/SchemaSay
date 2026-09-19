import { lazy, Suspense, useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, MessageSquare, RotateCcw, Rows3 } from "lucide-react";
import type { InsightResponse, QueryResponse } from "@/lib/api/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tooltip } from "@/components/ui/Tooltip";
import { Skeleton } from "@/components/ui/Skeleton";

const ChartPanel = lazy(() =>
  import("@/features/workbench/ChartPanel").then((m) => ({ default: m.ChartPanel })),
);
import { DataTable } from "@/features/workbench/DataTable";
import { FeedbackBar } from "@/features/workbench/FeedbackBar";
import { InsightPanel } from "@/features/workbench/InsightPanel";
import { QueryProgressSteps } from "@/features/workbench/QueryProgressSteps";
import { ResultsLoadingSkeleton } from "@/features/workbench/ResultsLoadingSkeleton";
import { SqlBlock } from "@/features/workbench/SqlBlock";
import { SqlProgressSteps } from "@/features/workbench/SqlProgressSteps";
import { isQuerySaved, toggleSavedQuery } from "@/lib/saved-queries";
import { useToast } from "@/app/ToastContext";

type ResultsWorkspaceProps = {
  loading: boolean;
  progress?: "ask" | "sql";
  error: string | null;
  onRetry?: () => void;
  onDismissError?: () => void;
  onClear?: () => void;
  lastQuestion?: string;
  result: QueryResponse | null;
  insight: InsightResponse | null;
  insightLoading: boolean;
  insightError: string | null;
  onRetryInsight?: () => void;
  connectionId?: number | null;
  showFeedback?: boolean;
  hideSql?: boolean;
  onRefineQuestion?: (nextQuestion: string) => void;
};

export function ResultsWorkspace({
  loading,
  progress = "ask",
  error,
  onRetry,
  onDismissError,
  onClear,
  lastQuestion,
  result,
  insight,
  insightLoading,
  insightError,
  onRetryInsight,
  connectionId,
  showFeedback = true,
  hideSql = false,
  onRefineQuestion,
}: ResultsWorkspaceProps) {
  const [highlightColumn, setHighlightColumn] = useState<string | null>(null);
  const rows = result?.results ?? [];
  const hasSql = Boolean(result?.sql);
  const succeeded = Boolean(result?.success);

  useEffect(() => {
    setHighlightColumn(null);
  }, [result]);

  if (loading) {
    return (
      <div className="animate-reveal">
        {lastQuestion ? <QuestionChip question={lastQuestion} /> : null}
        {progress === "sql" ? <SqlProgressSteps active /> : <QueryProgressSteps active />}
        <ResultsLoadingSkeleton />
      </div>
    );
  }

  if (error && !succeeded) {
    return (
      <div className="animate-reveal space-y-4">
        {lastQuestion ? <QuestionChip question={lastQuestion} /> : null}
        <Alert variant="danger" title="Query failed">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm leading-relaxed">{error}</p>
            <div className="flex shrink-0 flex-wrap gap-2">
              {onRetry ? (
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  <RotateCcw className="icon-sm" strokeWidth={2} aria-hidden />
                  Retry
                </Button>
              ) : null}
              {onDismissError ? (
                <Button size="sm" variant="ghost" onClick={onDismissError}>
                  Dismiss
                </Button>
              ) : null}
            </div>
          </div>
        </Alert>
        {hasSql && result?.sql && !hideSql ? <SqlBlock sql={result.sql} /> : null}
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="animate-reveal space-y-5 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {lastQuestion ? <QuestionChip question={lastQuestion} /> : null}
          <p className="mt-2 text-xs text-text-muted">
            {rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"}
            {result.execution_duration_ms != null
              ? ` · ${result.execution_duration_ms.toFixed(0)}ms`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {onClear ? (
            <Button size="sm" variant="ghost" onClick={onClear}>
              New question
            </Button>
          ) : null}
          {!showFeedback && result.sql ? (
            <SaveResultButton
              type={lastQuestion ? "question" : "sql"}
              payload={lastQuestion || result.sql}
              connectionId={connectionId}
            />
          ) : null}
        </div>
      </div>

      <InsightPanel
        insight={insight}
        isLoading={insightLoading}
        error={insightError}
        rows={rows}
        onRetry={onRetryInsight}
        onHighlightColumn={setHighlightColumn}
      />

      {hasSql && result.sql && !hideSql ? (
        <SqlBlock sql={result.sql} defaultCollapsed={rows.length > 0} />
      ) : null}

      {rows.length ? (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle pb-2">
            <h3 className="type-heading">Results</h3>
            <p className="type-meta normal-case tracking-normal">
              <Rows3 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              {rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"}
              {result.execution_duration_ms != null
                ? ` · ${result.execution_duration_ms.toFixed(0)}ms`
                : ""}
            </p>
          </div>
          <div className="space-y-4">
            <Suspense
              fallback={
                <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface p-4">
                  <Skeleton className="mb-3 h-4 w-32" />
                  <Skeleton className="h-[260px] w-full" />
                </div>
              }
            >
              <ChartPanel config={result.chart_config} rows={rows} question={lastQuestion} />
            </Suspense>
            <DataTable rows={rows} highlightColumn={highlightColumn} />
          </div>
        </section>
      ) : succeeded ? (
        <EmptyState
          title="Query completed — no rows"
          description="The statement ran successfully but returned an empty result set. Try broadening filters or asking a different question."
          compact
          action={
            onRetry ? (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                <RotateCcw className="icon-sm" strokeWidth={2} aria-hidden />
                Run again
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {showFeedback && succeeded && result.sql && lastQuestion && connectionId ? (
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
        />
      ) : null}
    </div>
  );
}

function QuestionChip({ question }: { question: string }) {
  return (
    <div className="flex items-start gap-2">
      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
      <p className="text-sm leading-relaxed text-text-primary">{question}</p>
    </div>
  );
}

function SaveResultButton({
  type,
  payload,
  connectionId,
}: {
  type: "question" | "sql";
  payload: string;
  connectionId?: number | null;
}) {
  const { push: toast } = useToast();
  const [saved, setSaved] = useState(() => isQuerySaved(type, payload));

  useEffect(() => {
    setSaved(isQuerySaved(type, payload));
  }, [type, payload]);

  function handleSave() {
    const label = payload.trim().split("\n")[0] ?? payload;
    const nowSaved = toggleSavedQuery({
      type,
      label: label.length > 48 ? `${label.slice(0, 48)}…` : label,
      payload,
      connectionId: connectionId ?? undefined,
    });
    setSaved(nowSaved);
    toast(nowSaved ? "Query saved" : "Removed from saved", "success");
  }

  return (
    <Tooltip content={saved ? "Remove from saved queries" : "Save this query"}>
      <Button size="sm" variant="ghost" onClick={handleSave} aria-pressed={saved}>
        {saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
        {saved ? "Saved" : "Save"}
      </Button>
    </Tooltip>
  );
}

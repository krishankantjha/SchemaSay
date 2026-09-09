import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, RefreshCw, Send, Sparkles } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { assistantApi, schemaApi } from "@/lib/api/endpoints";
import type { QueryResponse } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import { markAskStepComplete } from "@/lib/onboarding";
import { humanizeApiError } from "@/lib/utils";
import { useToast } from "@/app/ToastContext";
import { SchemaTreeSidebar } from "@/features/workbench/SchemaTreeSidebar";
import { SqlBlock } from "@/features/workbench/SqlBlock";
import { DataTable } from "@/features/workbench/DataTable";
import { ChartPanel } from "@/features/workbench/ChartPanel";
import { QueryTrustPanel } from "@/features/workbench/QueryTrustPanel";
import { FeedbackBar } from "@/features/workbench/FeedbackBar";
import { InsightPanel } from "@/features/workbench/InsightPanel";
import { useInsightGeneration } from "@/features/workbench/useInsightGeneration";
import { Button } from "@/components/ui/Button";

const EXAMPLE_QUESTIONS = [
  "Revenue by quarter",
  "Top customers by order value",
  "Orders declining month over month",
  "Duplicate records in the dataset",
];

export function AskPage() {
  const queryClient = useQueryClient();
  const { push: toast } = useToast();
  const { activeConnection, activeConnectionId } = useConnection();
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const insightMutation = useInsightGeneration();

  const {
    data: schemaTree,
    isLoading: schemaLoading,
    isError: schemaLoadFailed,
  } = useQuery({
    queryKey: ["schema-tree", activeConnectionId],
    queryFn: () => schemaApi.tree(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  const askMutation = useMutation({
    mutationFn: (q: string) => assistantApi.query(activeConnectionId!, q),
    onSuccess: (data, q) => {
      setResult(data);
      setLastQuestion(q);
      setError(data.success ? null : data.error ?? "Query failed");
      insightMutation.reset();
      if (data.success) {
        markAskStepComplete();
        toast("Query completed", "success");
        if (data.results?.length && data.sql) {
          insightMutation.mutate({ question: q, sql: data.sql, rows: data.results });
        }
      }
    },
    onError: (err) => {
      setResult(null);
      insightMutation.reset();
      setError(err instanceof ApiError ? err.detail : "Request failed");
      toast("Query failed", "error");
    },
  });

  async function handleSync(profile: boolean) {
    if (!activeConnectionId) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      await schemaApi.sync(activeConnectionId, profile);
      await queryClient.invalidateQueries({ queryKey: ["schema-tree", activeConnectionId] });
      toast("Schema synced — tables are ready to explore", "success");
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "Sync failed";
      setSyncError(humanizeApiError(detail, "sync"));
      toast("Sync failed", "error");
    } finally {
      setIsSyncing(false);
    }
  }

  function runQuery(q: string) {
    if (!activeConnectionId || !q.trim()) return;
    setError(null);
    insightMutation.reset();
    askMutation.mutate(q.trim());
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runQuery(question);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runQuery(question);
    }
  }

  if (!activeConnectionId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border-subtle bg-bg-surface">
          <Database className="h-6 w-6 text-accent" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-text-primary">Connect a database to start</h1>
        <p className="mt-2 max-w-md text-sm text-text-secondary">
          Add a SQLite file, server database, or spreadsheet — then sync schema and ask in plain
          English.
        </p>
        <Link to="/connections?welcome=1" className="mt-4">
          <Button>Set up your first connection</Button>
        </Link>
      </div>
    );
  }

  if (!schemaLoading && schemaTree && schemaTree.tables.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <RefreshCw className="h-8 w-8 text-accent" />
        <h1 className="mt-4 text-lg font-semibold text-text-primary">Your schema isn&apos;t synced yet</h1>
        <p className="mt-2 max-w-md text-sm text-text-secondary">
          {activeConnection?.name} is connected. Sync to load tables before asking questions.
        </p>
        <div className="mt-4 flex gap-2">
          <Button disabled={isSyncing} onClick={() => void handleSync(false)}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync schema
          </Button>
          <Link to="/connections">
            <Button variant="secondary">Connections</Button>
          </Link>
        </div>
      </div>
    );
  }

  const rows = result?.results ?? [];
  const showChart = result?.chart_config?.chart_type !== "table";
  const showEmpty = !result && !askMutation.isPending && !error;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border-y border-border-subtle bg-bg-surface sm:mx-6 sm:rounded-xl sm:border">
      <div className="hidden w-56 shrink-0 lg:block xl:w-60">
        <SchemaTreeSidebar
          tables={schemaTree?.tables ?? []}
          isLoading={schemaLoading}
          loadFailed={schemaLoadFailed}
          syncError={syncError}
          onSync={(profile) => void handleSync(profile)}
          isSyncing={isSyncing}
          connectionName={activeConnection?.name}
          onInsertColumn={(ref) => setQuestion((q) => (q ? `${q} ${ref}` : ref))}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5">
        <p className="mb-3 text-xs text-text-muted">
          Connected to <span className="font-medium text-text-secondary">{activeConnection?.name}</span>
          {schemaTree?.tables.length
            ? ` · ${schemaTree.tables.length} table${schemaTree.tables.length === 1 ? "" : "s"} loaded`
            : " · schema not loaded yet — use Sync in the sidebar"}
        </p>

        {showEmpty ? (
          <div className="mb-4">
            <h2 className="text-base font-semibold text-text-primary">Ask anything about your data</h2>
            <p className="mt-0.5 text-sm text-text-secondary">
              Schema-aware answers with SQL, validation, and results.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setQuestion(ex);
                    runQuery(ex);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1.5 text-xs text-text-secondary hover:border-accent/40 hover:bg-accent-muted hover:text-accent"
                >
                  <Sparkles className="h-3 w-3" />
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mb-4 shrink-0">
          <div className="relative rounded-xl border border-border-default bg-bg-elevated/50 focus-within:border-border-focus focus-within:ring-2 focus-within:ring-accent/15">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={showEmpty ? 3 : 2}
              placeholder="Ask anything about your data…"
              aria-label="Question"
              className="w-full resize-none rounded-xl bg-transparent px-4 py-3.5 pb-12 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <Button
              type="submit"
              size="sm"
              className="absolute bottom-2.5 right-2.5"
              disabled={askMutation.isPending || !question.trim()}
            >
              {askMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Ask
                </>
              )}
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-text-muted">Enter to run · Shift+Enter for new line</p>
        </form>

        {askMutation.isPending ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            Answer → SQL → Validation → Results…
          </div>
        ) : null}

        {error && !result?.success ? (
          <div className="mb-4 rounded-lg border border-danger/30 bg-[var(--color-danger-muted)] p-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {result?.sql ? (
          <div className="mb-4">
            <SqlBlock sql={result.sql} />
          </div>
        ) : null}

        {rows.length ? (
          <div className="mb-4 space-y-4">
            <DataTable rows={rows} />
            <InsightPanel
              insight={insightMutation.data ?? null}
              isLoading={insightMutation.isPending}
              error={
                insightMutation.data && !insightMutation.data.success
                  ? insightMutation.data.error
                  : null
              }
            />
            {showChart && result?.chart_config ? (
              <ChartPanel config={result.chart_config} rows={rows} />
            ) : null}
            {result?.execution_duration_ms != null ? (
              <p className="text-xs text-text-muted">
                {rows.length} rows · {result.execution_duration_ms.toFixed(0)}ms
              </p>
            ) : null}
          </div>
        ) : null}

        {result?.success && result.sql && lastQuestion ? (
          <FeedbackBar
            connectionId={activeConnectionId}
            question={lastQuestion}
            generatedSql={result.sql}
          />
        ) : null}
      </div>

      <div className="hidden w-72 shrink-0 xl:block">
        <QueryTrustPanel
          explanation={result?.explanation ?? null}
          correlationId={result?.correlation_id}
          error={error}
          sql={result?.sql}
        />
      </div>
    </div>
  );
}

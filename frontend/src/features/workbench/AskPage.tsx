import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { assistantApi, schemaApi } from "@/lib/api/endpoints";
import type { QueryResponse } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import { markAskStepComplete } from "@/lib/onboarding";
import { addRecentAction } from "@/lib/recent-actions";
import { humanizeApiError } from "@/lib/utils";
import { AskComposer } from "@/features/workbench/AskComposer";
import { AskEmptyHero } from "@/features/workbench/AskEmptyHero";
import { WorkbenchLayout } from "@/components/workbench/WorkbenchLayout";
import { useToast } from "@/app/ToastContext";
import { ResultsWorkspace } from "@/features/workbench/ResultsWorkspace";
import { useInsightGeneration } from "@/features/workbench/useInsightGeneration";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

export function AskPage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { push: toast } = useToast();
  const { activeConnection, activeConnectionId } = useConnection();
  const initialQuestion = (location.state as { question?: string } | null)?.question ?? "";
  const [question, setQuestion] = useState(initialQuestion);
  const [lastQuestion, setLastQuestion] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncSuccessAt, setSyncSuccessAt] = useState<number | null>(null);

  const insightMutation = useInsightGeneration();

  useEffect(() => {
    const q = (location.state as { question?: string } | null)?.question;
    if (q) setQuestion(q);
  }, [location.state]);

  const {
    data: schemaTree,
    isLoading: schemaLoading,
    isError: schemaLoadFailed,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["schema-tree", activeConnectionId],
    queryFn: () => schemaApi.tree(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  useEffect(() => {
    if (schemaTree?.tables.length && dataUpdatedAt) {
      setLastSyncedAt((prev) => prev ?? dataUpdatedAt);
    }
  }, [schemaTree, dataUpdatedAt]);

  const askMutation = useMutation({
    mutationFn: (q: string) => assistantApi.query(activeConnectionId!, q),
    onSuccess: (data, q) => {
      setResult(data);
      setLastQuestion(q);
      setError(data.success ? null : data.error ?? "Query failed");
      insightMutation.reset();
      if (data.success) {
        markAskStepComplete();
        addRecentAction({
          type: "question",
          label: q.length > 48 ? `${q.slice(0, 48)}…` : q,
          payload: q,
          connectionId: activeConnectionId ?? undefined,
        });
        toast("Query completed", "success");
        if (data.results?.length && data.sql) {
          insightMutation.mutate({ question: q, sql: data.sql, rows: data.results });
        }
      } else {
        toast(data.error ?? "Query failed", "error");
      }
    },
    onError: (err) => {
      setResult(null);
      insightMutation.reset();
      setError(
        err instanceof ApiError ? humanizeApiError(err.detail, "query") : "Request failed",
      );
      toast("Query failed", "error");
    },
  });

  async function handleSync(profile: boolean) {
    if (!activeConnectionId) return;
    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccessAt(null);
    try {
      await schemaApi.sync(activeConnectionId, profile);
      await queryClient.invalidateQueries({ queryKey: ["schema-tree", activeConnectionId] });
      const now = Date.now();
      setLastSyncedAt(now);
      setSyncSuccessAt(now);
      toast("Schema synced — tables are ready to explore", "success");
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "Sync failed";
      setSyncError(humanizeApiError(detail, "sync"));
      toast("Sync failed", "error");
    } finally {
      setIsSyncing(false);
    }
  }

  function insertContext(ref: string) {
    setQuestion((q) => {
      const trimmed = q.trim();
      if (!trimmed) return ref;
      if (trimmed.endsWith(" ") || trimmed.endsWith(",")) return `${trimmed}${ref}`;
      return `${trimmed} ${ref}`;
    });
  }

  function runQuery(q: string) {
    if (!activeConnectionId || !q.trim() || askMutation.isPending) return;
    setError(null);
    setResult(null);
    insightMutation.reset();
    askMutation.mutate(q.trim());
  }

  function clearWorkspace() {
    setError(null);
    setResult(null);
    setLastQuestion("");
    insightMutation.reset();
  }

  if (!activeConnectionId) {
    return (
      <EmptyState
        icon={Database}
        title="Connect a database to start"
        description="Add a SQLite file, server database, or spreadsheet — then sync schema and ask in plain English."
        action={
          <Link to="/connections?welcome=1" className="no-underline">
            <Button>Set up your first connection</Button>
          </Link>
        }
      />
    );
  }

  if (!schemaLoading && schemaTree && schemaTree.tables.length === 0) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="Your schema isn't synced yet"
        description={`${activeConnection?.name ?? "Your connection"} is connected. Sync to load tables before asking questions.`}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button loading={isSyncing} onClick={() => void handleSync(false)}>
              <RefreshCw className="icon-sm" strokeWidth={2} aria-hidden />
              Sync schema
            </Button>
            <Link to="/connections" className="no-underline">
              <Button variant="secondary">Connections</Button>
            </Link>
          </div>
        }
      />
    );
  }

  const resultsMode = askMutation.isPending || Boolean(result) || Boolean(error);
  const insightError =
    insightMutation.data && !insightMutation.data.success ? insightMutation.data.error : null;

  return (
    <WorkbenchLayout
      schema={{
        tables: schemaTree?.tables ?? [],
        isLoading: schemaLoading,
        loadFailed: schemaLoadFailed,
        syncError,
        onSync: (profile) => void handleSync(profile),
        isSyncing,
        lastSyncedAt: lastSyncedAt ?? dataUpdatedAt,
        syncSuccessAt,
        connectionName: activeConnection?.name,
        onInsertColumn: insertContext,
        onInsertTable: insertContext,
      }}
      trust={{
        explanation: result?.explanation ?? null,
        correlationId: result?.correlation_id,
        error,
        sql: result?.sql,
        running: askMutation.isPending,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!resultsMode ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 touch-pan-y">
            <AskEmptyHero
              tableCount={schemaTree?.tables.length}
              onTryExample={(ex) => {
                setQuestion(ex);
                runQuery(ex);
              }}
              onSelectRecent={(q) => {
                setQuestion(q);
                runQuery(q);
              }}
            />
            <AskComposer
              className="mb-1"
              value={question}
              onChange={setQuestion}
              onSubmit={() => runQuery(question)}
              loading={askMutation.isPending}
              disabled={schemaLoading}
              expanded
            />
          </div>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 touch-pan-y">
              <ResultsWorkspace
                loading={askMutation.isPending}
                error={error}
                onRetry={lastQuestion ? () => runQuery(lastQuestion) : undefined}
                onDismissError={clearWorkspace}
                onClear={clearWorkspace}
                lastQuestion={lastQuestion || question}
                result={result}
                insight={insightMutation.data ?? null}
                insightLoading={insightMutation.isPending}
                insightError={insightError}
                onRetryInsight={
                  lastQuestion && result?.sql && result.results?.length
                    ? () =>
                        insightMutation.mutate({
                          question: lastQuestion,
                          sql: result.sql,
                          rows: result.results ?? [],
                        })
                    : undefined
                }
                connectionId={activeConnectionId}
                onRefineQuestion={(nextQuestion) => {
                  setQuestion(nextQuestion);
                  runQuery(nextQuestion);
                }}
              />
            </div>
            <div
              className={cn(
                "ask-composer-dock shrink-0 border-t border-border-subtle bg-bg-surface/95",
                "px-4 py-3 backdrop-blur-sm sm:px-6",
              )}
            >
              <AskComposer
                compact
                value={question}
                onChange={setQuestion}
                onSubmit={() => runQuery(question)}
                loading={askMutation.isPending}
                disabled={schemaLoading}
              />
            </div>
          </>
        )}
      </div>
    </WorkbenchLayout>
  );
}

import { useEffect, useState, type DragEvent, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, MessageSquare, Play, Wand2 } from "lucide-react";
import { addRecentAction } from "@/lib/recent-actions";
import { RecentQueries } from "@/features/workbench/RecentQueries";
import { SavedQueries } from "@/features/workbench/SavedQueries";
import { WorkbenchLayout } from "@/components/workbench/WorkbenchLayout";
import { ApiError } from "@/lib/api/client";
import { assistantApi, queryApi, schemaApi } from "@/lib/api/endpoints";
import type { QueryResponse } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import { ConnectionRequired } from "@/components/shared/ConnectionRequired";
import { SqlEditor } from "@/components/sql/SqlEditor";
import { ResultsWorkspace } from "@/features/workbench/ResultsWorkspace";
import { useInsightGeneration } from "@/features/workbench/useInsightGeneration";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ShortcutHint } from "@/components/ui/Kbd";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import { modKeyLabel } from "@/lib/keyboard";
import { useToast } from "@/app/ToastContext";

export function SqlPage() {
  return (
    <ConnectionRequired title="SQL editor needs a connection">
      <SqlPageContent />
    </ConnectionRequired>
  );
}

function SqlPageContent() {
  const location = useLocation();
  const initialSql = (location.state as { sql?: string } | null)?.sql ?? "SELECT 1";
  const queryClient = useQueryClient();
  const { push: toast } = useToast();
  const { activeConnectionId, activeConnection } = useConnection();
  const [sql, setSql] = useState(initialSql);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const insightMutation = useInsightGeneration();

  useEffect(() => {
    const next = (location.state as { sql?: string } | null)?.sql;
    if (next) setSql(next);
  }, [location.state]);

  const { data: schemaTree, isLoading: schemaLoading, isError: schemaLoadFailed } = useQuery({
    queryKey: ["schema-tree", activeConnectionId],
    queryFn: () => schemaApi.tree(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  const runMutation = useMutation({
    mutationFn: () => assistantApi.executeRaw(activeConnectionId!, sql),
    onSuccess: (data) => {
      setResult(data);
      setError(data.success ? null : data.error ?? "Execution failed");
      insightMutation.reset();
      if (data.success) {
        const label = sql.trim().split("\n")[0] ?? "SQL query";
        addRecentAction({
          type: "sql",
          label: label.length > 40 ? `${label.slice(0, 40)}…` : label,
          payload: sql,
          connectionId: activeConnectionId ?? undefined,
        });
        toast("Query completed", "success");
      } else {
        toast("Query failed", "error");
      }
      if (data.success && data.results?.length && data.sql) {
        insightMutation.mutate({
          question: "Summarize the business meaning of this SQL query result",
          sql: data.sql,
          rows: data.results,
        });
      }
    },
    onError: (err) => {
      setResult(null);
      insightMutation.reset();
      setError(err instanceof ApiError ? err.detail : "Request failed");
      toast("Query failed", "error");
    },
  });

  const formatMutation = useMutation({
    mutationFn: () => queryApi.format(sql),
    onSuccess: (data) => setSql(data.formatted_sql),
    onError: (err) => setError(err instanceof ApiError ? err.detail : "Format failed"),
  });

  async function handleSync(profile: boolean) {
    if (!activeConnectionId) return;
    setIsSyncing(true);
    try {
      await schemaApi.sync(activeConnectionId, profile);
      await queryClient.invalidateQueries({ queryKey: ["schema-tree", activeConnectionId] });
      toast("Schema synced — tables are ready to explore", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Sync failed");
      toast("Sync failed", "error");
    } finally {
      setIsSyncing(false);
    }
  }

  function handleRun() {
    setError(null);
    insightMutation.reset();
    runMutation.mutate();
  }

  function handleEditorKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleRun();
    }
  }

  function insertRef(ref: string) {
    setSql((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return ref;
      return `${trimmed}\n${ref}`;
    });
  }

  function handleDrop(e: DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    setDragOver(false);
    const text = e.dataTransfer.getData("text/plain");
    if (text) insertRef(text);
  }

  const hasResults = Boolean(result);
  const lineCount = sql.split("\n").length;
  const showEmpty = !hasResults && !runMutation.isPending && !error;
  const insightError =
    insightMutation.data && !insightMutation.data.success ? insightMutation.data.error : null;

  return (
    <WorkbenchLayout
      schema={{
        tables: schemaTree?.tables ?? [],
        isLoading: schemaLoading,
        loadFailed: schemaLoadFailed,
        onSync: (profile) => void handleSync(profile),
        isSyncing,
        connectionName: activeConnection?.name,
        onInsertColumn: insertRef,
        onInsertTable: insertRef,
      }}
      trust={{
        explanation: result?.explanation ?? null,
        correlationId: result?.correlation_id,
        error,
        sql: result?.sql ?? sql,
        running: runMutation.isPending,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 touch-pan-y">
          <PageHeader
            compact
            title="SQL Editor"
            description={`${activeConnection?.name ?? "Connection"} · write a governed SELECT, then inspect trust signals`}
            actions={
              <>
                <Tooltip content="Only a single SELECT is allowed">
                  <Badge variant="accent">
                    <Database className="h-3 w-3" aria-hidden />
                    Read only
                  </Badge>
                </Tooltip>
                <Button
                  onClick={handleRun}
                  disabled={runMutation.isPending || !sql.trim()}
                  loading={runMutation.isPending}
                  title={`${modKeyLabel()}+Enter to run`}
                >
                  <Play className="h-4 w-4" />
                  Run
                </Button>
                <ShortcutHint keys={[modKeyLabel(), "Enter"]} className="hidden sm:inline-flex" />
                <Button
                  variant="secondary"
                  onClick={() => formatMutation.mutate()}
                  disabled={formatMutation.isPending || !sql.trim()}
                  loading={formatMutation.isPending}
                >
                  <Wand2 className="h-4 w-4" />
                  Format
                </Button>
              </>
            }
          />

          <div
            className={cn(
              "rounded-xl transition-[box-shadow]",
              dragOver && "ring-2 ring-accent/20",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
          >
            <SqlEditor
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={handleEditorKeyDown}
              onDrop={handleDrop}
              lineCount={lineCount}
              placeholder="Write a read-only SELECT query…"
              toolbar={
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Workspace
                </span>
              }
            />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-muted">
            <ShortcutHint keys={["Tab"]} label="indent" />
            <span>Drag schema items from sidebar</span>
          </p>

          <div className="mt-4 space-y-4">
            {showEmpty ? (
              <>
                <SavedQueries
                  filter="sql"
                  className="mb-4"
                  onSelect={(q) => setSql(q)}
                />
                <RecentQueries
                  filter="sql"
                  className="mb-4"
                  onSelect={(q) => setSql(q)}
                />
                <EmptyState
                  title="Ready to run"
                  description="Write SQL or drag tables and columns from the schema sidebar, then click Run."
                  compact
                  action={
                    <Button onClick={handleRun} disabled={!sql.trim()}>
                      <Play className="h-4 w-4" />
                      Run query
                    </Button>
                  }
                  secondaryAction={
                    <Link to="/ask" className="no-underline">
                      <Button variant="secondary">
                        <MessageSquare className="h-4 w-4" />
                        Ask instead
                      </Button>
                    </Link>
                  }
                />
              </>
            ) : (
              <ResultsWorkspace
                loading={runMutation.isPending}
                progress="sql"
                error={error}
                onRetry={handleRun}
                onDismissError={() => {
                  setError(null);
                  setResult(null);
                }}
                result={result}
                insight={insightMutation.data ?? null}
                insightLoading={insightMutation.isPending}
                insightError={insightError}
                onRetryInsight={
                  result?.sql && result.results?.length
                    ? () =>
                        insightMutation.mutate({
                          question: "Summarize the business meaning of this SQL query result",
                          sql: result.sql,
                          rows: result.results ?? [],
                        })
                    : undefined
                }
                hideSql={Boolean(result?.sql && result.sql === sql)}
                showFeedback={false}
              />
            )}
          </div>

      </div>
    </WorkbenchLayout>
  );
}

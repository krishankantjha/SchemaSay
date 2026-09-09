import { useState, type KeyboardEvent } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, Play, Wand2 } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { assistantApi, queryApi, schemaApi } from "@/lib/api/endpoints";
import type { QueryResponse } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import { ConnectionRequired } from "@/components/shared/ConnectionRequired";
import { SqlEditor } from "@/components/sql/SqlEditor";
import { SchemaTreeSidebar } from "@/features/workbench/SchemaTreeSidebar";
import { SqlBlock } from "@/features/workbench/SqlBlock";
import { DataTable } from "@/features/workbench/DataTable";
import { ChartPanel } from "@/features/workbench/ChartPanel";
import { QueryTrustPanel } from "@/features/workbench/QueryTrustPanel";
import { InsightPanel } from "@/features/workbench/InsightPanel";
import { useInsightGeneration } from "@/features/workbench/useInsightGeneration";
import { Button } from "@/components/ui/Button";

export function SqlPage() {
  return (
    <ConnectionRequired title="SQL editor needs a connection">
      <SqlPageContent />
    </ConnectionRequired>
  );
}

function SqlPageContent() {
  const location = useLocation();
  const initialSql =
    (location.state as { sql?: string } | null)?.sql ?? "SELECT 1";
  const queryClient = useQueryClient();
  const { activeConnectionId, activeConnection } = useConnection();
  const [sql, setSql] = useState(initialSql);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const insightMutation = useInsightGeneration();

  const { data: schemaTree, isLoading: schemaLoading } = useQuery({
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
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Sync failed");
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

  function insertColumnRef(ref: string) {
    setSql((prev) => (prev.trim() ? `${prev.trimEnd()} ${ref}` : ref));
  }

  const rows = result?.results ?? [];
  const showChart = result?.chart_config?.chart_type !== "table";

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border-y border-border-subtle bg-bg-surface sm:mx-6 sm:rounded-xl sm:border">
      <div className="hidden w-56 shrink-0 lg:block xl:w-60">
        <SchemaTreeSidebar
          tables={schemaTree?.tables ?? []}
          isLoading={schemaLoading}
          onSync={(profile) => void handleSync(profile)}
          isSyncing={isSyncing}
          onInsertColumn={insertColumnRef}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">SQL Editor</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
              <Database className="h-3.5 w-3.5" />
              {activeConnection?.name} · governed read-only execution
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRun} disabled={runMutation.isPending || !sql.trim()}>
              {runMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run
            </Button>
            <Button
              variant="secondary"
              onClick={() => formatMutation.mutate()}
              disabled={formatMutation.isPending || !sql.trim()}
            >
              <Wand2 className="h-4 w-4" />
              Format
            </Button>
          </div>
        </div>

        <SqlEditor
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleEditorKeyDown}
          placeholder="Write a read-only SELECT query…"
        />
        <p className="mt-1.5 text-[11px] text-text-muted">⌘ Enter to run · Tab to indent</p>

        {runMutation.isPending ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface px-3.5 py-2.5 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            Validating → Executing…
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-danger/30 bg-[var(--color-danger-muted)] p-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {result?.sql && result.sql !== sql ? (
          <div className="mt-4">
            <SqlBlock sql={result.sql} />
          </div>
        ) : null}

        {rows.length ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-xs text-text-muted">
                {rows.length} rows · {result?.execution_duration_ms.toFixed(0)}ms
              </p>
              <DataTable rows={rows} />
              {showChart && result?.chart_config ? (
                <div className="mt-3">
                  <ChartPanel config={result.chart_config} rows={rows} />
                </div>
              ) : null}
            </div>
            <InsightPanel
              insight={insightMutation.data ?? null}
              isLoading={insightMutation.isPending}
              error={
                insightMutation.data && !insightMutation.data.success
                  ? insightMutation.data.error
                  : null
              }
            />
          </div>
        ) : null}
      </div>

      <div className="hidden w-72 shrink-0 xl:block">
        <QueryTrustPanel
          explanation={result?.explanation ?? null}
          correlationId={result?.correlation_id}
          error={error}
          sql={result?.sql ?? sql}
        />
      </div>
    </div>
  );
}

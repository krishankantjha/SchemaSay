import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, Play, RotateCcw, Search } from "lucide-react";
import { useToast } from "@/app/ToastContext";
import { auditApi } from "@/lib/api/endpoints";
import type { AuditLog, AuditReplayResponse } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import { ConnectionRequired } from "@/components/shared/ConnectionRequired";
import { resolutionSourceLabel } from "@/lib/utils";
import { SqlBlock } from "@/features/workbench/SqlBlock";
import { DataTable } from "@/features/workbench/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

const PAGE_SIZE = 20;

export function AuditPage() {
  return (
    <ConnectionRequired title="Audit log needs a connection">
      <AuditPageContent />
    </ConnectionRequired>
  );
}

function AuditPageContent() {
  const navigate = useNavigate();
  const { push: toast } = useToast();
  const { activeConnectionId } = useConnection();
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [replay, setReplay] = useState<AuditReplayResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["audit", activeConnectionId, statusFilter, page],
    queryFn: () =>
      auditApi.list({
        connection_id: activeConnectionId ?? undefined,
        limit: PAGE_SIZE,
        page: page + 1,
        status: statusFilter || undefined,
      }),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return logs;
    return logs.filter(
      (log) =>
        log.question.toLowerCase().includes(q) ||
        log.sql_query.toLowerCase().includes(q) ||
        log.status.toLowerCase().includes(q),
    );
  }, [logs, search]);

  const replayMutation = useMutation({
    mutationFn: auditApi.replay,
    onSuccess: (data) => {
      setReplay(data);
      toast(data.success ? "Replay succeeded" : "Replay failed", data.success ? "success" : "error");
    },
  });

  function openInSql(sql: string) {
    navigate("/sql", { state: { sql } });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Audit Log</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Time · Question · Status · Duration
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RotateCcw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            className="h-9 pl-8"
            placeholder="Search question or SQL…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="h-9 rounded-lg border border-border-default bg-bg-elevated px-3 text-sm text-text-primary"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading audit logs…</p>
      ) : !filtered.length ? (
        <Card className="flex flex-col items-center py-10 text-center">
          <p className="text-sm font-medium text-text-primary">No queries logged yet</p>
          <p className="mt-1 text-sm text-text-muted">Run a query from Ask or SQL to build history.</p>
          <Link to="/ask" className="mt-4">
            <Button size="sm">Go to Ask</Button>
          </Link>
        </Card>
      ) : (
        <>
          <div className="overflow-auto rounded-lg border border-border-subtle">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="border-b border-border-subtle bg-bg-elevated text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5">Question</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Confidence</th>
                  <th className="px-3 py-2.5">Duration</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => {
                      setSelected(log);
                      setReplay(null);
                    }}
                    className={[
                      "cursor-pointer border-b border-border-subtle/50 hover:bg-bg-elevated/50",
                      selected?.id === log.id ? "bg-accent-muted/30" : "",
                    ].join(" ")}
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-text-muted">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2.5">{log.question}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={log.status === "success" ? "success" : "danger"}>
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{log.confidence_score ?? "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums text-text-muted">
                      {log.execution_duration_ms != null ? `${log.execution_duration_ms}ms` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Page {page + 1}</span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={logs.length < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {selected ? (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Query detail #{selected.id}</h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => openInSql(selected.sql_query)}>
                <ExternalLink className="h-3.5 w-3.5" />
                Open in SQL
              </Button>
              <Button
                size="sm"
                onClick={() => replayMutation.mutate(selected.id)}
                disabled={replayMutation.isPending || selected.status === "failed"}
              >
                <Play className="h-3.5 w-3.5" />
                Replay
              </Button>
            </div>
          </div>

          <p className="text-sm text-text-secondary">{selected.question}</p>
          <SqlBlock sql={selected.sql_query} />

          <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Status" value={selected.status} />
            <Detail
              label="Duration"
              value={
                selected.execution_duration_ms != null
                  ? `${selected.execution_duration_ms}ms`
                  : "—"
              }
            />
            <Detail label="Confidence" value={String(selected.confidence_score ?? "—")} />
            <Detail
              label="Source"
              value={
                selected.resolution_source
                  ? resolutionSourceLabel(selected.resolution_source)
                  : "—"
              }
            />
            <Detail
              label="Grounded"
              value={selected.grounded == null ? "—" : selected.grounded ? "Yes" : "No"}
            />
            <Detail label="Rows" value={String(selected.row_count ?? "—")} />
            <Detail
              label="Tables"
              value={selected.tables_accessed.length ? selected.tables_accessed.join(", ") : "—"}
            />
            <Detail label="Metric ID" value={String(selected.metric_id ?? "—")} />
          </div>

          {selected.error_message ? (
            <p className="rounded-lg border border-danger/30 bg-[var(--color-danger-muted)] p-3 text-sm text-danger">
              {selected.error_message}
            </p>
          ) : null}

          {replay ? (
            <div className="space-y-2 border-t border-border-subtle pt-4">
              <p className="text-xs font-medium text-text-secondary">
                Replay {replay.success ? "succeeded" : "failed"} ·{" "}
                {replay.execution_duration_ms.toFixed(0)}ms
              </p>
              {replay.error ? <p className="text-sm text-danger">{replay.error}</p> : null}
              {replay.results?.length ? (
                <DataTable rows={replay.results as Record<string, unknown>[]} pageSize={10} />
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-0.5 truncate text-text-primary">{value}</p>
    </div>
  );
}

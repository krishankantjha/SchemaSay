import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Play,
  RotateCcw,
  Search,
} from "lucide-react";
import { useToast } from "@/app/ToastContext";
import { auditApi } from "@/lib/api/endpoints";
import type { AuditLog, AuditReplayResponse } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import { ConnectionRequired } from "@/components/shared/ConnectionRequired";
import { resolutionSourceLabel, routingDecisionLabel, cn } from "@/lib/utils";
import { SqlBlock } from "@/features/workbench/SqlBlock";
import { DataTable } from "@/features/workbench/DataTable";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { PageListSkeleton } from "@/components/ui/Skeleton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatCard } from "@/components/ui/StatCard";
import { QueryError } from "@/components/ui/QueryError";
import { Tooltip } from "@/components/ui/Tooltip";

const PAGE_SIZE = 20;

type StatusFilter = "" | "success" | "failed";

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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [replay, setReplay] = useState<AuditReplayResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data: logs = [], isLoading, isError, refetch, isFetching } = useQuery({
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

  const summary = useMemo(() => {
    const success = logs.filter((l) => l.status === "success").length;
    const failed = logs.filter((l) => l.status === "failed").length;
    const avgMs =
      logs.length > 0
        ? Math.round(
            logs.reduce((n, l) => n + (l.execution_duration_ms ?? 0), 0) / logs.length,
          )
        : 0;
    return { success, failed, avgMs };
  }, [logs]);

  const replayMutation = useMutation({
    mutationFn: auditApi.replay,
    onSuccess: (data) => {
      setReplay(data);
      toast(data.success ? "Replay succeeded" : "Replay failed", data.success ? "success" : "error");
    },
  });

  const expanded = filtered.find((l) => l.id === expandedId) ?? null;

  function openInSql(sql: string) {
    navigate("/sql", { state: { sql } });
  }

  function toggleExpand(log: AuditLog) {
    if (expandedId === log.id) {
      setExpandedId(null);
      setReplay(null);
    } else {
      setExpandedId(log.id);
      setReplay(null);
    }
  }

  return (
    <PageShell width="wide">
      <PageHeader
        title="Audit Log"
        description="Query history with status, confidence, and replay"
        actions={
          <Tooltip content="Reload the latest query history">
            <Button variant="secondary" size="sm" onClick={() => void refetch()} loading={isFetching}>
              <RotateCcw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </Tooltip>
        }
      />

      {!isLoading && logs.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Success (page)" value={summary.success} variant="success" />
          <StatCard label="Failed (page)" value={summary.failed} variant={summary.failed > 0 ? "danger" : "default"} />
          <StatCard label="Avg duration" value={`${summary.avgMs}ms`} icon={Clock} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            className="h-9 pl-8"
            placeholder="Search question or SQL…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search question or SQL"
          />
        </div>
          <SegmentedControl<"all" | "success" | "failed">
            ariaLabel="Filter by status"
            value={statusFilter || "all"}
            onChange={(id) => {
              setStatusFilter(id === "all" ? "" : id);
              setPage(0);
            }}
          options={[
            { value: "all", label: "All" },
            { value: "success", label: "Success" },
            { value: "failed", label: "Failed" },
          ]}
        />
      </div>

      {isError ? (
        <QueryError onRetry={() => void refetch()} retrying={isFetching} />
      ) : isLoading ? (
        <PageListSkeleton rows={5} />
      ) : !filtered.length ? (
        <EmptyState
          title="No queries logged yet"
          description="Run a query from Ask or SQL to build history."
          compact
          action={
            <Link to="/ask" className="no-underline">
              <Button size="sm">Go to Ask</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="relative space-y-0">
            <div className="absolute bottom-0 left-[18px] top-0 w-px bg-border-subtle" aria-hidden />
            {filtered.map((log) => {
              const isOpen = expandedId === log.id;
              return (
                <div key={log.id} className="relative pl-10">
                  <span
                    className={cn(
                      "absolute left-3 top-4 z-[1] h-3 w-3 rounded-full border-2 bg-bg-base",
                      log.status === "success" ? "border-success" : "border-danger",
                    )}
                    aria-hidden
                  />
                  <div
                    className={cn(
                      "mb-2 overflow-hidden rounded-lg border transition-colors duration-fast",
                      isOpen ? "border-accent/30 bg-accent-muted/10" : "border-border-subtle bg-bg-surface",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpand(log)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-bg-elevated/40"
                    >
                      {isOpen ? (
                        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                      ) : (
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-text-muted">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                          <StatusBadge status={log.status} />
                          <ConfidenceBadge score={log.confidence_score} />
                          {log.execution_duration_ms != null ? (
                            <DurationBadge ms={log.execution_duration_ms} />
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-text-primary">{log.question}</p>
                        {!isOpen ? (
                          <p className="mt-0.5 truncate font-mono text-[11px] text-text-muted">
                            {log.sql_query}
                          </p>
                        ) : null}
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="animate-reveal space-y-4 border-t border-border-subtle px-4 py-4">
                        <p className="text-sm text-text-secondary">{log.question}</p>
                        <SqlBlock sql={log.sql_query} />

                        <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          <Detail label="Status" value={log.status} />
                          <Detail
                            label="Duration"
                            value={
                              log.execution_duration_ms != null
                                ? `${log.execution_duration_ms}ms`
                                : "—"
                            }
                          />
                          <Detail label="Confidence" value={String(log.confidence_score ?? "—")} />
                          <Detail
                            label="Source"
                            value={
                              log.resolution_source
                                ? resolutionSourceLabel(log.resolution_source)
                                : "—"
                            }
                          />
                          <Detail
                            label="Grounded"
                            value={log.grounded == null ? "—" : log.grounded ? "Yes" : "No"}
                          />
                          <Detail label="Rows" value={String(log.row_count ?? "—")} />
                          <Detail
                            label="Tables"
                            value={log.tables_accessed.length ? log.tables_accessed.join(", ") : "—"}
                          />
                          <Detail label="Metric ID" value={String(log.metric_id ?? "—")} />
                        </div>

                        {log.error_message ? (
                          <Alert variant="danger">{log.error_message}</Alert>
                        ) : null}

                        <AuditTelemetryDetails log={log} />

                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openInSql(log.sql_query)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open in SQL
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => replayMutation.mutate(log.id)}
                            disabled={replayMutation.isPending || log.status === "failed"}
                            loading={replayMutation.isPending}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Replay
                          </Button>
                        </div>

                        {replay && expanded?.id === log.id ? (
                          <div className="space-y-2 border-t border-border-subtle pt-4">
                            <p className="text-xs font-medium text-text-secondary">
                              Replay {replay.success ? "succeeded" : "failed"} ·{" "}
                              {replay.execution_duration_ms.toFixed(0)}ms
                            </p>
                            {replay.error ? <Alert variant="danger">{replay.error}</Alert> : null}
                            {replay.results?.length ? (
                              <DataTable rows={replay.results as Record<string, unknown>[]} pageSize={10} />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-text-muted">Page {page + 1}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
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
    </PageShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "success" ? "success" : "danger"}>
      {status}
    </Badge>
  );
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score == null) return <Badge variant="default">— conf</Badge>;
  const variant = score >= 71 ? "success" : score >= 41 ? "warning" : "danger";
  const label = score >= 71 ? "High" : score >= 41 ? "Medium" : "Low";
  return (
    <Tooltip content={`${label} confidence`}>
      <Badge variant={variant}>{score}% conf</Badge>
    </Tooltip>
  );
}

function DurationBadge({ ms }: { ms: number }) {
  const variant = ms > 3000 ? "warning" : ms > 1000 ? "default" : "success";
  return (
    <Badge variant={variant} className="tabular-nums">
      {ms}ms
    </Badge>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-elevated/40 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm text-text-primary">{value}</p>
    </div>
  );
}

function AuditTelemetryDetails({ log }: { log: AuditLog }) {
  const telemetry = log.eval_telemetry;
  const hasTelemetry =
    log.heuristic_tier != null ||
    log.heuristic_compile_confidence != null ||
    telemetry != null;

  if (!hasTelemetry) {
    return (
      <p className="text-xs text-text-muted">
        No pipeline telemetry recorded for this query.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border-subtle bg-bg-elevated/30 p-3">
      <div>
        <p className="text-xs font-medium text-text-primary">Pipeline telemetry</p>
        <p className="mt-0.5 text-[11px] text-text-muted">
          Operator view — how SchemaSay routed and validated this query.
        </p>
      </div>

      {telemetry?.false_confidence ? (
        <Alert variant="warning" title="False confidence">
          High internal confidence but validation or grounding checks did not fully pass.
        </Alert>
      ) : null}

      <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Compiler tier" value={log.heuristic_tier ?? "—"} />
        <Detail
          label="Compile confidence"
          value={
            log.heuristic_compile_confidence != null
              ? `${log.heuristic_compile_confidence}%`
              : "—"
          }
        />
        <Detail
          label="Routing"
          value={
            telemetry?.routing_decision
              ? routingDecisionLabel(telemetry.routing_decision)
              : "—"
          }
        />
        <Detail
          label="Intent"
          value={telemetry?.heuristic_intent?.replace(/_/g, " ") ?? "—"}
        />
        <Detail label="Used LLM" value={telemetry?.used_llm ? "Yes" : "No"} />
        <Detail
          label="Validation"
          value={
            telemetry?.validation_passed == null
              ? "—"
              : telemetry.validation_passed
                ? "Passed"
                : "Failed"
          }
        />
        <Detail
          label="Calibrated confidence"
          value={
            telemetry?.calibrated_confidence != null
              ? `${telemetry.calibrated_confidence}%`
              : "—"
          }
        />
        <Detail
          label="Escalation"
          value={telemetry?.escalation_reason?.replace(/_/g, " ") ?? "—"}
        />
      </div>

      {telemetry?.validation_issues?.length ? (
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Validation issues
          </p>
          <ul className="space-y-1 text-xs text-text-secondary">
            {telemetry.validation_issues.map((issue) => (
              <li key={issue} className="rounded-md border border-warning/20 bg-warning/5 px-2.5 py-1.5">
                {issue}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

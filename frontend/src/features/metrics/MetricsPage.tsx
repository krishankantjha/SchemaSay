import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, LineChart, Plus, Trash2, Layers } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { metricsApi } from "@/lib/api/endpoints";
import type { Metric, MetricCreate } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import { ConnectionRequired } from "@/components/shared/ConnectionRequired";
import { SqlBlock } from "@/features/workbench/SqlBlock";
import { DataTable } from "@/features/workbench/DataTable";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { PageListSkeleton, StatRowSkeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { cn } from "@/lib/utils";
import { useToast } from "@/app/ToastContext";
import { QueryError } from "@/components/ui/QueryError";

export function MetricsPage() {
  return (
    <ConnectionRequired title="Metrics need a connection">
      <MetricsPageContent />
    </ConnectionRequired>
  );
}

function MetricsPageContent() {
  const { activeConnectionId } = useConnection();
  const queryClient = useQueryClient();
  const { push: toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [previewMetric, setPreviewMetric] = useState<Metric | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState("");
  const [previewResult, setPreviewResult] = useState<Awaited<ReturnType<typeof metricsApi.preview>> | null>(null);
  const [error, setError] = useState("");

  const {
    data: metrics = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["metrics", activeConnectionId],
    queryFn: () => metricsApi.list(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Metric[]>();
    for (const m of metrics) {
      const key = m.base_table || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [metrics]);

  const summary = useMemo(() => {
    const tables = new Set(metrics.map((m) => m.base_table));
    const dimensions = metrics.reduce((n, m) => n + m.dimensions.length, 0);
    return { count: metrics.length, tables: tables.size, dimensions };
  }, [metrics]);

  const deleteMutation = useMutation({
    mutationFn: metricsApi.delete,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["metrics", activeConnectionId] });
      toast("Metric deleted", "success");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.detail : "Could not delete metric");
      toast("Could not delete metric", "error");
    },
  });

  const previewMutation = useMutation({
    mutationFn: ({ id, question }: { id: number; question: string }) =>
      metricsApi.preview(id, { question, execute: true }),
    onSuccess: setPreviewResult,
    onError: (err) => setError(err instanceof ApiError ? err.detail : "Preview failed"),
  });

  return (
    <PageShell width="wide">
      <PageHeader
        title="Semantic Metrics"
        description="Governed KPI definitions that power natural-language queries"
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            New metric
          </Button>
        }
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {!isLoading && metrics.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total metrics" value={summary.count} icon={LineChart} />
          <StatCard label="Tables covered" value={summary.tables} icon={Layers} />
          <StatCard label="Dimensions" value={summary.dimensions} hint="Breakdown axes defined" />
        </div>
      ) : null}

      {showForm ? (
        <MetricForm
          connectionId={activeConnectionId!}
          onDone={() => {
            setShowForm(false);
            void queryClient.invalidateQueries({ queryKey: ["metrics", activeConnectionId] });
            toast("Metric created", "success");
          }}
          onError={setError}
        />
      ) : null}

      {isError ? (
        <QueryError onRetry={() => void refetch()} retrying={isFetching} />
      ) : isLoading ? (
        <div className="space-y-4">
          <StatRowSkeleton count={3} />
          <PageListSkeleton rows={3} />
        </div>
      ) : !metrics.length ? (
        <EmptyState
          icon={LineChart}
          title="No metrics yet"
          description='Define governed KPIs like "total_revenue" with SUM(amount) on your orders table — they power natural-language queries.'
          compact
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Create your first metric
            </Button>
          }
          secondaryAction={
            <Link to="/schema" className="no-underline">
              <Button variant="secondary">Explore schema</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(([tableName, tableMetrics]) => (
            <section key={tableName}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                  {tableName}
                </h2>
                <Badge variant="default">{tableMetrics.length}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {tableMetrics.map((metric) => (
                  <MetricCard
                    key={metric.id}
                    metric={metric}
                    onPreview={() => {
                      setPreviewMetric(metric);
                      setPreviewQuestion(`Show ${metric.label}`);
                      setPreviewResult(null);
                      setError("");
                    }}
                    onDelete={() => deleteMutation.mutate(metric.id)}
                    deleting={deleteMutation.isPending}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {previewMetric ? (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Preview: {previewMetric.label}</CardTitle>
            <CardDescription>Test how this metric resolves from a natural-language question</CardDescription>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-md"
              value={previewQuestion}
              onChange={(e) => setPreviewQuestion(e.target.value)}
              placeholder="Test question"
            />
            <Button
              onClick={() => previewMutation.mutate({ id: previewMetric.id, question: previewQuestion })}
              loading={previewMutation.isPending}
            >
              Run preview
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPreviewMetric(null)}>
              Close
            </Button>
          </div>
          {previewMutation.isPending ? (
            <LoadingState message="Running preview…" compact className="mt-4" />
          ) : null}
          {previewResult ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="accent">Match {Math.round(previewResult.match_score * 100)}%</Badge>
                {previewResult.dimensions_used.map((d) => (
                  <Badge key={d}>{d}</Badge>
                ))}
              </div>
              <SqlBlock sql={previewResult.sql} />
              {previewResult.assumptions.length ? (
                <Alert variant="info" title="Assumptions">
                  <ul className="list-inside list-disc">
                    {previewResult.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
              {previewResult.results?.length ? (
                <DataTable rows={previewResult.results as Record<string, unknown>[]} pageSize={10} />
              ) : (
                <EmptyState title="No preview rows" compact />
              )}
            </div>
          ) : null}
        </Card>
      ) : null}
    </PageShell>
  );
}

function MetricCard({
  metric,
  onPreview,
  onDelete,
  deleting,
}: {
  metric: Metric;
  onPreview: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const dimCount = metric.dimensions.length;

  return (
    <Card className="relative overflow-hidden border-t-2 border-t-accent/40">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{metric.label}</CardTitle>
            <p className="mt-0.5 font-mono text-[11px] text-text-muted">{metric.name}</p>
          </div>
          <Badge variant="accent">{metric.base_table}</Badge>
        </div>
        {metric.description ? <CardDescription>{metric.description}</CardDescription> : null}
      </CardHeader>

      {/* Dimension coverage sparkline-style bar */}
      <div className="mb-3 px-4">
        <div className="mb-1 flex justify-between text-[10px] text-text-muted">
          <span>Dimensions</span>
          <span>{dimCount}</span>
        </div>
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-bg-elevated">
          {dimCount === 0 ? (
            <div className="h-full w-full bg-border-subtle" />
          ) : (
            metric.dimensions.map((d, i) => (
              <div
                key={d.name}
                className={cn(
                  "h-full flex-1",
                  i % 2 === 0 ? "bg-accent/60" : "bg-[var(--color-chart-2)]/60",
                )}
                title={d.label}
              />
            ))
          )}
        </div>
      </div>

      <div className="px-4 pb-2">
        <code className="block overflow-x-auto rounded-md bg-bg-elevated px-2 py-1.5 font-mono text-[11px] text-text-secondary">
          {metric.sql_expression}
        </code>
      </div>

      {metric.dimensions.length ? (
        <div className="mb-3 flex flex-wrap gap-1 px-4">
          {metric.dimensions.map((d) => (
            <Badge key={d.name} variant="default">
              {d.label}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2 border-t border-border-subtle px-4 py-3">
        <Button variant="secondary" size="sm" onClick={onPreview}>
          <Eye className="h-3.5 w-3.5" />
          Preview
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete} disabled={deleting}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}

function MetricForm({
  connectionId,
  onDone,
  onError,
}: {
  connectionId: number;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState<MetricCreate>({
    connection_id: connectionId,
    name: "",
    label: "",
    description: "",
    sql_expression: "SUM(amount)",
    base_table: "",
    default_filters: "",
    dimensions: [],
  });
  const [dimName, setDimName] = useState("");
  const [dimLabel, setDimLabel] = useState("");
  const [dimCol, setDimCol] = useState("");

  const createMutation = useMutation({
    mutationFn: metricsApi.create,
    onSuccess: onDone,
    onError: (err) => onError(err instanceof ApiError ? err.detail : "Create failed"),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onError("");
    createMutation.mutate({
      ...form,
      name: form.name.toLowerCase().replace(/\s+/g, "_"),
      description: form.description || undefined,
      default_filters: form.default_filters || undefined,
    });
  }

  function addDimension() {
    if (!dimName || !dimCol) return;
    setForm((f) => ({
      ...f,
      dimensions: [
        ...(f.dimensions ?? []),
        { name: dimName, label: dimLabel || dimName, column_ref: dimCol, dimension_type: "category" },
      ],
    }));
    setDimName("");
    setDimLabel("");
    setDimCol("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create metric</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
        <Field label="Name (slug)" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="total_revenue" />
        <Field label="Label" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="Total Revenue" />
        <Field label="Base table" value={form.base_table} onChange={(v) => setForm({ ...form, base_table: v })} placeholder="orders" />
        <Field label="SQL expression" value={form.sql_expression} onChange={(v) => setForm({ ...form, sql_expression: v })} placeholder="SUM(total_amount)" />
        <div className="md:col-span-2">
          <OptionalField label="Description" value={form.description ?? ""} onChange={(v) => setForm({ ...form, description: v })} />
        </div>
        <div className="md:col-span-2">
          <OptionalField label="Default filters" value={form.default_filters ?? ""} onChange={(v) => setForm({ ...form, default_filters: v })} placeholder="status = 'completed'" />
        </div>
        <div className="md:col-span-2 rounded-lg border border-border-subtle p-3">
          <p className="mb-2 text-xs font-medium text-text-secondary">Dimensions (optional)</p>
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-[120px]" placeholder="name" value={dimName} onChange={(e) => setDimName(e.target.value)} />
            <Input className="max-w-[120px]" placeholder="label" value={dimLabel} onChange={(e) => setDimLabel(e.target.value)} />
            <Input className="max-w-[180px]" placeholder="table.column" value={dimCol} onChange={(e) => setDimCol(e.target.value)} />
            <Button type="button" variant="secondary" size="sm" onClick={addDimension}>Add</Button>
          </div>
          {form.dimensions?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {form.dimensions.map((d) => (
                <Badge key={d.name}>{d.name}</Badge>
              ))}
            </div>
          ) : null}
        </div>
        <div className="md:col-span-2">
          <Button type="submit" loading={createMutation.isPending}>Create metric</Button>
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required />
    </div>
  );
}

function OptionalField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

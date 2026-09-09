import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { metricsApi } from "@/lib/api/endpoints";
import type { Metric, MetricCreate } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import { ConnectionRequired } from "@/components/shared/ConnectionRequired";
import { SqlBlock } from "@/features/workbench/SqlBlock";
import { DataTable } from "@/features/workbench/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

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
  const [showForm, setShowForm] = useState(false);
  const [previewMetric, setPreviewMetric] = useState<Metric | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState("");
  const [previewResult, setPreviewResult] = useState<Awaited<ReturnType<typeof metricsApi.preview>> | null>(null);
  const [error, setError] = useState("");

  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ["metrics", activeConnectionId],
    queryFn: () => metricsApi.list(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  const deleteMutation = useMutation({
    mutationFn: metricsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["metrics", activeConnectionId] }),
  });

  const previewMutation = useMutation({
    mutationFn: ({ id, question }: { id: number; question: string }) =>
      metricsApi.preview(id, { question, execute: true }),
    onSuccess: setPreviewResult,
    onError: (err) => setError(err instanceof ApiError ? err.detail : "Preview failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Semantic Metrics</h1>
          <p className="text-sm text-text-secondary">Governed business definitions for NL queries</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          New metric
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {showForm ? (
        <MetricForm
          connectionId={activeConnectionId!}
          onDone={() => {
            setShowForm(false);
            void queryClient.invalidateQueries({ queryKey: ["metrics", activeConnectionId] });
          }}
          onError={setError}
        />
      ) : null}

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading metrics…</p>
      ) : !metrics.length ? (
        <Card>
          <p className="text-sm text-text-muted">
            No metrics yet. Create one like &quot;total_revenue&quot; with SUM(amount) on your orders table.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <Card key={metric.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{metric.label}</CardTitle>
                  <Badge variant="accent">{metric.name}</Badge>
                </div>
                <CardDescription>{metric.description ?? metric.base_table}</CardDescription>
              </CardHeader>
              <pre className="mb-3 overflow-x-auto rounded-md bg-bg-elevated p-2 font-mono text-[11px] text-text-secondary">
                {metric.sql_expression}
              </pre>
              {metric.dimensions.length ? (
                <div className="mb-3 flex flex-wrap gap-1">
                  {metric.dimensions.map((d) => (
                    <Badge key={d.name}>{d.label}</Badge>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPreviewMetric(metric);
                    setPreviewQuestion(`Show ${metric.label}`);
                    setPreviewResult(null);
                    setError("");
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => deleteMutation.mutate(metric.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {previewMetric ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview: {previewMetric.label}</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-md"
              value={previewQuestion}
              onChange={(e) => setPreviewQuestion(e.target.value)}
              placeholder="Test question"
            />
            <Button
              onClick={() =>
                previewMutation.mutate({ id: previewMetric.id, question: previewQuestion })
              }
              disabled={previewMutation.isPending}
            >
              Run preview
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPreviewMetric(null)}>
              Close
            </Button>
          </div>
          {previewResult ? (
            <div className="mt-4 space-y-3">
              <SqlBlock sql={previewResult.sql} />
              {previewResult.assumptions.length ? (
                <ul className="list-inside list-disc text-sm text-text-secondary">
                  {previewResult.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              ) : null}
              {previewResult.results?.length ? (
                <DataTable rows={previewResult.results as Record<string, unknown>[]} />
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
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
          <Button type="submit" disabled={createMutation.isPending}>Create metric</Button>
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

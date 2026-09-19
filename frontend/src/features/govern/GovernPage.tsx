import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Lock, Shield, ShieldAlert } from "lucide-react";
import { useToast } from "@/app/ToastContext";
import { ApiError } from "@/lib/api/client";
import { connectionsApi, schemaApi } from "@/lib/api/endpoints";
import type { ConnectionPolicyUpdate } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import { ConnectionRequired } from "@/components/shared/ConnectionRequired";
import { ChipSelector } from "@/components/ui/ChipSelector";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { SkeletonLines } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { QueryError } from "@/components/ui/QueryError";
import { cn } from "@/lib/utils";

type ComplianceLevel = "compliant" | "partial" | "at_risk";

export function GovernPage() {
  return (
    <ConnectionRequired title="Governance needs a connection">
      <GovernPageContent />
    </ConnectionRequired>
  );
}

function GovernPageContent() {
  const queryClient = useQueryClient();
  const { push: toast } = useToast();
  const { activeConnectionId, activeConnection } = useConnection();
  const [blockedTables, setBlockedTables] = useState<string[]>([]);
  const [blockedColumns, setBlockedColumns] = useState<string[]>([]);
  const [requireHighConfidence, setRequireHighConfidence] = useState(false);
  const [minConfidence, setMinConfidence] = useState(50);
  const [blockPii, setBlockPii] = useState(false);
  const [error, setError] = useState("");

  const {
    data: policy,
    isLoading: policyLoading,
    isError: policyError,
    refetch: refetchPolicy,
    isFetching: policyFetching,
  } = useQuery({
    queryKey: ["policy", activeConnectionId],
    queryFn: () => connectionsApi.getPolicy(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  const {
    data: schema,
    isError: schemaError,
    refetch: refetchSchema,
    isFetching: schemaFetching,
  } = useQuery({
    queryKey: ["schema-tree", activeConnectionId],
    queryFn: () => schemaApi.tree(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  useEffect(() => {
    if (!policy) return;
    setBlockedTables(policy.blocked_tables);
    setBlockedColumns(policy.blocked_columns);
    setRequireHighConfidence(policy.require_high_confidence);
    setMinConfidence(policy.min_confidence_threshold);
    setBlockPii(policy.block_pii_access);
  }, [policy]);

  const tableOptions = useMemo(() => schema?.tables.map((t) => t.name) ?? [], [schema]);

  const columnOptions = useMemo(() => {
    const cols: string[] = [];
    for (const table of schema?.tables ?? []) {
      for (const col of table.columns) {
        cols.push(`${table.name}.${col.name}`);
      }
    }
    return cols;
  }, [schema]);

  const piiColumns = useMemo(() => {
    const items: { table: string; column: string; type: string }[] = [];
    for (const table of schema?.tables ?? []) {
      for (const col of table.columns) {
        if (col.is_pii) items.push({ table: table.name, column: col.name, type: col.data_type });
      }
    }
    return items;
  }, [schema]);

  const compliance = useMemo((): { level: ComplianceLevel; message: string } => {
    const restrictions = blockedTables.length + blockedColumns.length;
    const piiExposed = piiColumns.length > 0 && !blockPii;
    if (piiExposed) {
      return {
        level: "at_risk",
        message: `${piiColumns.length} PII column(s) detected without block policy enabled.`,
      };
    }
    if (restrictions > 0 || blockPii || requireHighConfidence) {
      return {
        level: "partial",
        message: `${restrictions} restriction(s) active. Review confidence and PII settings.`,
      };
    }
    return {
      level: "compliant",
      message: "No active restrictions. Consider blocking sensitive tables or enabling PII protection.",
    };
  }, [blockedTables, blockedColumns, blockPii, requireHighConfidence, piiColumns.length]);

  const saveMutation = useMutation({
    mutationFn: (payload: ConnectionPolicyUpdate) =>
      connectionsApi.updatePolicy(activeConnectionId!, payload),
    onSuccess: () => {
      toast("Policy saved", "success");
      void queryClient.invalidateQueries({ queryKey: ["policy", activeConnectionId] });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.detail : "Save failed";
      setError(message);
      toast("Could not save policy", "error");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    saveMutation.mutate({
      blocked_tables: blockedTables,
      blocked_columns: blockedColumns,
      require_high_confidence: requireHighConfidence,
      min_confidence_threshold: minConfidence,
      block_pii_access: blockPii,
    });
  }

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Governance"
        description={activeConnection?.name ?? "Manage access policies for your connection"}
      />

      <ComplianceBanner level={compliance.level} message={compliance.message} />

      {policyError ? (
        <QueryError
          message="Could not load governance policy."
          onRetry={() => void refetchPolicy()}
          retrying={policyFetching}
        />
      ) : null}

      {schemaError ? (
        <QueryError
          message="Could not load schema for policy configuration."
          onRetry={() => void refetchSchema()}
          retrying={schemaFetching}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Blocked tables"
          value={blockedTables.length}
          variant={blockedTables.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Blocked columns"
          value={blockedColumns.length}
          variant={blockedColumns.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="PII columns detected"
          value={piiColumns.length}
          icon={Shield}
          variant={piiColumns.length > 0 && !blockPii ? "danger" : piiColumns.length > 0 ? "success" : "default"}
          hint={blockPii ? "PII access blocked" : piiColumns.length ? "PII access allowed" : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-accent" aria-hidden />
            <CardTitle>Access restrictions</CardTitle>
          </div>
          <CardDescription>Block tables or columns from queries. Changes apply on save.</CardDescription>
        </CardHeader>
        {policyLoading ? (
          <SkeletonLines lines={4} className="py-2" />
        ) : !tableOptions.length ? (
          <div className="text-center py-4">
            <p className="text-sm text-text-muted">Sync schema first to pick tables and columns.</p>
            <Link to="/connections" className="mt-3 inline-block">
              <Button variant="secondary" size="sm">Go to Connections</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <ChipSelector
              label="Blocked tables"
              description="Queries referencing these tables will be rejected."
              options={tableOptions}
              selected={blockedTables}
              onChange={setBlockedTables}
              placeholder="Search tables…"
            />
            <ChipSelector
              label="Blocked columns"
              description="Queries selecting these columns will be rejected."
              options={columnOptions}
              selected={blockedColumns}
              onChange={setBlockedColumns}
              placeholder="Search columns…"
            />
            {error ? <Alert variant="danger">{error}</Alert> : null}
            <Button type="submit" loading={saveMutation.isPending}>Save restrictions</Button>
          </form>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning" aria-hidden />
            <CardTitle>Confidence & PII policies</CardTitle>
          </div>
          <CardDescription>Control query quality thresholds and sensitive data access.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PolicyToggle
            checked={blockPii}
            onChange={setBlockPii}
            severity={blockPii ? "success" : piiColumns.length ? "danger" : "default"}
            title="Block PII access"
            description="Prevents queries from reading columns flagged as personally identifiable."
          />
          <PolicyToggle
            checked={requireHighConfidence}
            onChange={setRequireHighConfidence}
            severity={requireHighConfidence ? "warning" : "default"}
            title="Require high confidence"
            description="Rejects queries below the confidence threshold."
          />
          {requireHighConfidence ? (
            <div>
              <Label>Min confidence threshold (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
              />
            </div>
          ) : null}
          <Button type="submit" variant="secondary" loading={saveMutation.isPending}>
            Save policies
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PII overview</CardTitle>
          <CardDescription>From schema profiler at sync time.</CardDescription>
        </CardHeader>
        {!piiColumns.length ? (
          <p className="text-sm text-text-muted">No PII columns detected. Run deep sync with profiling.</p>
        ) : (
          <div className="data-table-wrap max-h-64">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Column</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {piiColumns.map((row) => (
                  <tr key={`${row.table}.${row.column}`}>
                    <td>{row.table}</td>
                    <td>
                      <span className="inline-flex items-center gap-1">
                        <Shield className="h-3 w-3 text-pii" aria-hidden />
                        {row.column}
                      </span>
                    </td>
                    <td>
                      <Badge variant="pii">{row.type}</Badge>
                    </td>
                    <td>
                      <Badge variant={blockPii ? "success" : "danger"}>
                        {blockPii ? "Blocked" : "Exposed"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}

function ComplianceBanner({ level, message }: { level: ComplianceLevel; message: string }) {
  const config = {
    compliant: {
      icon: CheckCircle2,
      variant: "success" as const,
      title: "Baseline posture",
      border: "border-success/30 bg-[var(--color-success-muted)]",
    },
    partial: {
      icon: Shield,
      variant: "info" as const,
      title: "Restrictions active",
      border: "border-info/30 bg-[var(--color-info-muted)]",
    },
    at_risk: {
      icon: AlertTriangle,
      variant: "warning" as const,
      title: "Attention needed",
      border: "border-warning/30 bg-[var(--color-warning-muted)]",
    },
  }[level];

  const Icon = config.icon;

  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3", config.border)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-text-primary" aria-hidden />
      <div>
        <p className="text-sm font-semibold text-text-primary">{config.title}</p>
        <p className="mt-0.5 text-sm text-text-secondary">{message}</p>
      </div>
      <Badge variant={config.variant} className="ml-auto shrink-0 self-start">
        {level.replace("_", " ")}
      </Badge>
    </div>
  );
}

function PolicyToggle({
  checked,
  onChange,
  title,
  description,
  severity,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
  severity: "default" | "success" | "warning" | "danger";
}) {
  const severityBorder = {
    default: "border-border-subtle",
    success: "border-success/30",
    warning: "border-warning/30",
    danger: "border-danger/30",
  }[severity];

  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border bg-bg-elevated/40 p-4 transition-colors duration-fast hover:bg-bg-elevated/70",
        severityBorder,
        checked && "ring-1 ring-accent/20",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-border-default accent-[var(--color-accent)]"
      />
      <span>
        <span className="font-medium text-text-primary">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">{description}</span>
      </span>
    </label>
  );
}

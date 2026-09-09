import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { useToast } from "@/app/ToastContext";
import { ApiError } from "@/lib/api/client";
import { connectionsApi, schemaApi } from "@/lib/api/endpoints";
import type { ConnectionPolicyUpdate } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import { ConnectionRequired } from "@/components/shared/ConnectionRequired";
import { ChipSelector } from "@/components/ui/ChipSelector";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

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

  const { data: policy, isLoading: policyLoading } = useQuery({
    queryKey: ["policy", activeConnectionId],
    queryFn: () => connectionsApi.getPolicy(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  const { data: schema } = useQuery({
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

  const tableOptions = useMemo(
    () => schema?.tables.map((t) => t.name) ?? [],
    [schema],
  );

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

  const saveMutation = useMutation({
    mutationFn: (payload: ConnectionPolicyUpdate) =>
      connectionsApi.updatePolicy(activeConnectionId!, payload),
    onSuccess: () => {
      toast("Policy saved", "success");
      void queryClient.invalidateQueries({ queryKey: ["policy", activeConnectionId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.detail : "Save failed"),
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Governance</h1>
        <p className="mt-1 text-sm text-text-secondary">{activeConnection?.name}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase text-text-muted">Blocked tables</p>
          <p className="text-2xl font-semibold">{blockedTables.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-text-muted">Blocked columns</p>
          <p className="text-2xl font-semibold">{blockedColumns.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-text-muted">PII columns detected</p>
          <p className="text-2xl font-semibold">{piiColumns.length}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Access policy</CardTitle>
          <CardDescription>
            Block tables or columns from queries. Changes apply immediately on save.
          </CardDescription>
        </CardHeader>
        {policyLoading ? (
          <p className="text-sm text-text-muted">Loading policy…</p>
        ) : !tableOptions.length ? (
          <div className="text-center">
            <p className="text-sm text-text-muted">Sync schema first to pick tables and columns.</p>
            <Link to="/connections" className="mt-3 inline-block">
              <Button variant="secondary" size="sm">
                Go to Connections
              </Button>
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

            <div className="space-y-3 rounded-lg border border-border-subtle bg-bg-elevated/40 p-4">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={blockPii}
                  onChange={(e) => setBlockPii(e.target.checked)}
                  className="mt-0.5 rounded border-border-default"
                />
                <span>
                  <span className="font-medium text-text-primary">Block PII access</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    Prevents queries from reading columns flagged as personally identifiable.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={requireHighConfidence}
                  onChange={(e) => setRequireHighConfidence(e.target.checked)}
                  className="mt-0.5 rounded border-border-default"
                />
                <span>
                  <span className="font-medium text-text-primary">Require high confidence</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    Rejects queries below the confidence threshold.
                  </span>
                </span>
              </label>
            </div>

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

            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save policy"}
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PII overview</CardTitle>
          <CardDescription>From schema profiler at sync time.</CardDescription>
        </CardHeader>
        {!piiColumns.length ? (
          <p className="text-sm text-text-muted">No PII columns detected. Run deep sync with profiling.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-subtle text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-3 py-2">Table</th>
                  <th className="px-3 py-2">Column</th>
                  <th className="px-3 py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {piiColumns.map((row) => (
                  <tr key={`${row.table}.${row.column}`} className="border-b border-border-subtle/50">
                    <td className="px-3 py-2 font-mono text-xs">{row.table}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3 text-pii" />
                        {row.column}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="pii">{row.type}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

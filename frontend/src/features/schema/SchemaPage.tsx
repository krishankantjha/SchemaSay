import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Key, Link2, RefreshCw, Search, Shield, Table2 } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { schemaApi } from "@/lib/api/endpoints";
import type { SchemaColumnNode, SchemaTableNode } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import { ConnectionRequired } from "@/components/shared/ConnectionRequired";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export function SchemaPage() {
  return (
    <ConnectionRequired title="Schema explorer needs a connection">
      <SchemaPageContent />
    </ConnectionRequired>
  );
}

function SchemaPageContent() {
  const queryClient = useQueryClient();
  const { activeConnectionId, activeConnection } = useConnection();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["schema-tree", activeConnectionId],
    queryFn: () => schemaApi.tree(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  const tables = data?.tables ?? [];

  const filteredTables = useMemo(() => {
    const q = tableSearch.toLowerCase().trim();
    if (!q) return tables;
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q)),
    );
  }, [tables, tableSearch]);

  const table = useMemo(() => {
    const name = selectedTable ?? filteredTables[0]?.name ?? null;
    return tables.find((t) => t.name === name) ?? null;
  }, [tables, filteredTables, selectedTable]);

  const filteredColumns = useMemo(() => {
    if (!table) return [];
    const q = columnSearch.toLowerCase().trim();
    if (!q) return table.columns;
    return table.columns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.data_type.toLowerCase().includes(q) ||
        (c.fk_references?.toLowerCase().includes(q) ?? false),
    );
  }, [table, columnSearch]);

  const stats = useMemo(() => {
    const piiCount = tables.reduce(
      (n, t) => n + t.columns.filter((c) => c.is_pii).length,
      0,
    );
    const totalRows = tables.reduce((n, t) => n + (t.row_count ?? 0), 0);
    return { tableCount: tables.length, piiCount, totalRows };
  }, [tables]);

  async function sync(profile: boolean) {
    if (!activeConnectionId) return;
    setSyncing(true);
    setError("");
    try {
      await schemaApi.sync(activeConnectionId, profile);
      await queryClient.invalidateQueries({ queryKey: ["schema-tree", activeConnectionId] });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Schema Explorer</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {activeConnection?.name} · browse tables, keys, and profiling stats
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void sync(false)} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void sync(true)} disabled={syncing}>
            Deep sync
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-danger/30 bg-[var(--color-danger-muted)] px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Tables" value={String(stats.tableCount)} icon={Table2} />
        <StatCard label="Total rows" value={stats.totalRows.toLocaleString()} />
        <StatCard
          label="PII columns"
          value={String(stats.piiCount)}
          highlight={stats.piiCount > 0}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading schema…</p>
      ) : !tables.length ? (
        <Card>
          <p className="text-sm text-text-muted">
            No schema cached. Run Sync to introspect your database.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="flex max-h-[72vh] flex-col p-0">
            <div className="border-b border-border-subtle p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                <Input
                  className="h-9 pl-8 text-sm"
                  placeholder="Search tables or columns…"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>
              <p className="mt-2 text-[11px] text-text-muted">
                {filteredTables.length} of {tables.length} tables
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredTables.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => {
                    setSelectedTable(t.name);
                    setColumnSearch("");
                  }}
                  className={[
                    "mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    table?.name === t.name
                      ? "bg-accent-muted text-accent"
                      : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
                  ].join(" ")}
                >
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="ml-2 shrink-0 text-[10px] tabular-nums text-text-muted">
                    {t.columns.length}c
                    {t.row_count != null ? ` · ${t.row_count.toLocaleString()}r` : ""}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {table ? (
            <TableDetail
              table={table}
              columns={filteredColumns}
              columnSearch={columnSearch}
              onColumnSearchChange={setColumnSearch}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: typeof Table2;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-pii/30 bg-[var(--color-pii-muted)]/30" : "p-4"}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-text-muted" /> : null}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{value}</p>
    </Card>
  );
}

function TableDetail({
  table,
  columns,
  columnSearch,
  onColumnSearchChange,
}: {
  table: SchemaTableNode;
  columns: SchemaColumnNode[];
  columnSearch: string;
  onColumnSearchChange: (v: string) => void;
}) {
  const piiInTable = table.columns.filter((c) => c.is_pii).length;

  return (
    <Card className="max-h-[72vh] overflow-hidden p-0">
      <div className="border-b border-border-subtle p-4">
        <CardHeader className="mb-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{table.name}</CardTitle>
            {piiInTable > 0 ? (
              <Badge variant="pii">
                <Shield className="mr-1 h-3 w-3" />
                {piiInTable} PII
              </Badge>
            ) : null}
          </div>
          <CardDescription>
            {table.columns.length} columns
            {table.row_count != null ? ` · ${table.row_count.toLocaleString()} rows` : ""}
          </CardDescription>
        </CardHeader>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            className="h-9 pl-8 text-sm"
            placeholder="Filter columns…"
            value={columnSearch}
            onChange={(e) => onColumnSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-y-auto p-4 pt-0">
        {!columns.length ? (
          <p className="py-6 text-sm text-text-muted">No columns match your filter.</p>
        ) : (
          <div className="space-y-3">
            {columns.map((col) => (
              <ColumnCard key={col.name} tableName={table.name} column={col} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function ColumnCard({ tableName, column: col }: { tableName: string; column: SchemaColumnNode }) {
  const nullPct = col.null_ratio != null ? col.null_ratio * 100 : null;

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-elevated/50 p-3 transition-colors hover:border-border-default">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-sm font-medium text-text-primary">
              {tableName}.{col.name}
            </code>
            <Badge>{col.data_type}</Badge>
            {col.is_pii ? <Badge variant="pii">PII</Badge> : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-text-muted">
            {col.is_primary_key ? (
              <span className="inline-flex items-center gap-1 text-warning">
                <Key className="h-3 w-3" /> Primary key
              </span>
            ) : null}
            {col.is_foreign_key && col.fk_references ? (
              <span className="inline-flex items-center gap-1">
                <Link2 className="h-3 w-3 text-info" />
                → {col.fk_references}
              </span>
            ) : null}
            {col.distinct_count != null ? (
              <span>{col.distinct_count.toLocaleString()} distinct</span>
            ) : null}
          </div>
        </div>
      </div>

      {nullPct != null ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-text-muted">
            <span>Null ratio</span>
            <span>{nullPct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-surface">
            <div
              className={[
                "h-full rounded-full transition-all",
                nullPct > 20 ? "bg-warning" : "bg-accent",
              ].join(" ")}
              style={{ width: `${Math.min(nullPct, 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {col.sample_values?.length ? (
        <div className="mt-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Samples</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {col.sample_values.slice(0, 5).map((sample, i) => (
              <span
                key={i}
                className="rounded-md border border-border-subtle bg-bg-surface px-2 py-0.5 font-mono text-[11px] text-text-secondary"
              >
                {sample}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

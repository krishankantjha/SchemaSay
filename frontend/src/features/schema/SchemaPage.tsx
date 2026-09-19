import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Key, Link2, RefreshCw, Search, Shield, Table2, GitBranch } from "lucide-react";
import { markExploreStepComplete } from "@/lib/onboarding";
import { useOnboardingStatus } from "@/features/onboarding/useOnboardingStatus";
import { ApiError } from "@/lib/api/client";
import { schemaApi } from "@/lib/api/endpoints";
import type { SchemaColumnNode, SchemaTableNode } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import { ConnectionRequired } from "@/components/shared/ConnectionRequired";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PageListSkeleton, StatRowSkeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

type ColumnFilter = "all" | "pk" | "fk" | "pii";

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
  const { steps, currentStep } = useOnboardingStatus();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const [columnFilter, setColumnFilter] = useState<ColumnFilter>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const { data, isLoading, isError: schemaLoadFailed } = useQuery({
    queryKey: ["schema-tree", activeConnectionId],
    queryFn: () => schemaApi.tree(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  const tables = data?.tables ?? [];

  useEffect(() => {
    if (tables.length > 0) {
      markExploreStepComplete();
    }
  }, [tables.length]);

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

  const relationships = useMemo(() => {
    const edges: { from: string; to: string; column: string }[] = [];
    for (const t of tables) {
      for (const col of t.columns) {
        if (col.is_foreign_key && col.fk_references) {
          edges.push({ from: `${t.name}.${col.name}`, to: col.fk_references, column: col.name });
        }
      }
    }
    return edges;
  }, [tables]);

  const filteredColumns = useMemo(() => {
    if (!table) return [];
    let cols = table.columns;
    const q = columnSearch.toLowerCase().trim();
    if (q) {
      cols = cols.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.data_type.toLowerCase().includes(q) ||
          (c.fk_references?.toLowerCase().includes(q) ?? false),
      );
    }
    if (columnFilter === "pk") cols = cols.filter((c) => c.is_primary_key);
    if (columnFilter === "fk") cols = cols.filter((c) => c.is_foreign_key);
    if (columnFilter === "pii") cols = cols.filter((c) => c.is_pii);
    return cols;
  }, [table, columnSearch, columnFilter]);

  const stats = useMemo(() => {
    const piiCount = tables.reduce((n, t) => n + t.columns.filter((c) => c.is_pii).length, 0);
    const fkCount = tables.reduce((n, t) => n + t.columns.filter((c) => c.is_foreign_key).length, 0);
    const totalRows = tables.reduce((n, t) => n + (t.row_count ?? 0), 0);
    return { tableCount: tables.length, piiCount, fkCount, totalRows };
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
    <PageShell width="wide">
      <PageHeader
        title="Schema Explorer"
        description={`${activeConnection?.name ?? "Connection"} · tables, keys, types, and relationships`}
        actions={
          <>
            {tables.length > 0 && currentStep === "ask" && !steps.ask ? (
              <Link to="/ask" className="no-underline">
                <Button size="sm">Ask a question</Button>
              </Link>
            ) : null}
            <Tooltip content="Refresh tables and columns from the database">
              <Button variant="secondary" size="sm" onClick={() => void sync(false)} loading={syncing}>
                <RefreshCw className="h-3.5 w-3.5" />
                Sync
              </Button>
            </Tooltip>
            <Tooltip content="Also profile null ratios, distinct counts, and sample values">
              <Button variant="secondary" size="sm" onClick={() => void sync(true)} disabled={syncing}>
                Deep sync
              </Button>
            </Tooltip>
          </>
        }
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {schemaLoadFailed && !error ? (
        <Alert variant="danger">Could not load cached schema. Sync to refresh from your database.</Alert>
      ) : null}

      {isLoading ? (
        <>
          <StatRowSkeleton count={4} />
          <PageListSkeleton rows={3} />
        </>
      ) : (
        <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tables" value={stats.tableCount} icon={Table2} />
        <StatCard label="Total rows" value={stats.totalRows.toLocaleString()} />
        <StatCard label="Foreign keys" value={stats.fkCount} icon={Link2} />
        <StatCard
          label="PII columns"
          value={stats.piiCount}
          icon={Shield}
          variant={stats.piiCount > 0 ? "warning" : "default"}
        />
      </div>

      {!tables.length ? (
        <EmptyState
          icon={Table2}
          title="No schema cached"
          description="Sync your database to load tables, columns, and relationships before exploring."
          compact
          action={
            <Button loading={syncing} onClick={() => void sync(false)}>
              <RefreshCw className="h-4 w-4" />
              Sync schema
            </Button>
          }
          secondaryAction={
            <Link to="/connections" className="no-underline">
              <Button variant="secondary">Manage connections</Button>
            </Link>
          }
        />
      ) : (
        <>
          {relationships.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-accent" aria-hidden />
                  <CardTitle>Relationships</CardTitle>
                </div>
                <CardDescription>
                  {relationships.length} foreign key{relationships.length === 1 ? "" : "s"} across your schema
                </CardDescription>
              </CardHeader>
              <div className="data-table-wrap max-h-48">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relationships.slice(0, 50).map((edge) => (
                      <tr key={edge.from}>
                        <td className="font-mono text-xs">{edge.from}</td>
                        <td className="font-mono text-xs text-info">{edge.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {relationships.length > 50 ? (
                <p className="mt-2 text-xs text-text-muted">Showing first 50 of {relationships.length}</p>
              ) : null}
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Card className="flex max-h-[60vh] flex-col p-0 lg:max-h-[72vh]">
              <div className="border-b border-border-subtle p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
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
                      setColumnFilter("all");
                    }}
                    className={cn(
                      "mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      table?.name === t.name
                        ? "bg-accent-muted font-medium text-accent"
                        : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
                    )}
                  >
                    <span className="truncate">{t.name}</span>
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
                columnFilter={columnFilter}
                viewMode={viewMode}
                onColumnSearchChange={setColumnSearch}
                onColumnFilterChange={setColumnFilter}
                onViewModeChange={setViewMode}
              />
            ) : null}
          </div>
        </>
      )}
        </>
      )}
    </PageShell>
  );
}

function TableDetail({
  table,
  columns,
  columnSearch,
  columnFilter,
  viewMode,
  onColumnSearchChange,
  onColumnFilterChange,
  onViewModeChange,
}: {
  table: SchemaTableNode;
  columns: SchemaColumnNode[];
  columnSearch: string;
  columnFilter: ColumnFilter;
  viewMode: "cards" | "table";
  onColumnSearchChange: (v: string) => void;
  onColumnFilterChange: (v: ColumnFilter) => void;
  onViewModeChange: (v: "cards" | "table") => void;
}) {
  const piiInTable = table.columns.filter((c) => c.is_pii).length;
  const pkCount = table.columns.filter((c) => c.is_primary_key).length;
  const fkCount = table.columns.filter((c) => c.is_foreign_key).length;

  return (
    <Card className="max-h-[60vh] overflow-hidden p-0 lg:max-h-[72vh]">
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
            {pkCount > 0 ? <Badge variant="warning">{pkCount} PK</Badge> : null}
            {fkCount > 0 ? <Badge variant="info">{fkCount} FK</Badge> : null}
          </div>
          <CardDescription>
            {table.columns.length} columns
            {table.row_count != null ? ` · ${table.row_count.toLocaleString()} rows` : ""}
          </CardDescription>
        </CardHeader>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              className="h-9 pl-8 text-sm"
              placeholder="Filter columns…"
              value={columnSearch}
              onChange={(e) => onColumnSearchChange(e.target.value)}
            />
          </div>
          <SegmentedControl
            size="sm"
            ariaLabel="Filter columns"
            value={columnFilter}
            onChange={onColumnFilterChange}
            options={[
              { value: "all", label: "All" },
              { value: "pk", label: "PK" },
              { value: "fk", label: "FK" },
              { value: "pii", label: "PII" },
            ]}
          />
          <SegmentedControl
            size="sm"
            ariaLabel="Column view"
            value={viewMode}
            onChange={onViewModeChange}
            options={[
              { value: "table", label: "Table" },
              { value: "cards", label: "Cards" },
            ]}
          />
        </div>
      </div>

      <div className="overflow-y-auto p-4 pt-0">
        {!columns.length ? (
          <EmptyState
            title="No columns match"
            description="Try a different filter or search term."
            compact
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onColumnSearchChange("");
                  onColumnFilterChange("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : viewMode === "table" ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Type</th>
                  <th>Keys</th>
                  <th>Null %</th>
                  <th>Distinct</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col.name}>
                    <td className="font-medium">{col.name}</td>
                    <td>
                      <Badge>{col.data_type}</Badge>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {col.is_primary_key ? <Badge variant="warning">PK</Badge> : null}
                        {col.is_foreign_key ? <Badge variant="info">FK</Badge> : null}
                        {col.is_pii ? <Badge variant="pii">PII</Badge> : null}
                      </div>
                    </td>
                    <td className="tabular-nums text-text-muted">
                      {col.null_ratio != null ? `${(col.null_ratio * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="tabular-nums text-text-muted">
                      {col.distinct_count?.toLocaleString() ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <span className="inline-flex items-center gap-1 text-info">
                <Link2 className="h-3 w-3" />
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
              className={cn("h-full rounded-full", nullPct > 20 ? "bg-warning" : "bg-accent")}
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

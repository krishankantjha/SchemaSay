import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Key, Link2, RefreshCw, Search, Shield } from "lucide-react";
import type { SchemaTableNode } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type SchemaTreeSidebarProps = {
  tables: SchemaTableNode[];
  isLoading: boolean;
  loadFailed?: boolean;
  syncError?: string | null;
  onSync: (profile: boolean) => void;
  isSyncing: boolean;
  connectionName?: string;
  onInsertColumn?: (ref: string) => void;
};

export function SchemaTreeSidebar({
  tables,
  isLoading,
  loadFailed = false,
  syncError = null,
  onSync,
  isSyncing,
  connectionName,
  onInsertColumn,
}: SchemaTreeSidebarProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return tables;
    return tables
      .map((table) => {
        const tableMatch = table.name.toLowerCase().includes(q);
        const cols = table.columns.filter(
          (c) => c.name.toLowerCase().includes(q) || tableMatch,
        );
        if (tableMatch || cols.length) return { ...table, columns: tableMatch ? table.columns : cols };
        return null;
      })
      .filter(Boolean) as SchemaTableNode[];
  }, [tables, search]);

  function toggleTable(name: string) {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  return (
    <aside className="flex h-full flex-col border-r border-border-subtle bg-bg-surface">
      <div className="border-b border-border-subtle p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Schema</h2>
            {connectionName ? (
              <p className="text-[10px] text-text-muted">{connectionName}</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSync(false)}
            disabled={isSyncing}
            title="Read tables and columns from your connected database"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Sync
          </Button>
        </div>
        <p className="mb-2 text-[10px] leading-relaxed text-text-muted">
          Sync loads table and column names from your database so you can browse and ask questions.
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="Search tables…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {syncError ? (
          <div className="mb-2 flex gap-2 rounded-lg border border-danger/30 bg-[var(--color-danger-muted)] p-2.5">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
            <div>
              <p className="text-xs font-medium text-danger">Sync failed</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-danger/90">{syncError}</p>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <p className="p-2 text-xs text-text-muted">Loading cached schema…</p>
        ) : loadFailed ? (
          <p className="p-2 text-xs text-text-muted">
            Could not load cached schema. Click Sync to refresh from your database.
          </p>
        ) : !filtered.length ? (
          <div className="rounded-lg border border-dashed border-border-subtle p-3 text-center">
            <p className="text-xs font-medium text-text-secondary">
              {tables.length ? "No matches" : "No tables loaded yet"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
              {tables.length
                ? "Try a different search term."
                : "Click Sync above to read tables from your connected database."}
            </p>
            {!tables.length ? (
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => onSync(false)}
                disabled={isSyncing}
              >
                Sync now
              </Button>
            ) : null}
          </div>
        ) : (
          filtered.map((table) => {
            const isOpen = expanded[table.name] ?? true;
            return (
              <div key={table.name} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleTable(table.name)}
                  className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm text-text-primary hover:bg-bg-elevated"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                  )}
                  <span className="truncate font-medium">{table.name}</span>
                  {table.row_count != null ? (
                    <span className="ml-auto text-[10px] text-text-muted">{table.row_count}</span>
                  ) : null}
                </button>
                {isOpen ? (
                  <ul className="ml-4 border-l border-border-subtle pl-2">
                    {table.columns.map((col) => (
                      <li key={col.name}>
                        <button
                          type="button"
                          onClick={() => onInsertColumn?.(`${table.name}.${col.name}`)}
                          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                        >
                          <span className="truncate">{col.name}</span>
                          {col.is_primary_key ? (
                            <Key className="h-3 w-3 shrink-0 text-warning" />
                          ) : null}
                          {col.is_foreign_key ? (
                            <Link2 className="h-3 w-3 shrink-0 text-info" />
                          ) : null}
                          {col.is_pii ? (
                            <Shield className="h-3 w-3 shrink-0 text-pii" />
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

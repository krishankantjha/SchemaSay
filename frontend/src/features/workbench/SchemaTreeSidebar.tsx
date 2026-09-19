import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type RefObject,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsLeft,
  ChevronsUpDown,
  Columns3,
  Hash,
  Plus,
  RefreshCw,
  Search,
  Table2,
  ToggleLeft,
  Type,
  X,
} from "lucide-react";
import type { SchemaColumnNode, SchemaTableNode } from "@/lib/api/types";
import {
  computeFilterCounts,
  filterSchemaTables,
  type SchemaFilterMode,
} from "@/lib/schema-search";
import { SchemaSyncStatus } from "@/features/workbench/SchemaSyncStatus";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SchemaTreeSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

type SchemaTreeSidebarProps = {
  tables: SchemaTableNode[];
  isLoading: boolean;
  loadFailed?: boolean;
  syncError?: string | null;
  onSync: (profile: boolean) => void;
  isSyncing: boolean;
  lastSyncedAt?: number | null;
  syncSuccessAt?: number | null;
  connectionName?: string;
  onInsertColumn?: (ref: string) => void;
  onInsertTable?: (name: string) => void;
  onCollapse?: () => void;
};

const FILTER_LABELS: Record<SchemaFilterMode, string> = {
  all: "All",
  pk: "PK",
  fk: "FK",
  pii: "PII",
};

const VIRTUAL_THRESHOLD = 50;
const TABLE_ROW_HEIGHT = 44;
const COLUMN_ROW_HEIGHT = 36;

export const SchemaTreeSidebar = memo(function SchemaTreeSidebar({
  tables,
  isLoading,
  loadFailed = false,
  syncError = null,
  onSync,
  isSyncing,
  lastSyncedAt,
  syncSuccessAt,
  connectionName,
  onInsertColumn,
  onInsertTable,
  onCollapse,
}: SchemaTreeSidebarProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<SchemaFilterMode>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filterCounts = useMemo(() => computeFilterCounts(tables), [tables]);

  const { tables: filtered, tableCount, columnCount, matchedTableNames } = useMemo(
    () => filterSchemaTables(tables, search, filter),
    [tables, search, filter],
  );

  const isSearching = search.trim().length > 0 || filter !== "all";

  useEffect(() => {
    if (!isSearching) return;
    const next: Record<string, boolean> = {};
    filtered.forEach((t) => {
      next[t.name] = true;
    });
    setExpanded((prev) => ({ ...prev, ...next }));
  }, [filtered, isSearching]);

  function toggleTable(name: string) {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function expandAll() {
    const next: Record<string, boolean> = {};
    filtered.forEach((t) => {
      next[t.name] = true;
    });
    setExpanded(next);
  }

  function collapseAll() {
    setExpanded({});
  }

  function handleDragStart(e: DragEvent, ref: string) {
    e.dataTransfer.setData("text/plain", ref);
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <aside aria-label="Schema browser" className="flex h-full flex-col bg-transparent">
      <div className="space-y-2.5 border-b border-border-subtle p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="type-meta">Schema</h2>
            {connectionName ? (
              <p className="type-meta mt-0.5 truncate normal-case tracking-normal">{connectionName}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSync(false)}
              disabled={isSyncing}
              loading={isSyncing}
              title="Refresh tables and columns from your database"
            >
              <RefreshCw className="icon-sm" strokeWidth={2} />
              Sync
            </Button>
            {onCollapse ? (
              <button
                type="button"
                onClick={onCollapse}
                className="workbench-panel-toggle hidden lg:inline-flex"
                aria-label="Collapse schema panel"
                title="Collapse schema panel"
              >
                <ChevronsLeft className="icon-sm" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <SchemaSyncStatus
          isSyncing={isSyncing}
          syncError={syncError}
          lastSyncedAt={lastSyncedAt}
          syncSuccessAt={syncSuccessAt}
          tableCount={tables.length || undefined}
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 icon-sm -translate-y-1/2 text-text-muted" strokeWidth={2} aria-hidden />
          <input
            type="search"
            className="control-base h-8 w-full pl-8 pr-8 text-xs"
            placeholder="Search tables & columns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search tables and columns"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-text-muted hover:bg-bg-elevated hover:text-text-secondary"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>

        {isSearching ? (
          <p className="text-[11px] text-text-muted" aria-live="polite">
            {tableCount} table{tableCount === 1 ? "" : "s"}
            {columnCount > 0 ? ` · ${columnCount} column${columnCount === 1 ? "" : "s"}` : ""}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1" role="group" aria-label="Column filters">
          {(["all", "pk", "fk", "pii"] as SchemaFilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilter(mode)}
              aria-pressed={filter === mode}
              className={cn(
                "inline-flex min-h-[28px] items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide pressable",
                filter === mode
                  ? "bg-accent-muted text-accent ring-1 ring-accent/25"
                  : "text-text-muted hover:bg-bg-elevated hover:text-text-secondary",
              )}
            >
              {FILTER_LABELS[mode]}
              <span className="tabular-nums opacity-70">{filterCounts[mode]}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={expandAll}>
            <ChevronsUpDown className="h-3 w-3" strokeWidth={2} aria-hidden />
            Expand
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={collapseAll}>
            <ChevronsDownUp className="h-3 w-3" strokeWidth={2} aria-hidden />
            Collapse
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain p-2 touch-pan-y"
      >
        {isLoading ? (
          <SchemaTreeSkeleton />
        ) : loadFailed ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-border-subtle px-2.5 py-2 text-center">
            <p className="text-xs font-medium text-text-secondary">Could not load schema</p>
            <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
              Sync to refresh from your database.
            </p>
            <Button variant="secondary" size="sm" className="mt-1.5" onClick={() => onSync(false)} loading={isSyncing}>
              Sync now
            </Button>
          </div>
        ) : !filtered.length ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-border-subtle px-2.5 py-2 text-center">
            <Table2 className="mx-auto h-5 w-5 text-text-muted" strokeWidth={1.75} aria-hidden />
            <p className="mt-1 text-xs font-medium text-text-secondary">
              {tables.length ? "No matches" : "No tables loaded yet"}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
              {tables.length ? "Try different keywords." : "Sync to load tables and columns."}
            </p>
            {!tables.length ? (
              <Button variant="secondary" size="sm" className="mt-1.5" onClick={() => onSync(false)} loading={isSyncing}>
                Sync now
              </Button>
            ) : null}
          </div>
        ) : filtered.length >= VIRTUAL_THRESHOLD ? (
          <VirtualSchemaTableList
            scrollRef={scrollRef}
            tables={filtered}
            expanded={expanded}
            matchedTableNames={matchedTableNames}
            search={search}
            onToggleTable={toggleTable}
            onInsertTable={onInsertTable}
            onInsertColumn={onInsertColumn}
            onDragStart={handleDragStart}
          />
        ) : (
          filtered.map((table) => (
            <SchemaTableRow
              key={table.name}
              table={table}
              isOpen={expanded[table.name] ?? matchedTableNames.has(table.name)}
              search={search}
              onToggle={() => toggleTable(table.name)}
              onInsertTable={onInsertTable}
              onInsertColumn={onInsertColumn}
              onDragStart={handleDragStart}
            />
          ))
        )}
      </div>

      <p className="border-t border-border-subtle px-3 py-2 text-[10px] leading-relaxed text-text-muted">
        Drag or click + to insert into your question.
      </p>
    </aside>
  );
});

function estimateTableHeight(
  table: SchemaTableNode,
  isOpen: boolean,
): number {
  return isOpen ? TABLE_ROW_HEIGHT + table.columns.length * COLUMN_ROW_HEIGHT + 8 : TABLE_ROW_HEIGHT;
}

function SchemaTableRow({
  table,
  isOpen,
  search,
  onToggle,
  onInsertTable,
  onInsertColumn,
  onDragStart,
}: {
  table: SchemaTableNode;
  isOpen: boolean;
  search: string;
  onToggle: () => void;
  onInsertTable?: (name: string) => void;
  onInsertColumn?: (ref: string) => void;
  onDragStart: (e: DragEvent, ref: string) => void;
}) {
  const colCount = table.columns.length;

  return (
    <div className="mb-1">
      <div className="flex items-stretch gap-0.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={`schema-table-${table.name}`}
          className={cn(
            "flex min-h-[40px] min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-left",
            "transition-colors duration-fast hover:bg-bg-elevated",
            isOpen && "bg-bg-elevated/60",
          )}
        >
          {isOpen ? (
            <ChevronDown className="icon-sm shrink-0 text-text-muted" strokeWidth={2} aria-hidden />
          ) : (
            <ChevronRight className="icon-sm shrink-0 text-text-muted" strokeWidth={2} aria-hidden />
          )}
          <Table2 className="icon-sm shrink-0 text-accent" strokeWidth={2} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
            <HighlightText text={table.name} query={search} />
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-text-muted">
            {colCount}c
            {table.row_count != null ? ` · ${table.row_count.toLocaleString()}r` : ""}
          </span>
        </button>
        <button
          type="button"
          draggable
          onDragStart={(e) => onDragStart(e, table.name)}
          onClick={() => onInsertTable?.(table.name)}
          title="Insert table name"
          aria-label={`Insert table ${table.name}`}
          className="flex w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-text-muted transition-colors duration-fast hover:bg-accent-muted hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>
      </div>
      {isOpen ? (
        <ul
          id={`schema-table-${table.name}`}
          className="ml-4 mt-0.5 animate-reveal border-l border-border-subtle pl-2"
        >
          {table.columns.map((col) => (
            <ColumnRow
              key={col.name}
              table={table.name}
              col={col}
              search={search}
              onInsert={() => onInsertColumn?.(`${table.name}.${col.name}`)}
              onDragStart={(e) => onDragStart(e, `${table.name}.${col.name}`)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function VirtualSchemaTableList({
  scrollRef,
  tables,
  expanded,
  matchedTableNames,
  search,
  onToggleTable,
  onInsertTable,
  onInsertColumn,
  onDragStart,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  tables: SchemaTableNode[];
  expanded: Record<string, boolean>;
  matchedTableNames: Set<string>;
  search: string;
  onToggleTable: (name: string) => void;
  onInsertTable?: (name: string) => void;
  onInsertColumn?: (ref: string) => void;
  onDragStart: (e: DragEvent, ref: string) => void;
}) {
  const virtualizer = useVirtualizer({
    count: tables.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const table = tables[index]!;
      const isOpen = expanded[table.name] ?? matchedTableNames.has(table.name);
      return estimateTableHeight(table, isOpen);
    },
    overscan: 6,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [expanded, matchedTableNames, tables, virtualizer]);

  return (
    <div
      className="relative w-full"
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualizer.getVirtualItems().map((item) => {
        const table = tables[item.index]!;
        const isOpen = expanded[table.name] ?? matchedTableNames.has(table.name);
        return (
          <div
            key={table.name}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${item.start}px)` }}
          >
            <SchemaTableRow
              table={table}
              isOpen={isOpen}
              search={search}
              onToggle={() => onToggleTable(table.name)}
              onInsertTable={onInsertTable}
              onInsertColumn={onInsertColumn}
              onDragStart={onDragStart}
            />
          </div>
        );
      })}
    </div>
  );
}

function ColumnRow({
  table,
  col,
  search,
  onInsert,
  onDragStart,
}: {
  table: string;
  col: SchemaColumnNode;
  search: string;
  onInsert: () => void;
  onDragStart: (e: DragEvent) => void;
}) {
  const TypeIcon = columnTypeIcon(col.data_type);

  return (
    <li>
      <button
        type="button"
        draggable
        onDragStart={onDragStart}
        onClick={onInsert}
        title={`${table}.${col.name} (${col.data_type})${col.fk_references ? ` → ${col.fk_references}` : ""}`}
        className={cn(
          "group flex w-full items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-left",
          "text-text-secondary transition-colors duration-fast hover:bg-bg-elevated hover:text-text-primary",
          "cursor-grab active:cursor-grabbing",
        )}
      >
        <Columns3 className="icon-sm shrink-0 text-text-muted group-hover:text-text-secondary" strokeWidth={2} aria-hidden />
        <TypeIcon className="h-3 w-3 shrink-0 text-text-muted" strokeWidth={2} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs">
          <HighlightText text={col.name} query={search} />
        </span>
        <TypeBadge type={col.data_type} />
        {col.is_primary_key ? (
          <Badge variant="warning" className="shrink-0 px-1 py-0 text-[9px] leading-none">
            PK
          </Badge>
        ) : null}
        {col.is_foreign_key ? (
          <Badge variant="accent" className="shrink-0 px-1 py-0 text-[9px] leading-none">
            FK
          </Badge>
        ) : null}
        {col.is_pii ? (
          <Badge variant="pii" className="shrink-0 px-1 py-0 text-[9px] leading-none">
            PII
          </Badge>
        ) : null}
      </button>
    </li>
  );
}

function columnTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("int") || t.includes("decimal") || t.includes("numeric") || t.includes("float") || t.includes("double")) {
    return Hash;
  }
  if (t.includes("bool")) return ToggleLeft;
  if (t.includes("date") || t.includes("time")) return Calendar;
  if (t.includes("char") || t.includes("text") || t.includes("json")) return Type;
  return Hash;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="default" className="shrink-0 px-1.5 py-0 font-mono text-[9px] leading-none">
      {abbrevType(type)}
    </Badge>
  );
}

function abbrevType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("int")) return "int";
  if (t.includes("char") || t.includes("text")) return "str";
  if (t.includes("bool")) return "bool";
  if (t.includes("date") || t.includes("time")) return "date";
  if (t.includes("decimal") || t.includes("numeric") || t.includes("float") || t.includes("double")) {
    return "num";
  }
  return type.slice(0, 6);
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="schema-highlight">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

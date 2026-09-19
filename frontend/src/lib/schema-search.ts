import type { SchemaColumnNode, SchemaTableNode } from "@/lib/api/types";

export type SchemaFilterMode = "all" | "pk" | "fk" | "pii";

export type FilterCounts = Record<SchemaFilterMode, number>;

export type FilteredSchema = {
  tables: SchemaTableNode[];
  tableCount: number;
  columnCount: number;
  matchedTableNames: Set<string>;
};

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function columnMatchesTokens(col: SchemaColumnNode, tokens: string[]): boolean {
  const haystack = `${col.name} ${col.data_type}`.toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

function tableMatchesTokens(table: SchemaTableNode, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const nameMatch = tokens.every((t) => table.name.toLowerCase().includes(t));
  if (nameMatch) return true;
  return table.columns.some((col) => columnMatchesTokens(col, tokens));
}

function columnPassesFilter(col: SchemaColumnNode, filter: SchemaFilterMode): boolean {
  if (filter === "pk") return col.is_primary_key;
  if (filter === "fk") return col.is_foreign_key;
  if (filter === "pii") return col.is_pii;
  return true;
}

export function computeFilterCounts(tables: SchemaTableNode[]): FilterCounts {
  let pk = 0;
  let fk = 0;
  let pii = 0;
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.is_primary_key) pk += 1;
      if (col.is_foreign_key) fk += 1;
      if (col.is_pii) pii += 1;
    }
  }
  return { all: tables.length, pk, fk, pii };
}

export function filterSchemaTables(
  tables: SchemaTableNode[],
  query: string,
  filter: SchemaFilterMode,
): FilteredSchema {
  const tokens = tokenize(query);
  const matchedTableNames = new Set<string>();
  let columnCount = 0;

  const filtered = tables
    .map((table) => {
      const tableMatch = tableMatchesTokens(table, tokens);
      if (!tableMatch && tokens.length) return null;

      let columns = table.columns;
      if (tokens.length && !tokens.every((t) => table.name.toLowerCase().includes(t))) {
        columns = columns.filter((col) => columnMatchesTokens(col, tokens));
      }
      if (filter !== "all") {
        columns = columns.filter((col) => columnPassesFilter(col, filter));
      }

      if (!columns.length && filter !== "all") return null;
      if (!tableMatch && !columns.length) return null;

      matchedTableNames.add(table.name);
      columnCount += columns.length;

      const nameFullyMatches =
        tokens.length > 0 && tokens.every((t) => table.name.toLowerCase().includes(t));
      const showAllColumns = (nameFullyMatches || !tokens.length) && filter === "all";
      return {
        ...table,
        columns: showAllColumns ? table.columns : columns,
      };
    })
    .filter(Boolean) as SchemaTableNode[];

  filtered.sort((a, b) => a.name.localeCompare(b.name));

  return {
    tables: filtered,
    tableCount: filtered.length,
    columnCount,
    matchedTableNames,
  };
}

export function formatSyncFreshness(timestamp: number | null | undefined): string {
  if (!timestamp) return "Not synced";
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just synced";
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Synced ${days}d ago`;
}

export function syncFreshnessTone(
  timestamp: number | null | undefined,
): "success" | "warning" | "muted" {
  if (!timestamp) return "warning";
  const hours = (Date.now() - timestamp) / 3_600_000;
  if (hours < 24) return "success";
  if (hours < 168) return "muted";
  return "warning";
}

import { memo, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Download, Search, X } from "lucide-react";
import { useToast } from "@/app/ToastContext";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

const LARGE_DATASET_NOTE = 500;

type DataTableProps = {
  rows: Record<string, unknown>[];
  pageSize?: number;
  maxHeight?: string;
  caption?: string;
  highlightColumn?: string | null;
};

type SortDir = "asc" | "desc";

export const DataTable = memo(function DataTable({
  rows,
  pageSize = 25,
  maxHeight = "420px",
  caption = "Query results",
  highlightColumn = null,
}: DataTableProps) {
  const { push: toast } = useToast();
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState("");
  const [filterCol, setFilterCol] = useState<string>("all");

  const columns = useMemo(() => (rows.length ? Object.keys(rows[0]) : []), [rows]);
  const numericCols = useMemo(() => detectNumericColumns(rows, columns), [rows, columns]);

  useEffect(() => {
    setPage(0);
    setFilter("");
    setFilterCol("all");
    setSortCol(null);
    setSortDir("asc");
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const keys = filterCol === "all" ? columns : [filterCol];
      return keys.some((col) => formatCell(row[col]).toLowerCase().includes(q));
    });
  }, [rows, filter, filterCol, columns]);

  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows;
    return [...filteredRows].sort((a, b) => compareValues(a[sortCol], b[sortCol], sortDir));
  }, [filteredRows, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sortedRows.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const isFiltered = Boolean(filter.trim());

  useEffect(() => {
    setPage(0);
  }, [filter, filterCol, sortCol, sortDir]);

  if (!rows.length) {
    return (
      <EmptyState
        title="No rows returned"
        description="The query completed but returned an empty result set."
        compact
      />
    );
  }

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function copyCell(value: unknown, col: string) {
    void navigator.clipboard.writeText(formatCell(value));
    toast(`Copied ${col}`, "success");
  }

  function copyCsv() {
    void navigator.clipboard.writeText(toCsv(columns, sortedRows));
    toast("Copied to clipboard", "success");
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(columns, sortedRows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "results.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("Download started", "success");
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(sortedRows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "results.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Download started", "success");
  }

  function sortAria(col: string): "ascending" | "descending" | "none" {
    if (sortCol !== col) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

  const from = sortedRows.length ? safePage * pageSize + 1 : 0;
  const to = Math.min((safePage + 1) * pageSize, sortedRows.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-text-muted" aria-live="polite">
          {isFiltered
            ? `${sortedRows.length.toLocaleString()} of ${rows.length.toLocaleString()} rows`
            : `${rows.length.toLocaleString()} row${rows.length === 1 ? "" : "s"}`}
          {sortedRows.length
            ? ` · showing ${from.toLocaleString()}–${to.toLocaleString()}`
            : ""}
          {sortCol ? ` · sorted by ${sortCol}` : ""}
        </span>
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={copyCsv} aria-label="Copy rows as CSV">
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadCsv} aria-label="Download rows as CSV">
            <Download className="h-3.5 w-3.5" aria-hidden />
            CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadJson} aria-label="Download rows as JSON">
            <Download className="h-3.5 w-3.5" aria-hidden />
            JSON
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter rows…"
            aria-label="Filter results"
            className="control-base h-[var(--control-height-sm)] w-full pl-8 pr-8 text-xs placeholder:text-text-muted"
          />
          {filter ? (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              aria-label="Clear filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
        <select
          value={filterCol}
          onChange={(e) => setFilterCol(e.target.value)}
          aria-label="Filter column"
          className="control-base h-[var(--control-height-sm)] w-auto min-w-[8rem] px-2 text-xs"
        >
          <option value="all">All columns</option>
          {columns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      </div>

      {rows.length >= LARGE_DATASET_NOTE ? (
        <p className="text-[11px] text-text-muted" role="note">
          Large result set — showing {pageSize} rows per page.
        </p>
      ) : null}

      {sortedRows.length === 0 ? (
        <EmptyState
          title="No matching rows"
          description="Try a different filter or clear the search to see all results."
          compact
          action={
            <Button size="sm" variant="secondary" onClick={() => setFilter("")}>
              Clear filter
            </Button>
          }
        />
      ) : (
        <>
          <div className="data-table-wrap touch-pan-x" style={{ maxHeight }}>
            <table className="data-table" aria-label={caption} aria-rowcount={sortedRows.length}>
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className={cn(highlightColumn === col && "text-accent")}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        aria-label={`Sort by ${col}`}
                        aria-sort={sortAria(col)}
                        className={cn(
                          "group inline-flex min-h-[44px] items-center gap-1 transition-colors hover:text-text-primary",
                          sortCol === col && "text-accent",
                        )}
                      >
                        {col}
                        {sortCol === col ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3" aria-hidden />
                          ) : (
                            <ArrowDown className="h-3 w-3" aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" aria-hidden />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr key={`${safePage}-${i}`}>
                    {columns.map((col) => {
                      const value = row[col];
                      const isNull = value === null || value === undefined;
                      const formatted = formatCell(value);
                      return (
                        <td
                          key={col}
                          className={cn(
                            numericCols.has(col) && "text-right",
                            highlightColumn === col && "bg-accent-muted/40",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => copyCell(value, col)}
                            aria-label={`Copy ${col}: ${formatted}`}
                            className={cn(
                              "max-w-[280px] truncate text-left transition-colors hover:text-accent",
                              "min-h-[44px] min-w-[44px] py-2",
                              numericCols.has(col) && "w-full text-right",
                              isNull && "null-cell italic text-text-muted",
                            )}
                          >
                            {formatted}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <nav className="flex items-center justify-end gap-2" aria-label="Results pagination">
              <Button
                variant="secondary"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
              >
                Previous
              </Button>
              <span className="text-xs text-text-muted" aria-current="page">
                Page {safePage + 1} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                Next
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
});

function detectNumericColumns(rows: Record<string, unknown>[], columns: string[]): Set<string> {
  const set = new Set<string>();
  for (const col of columns) {
    let sawValue = false;
    let allNumeric = true;
    for (const row of rows.slice(0, 40)) {
      const value = row[col];
      if (value === null || value === undefined) continue;
      sawValue = true;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        allNumeric = false;
        break;
      }
    }
    if (sawValue && allNumeric) set.add(col);
  }
  return set;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.join(",");
  const body = rows
    .map((row) => columns.map((c) => csvEscape(formatCell(row[c]))).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function compareValues(a: unknown, b: unknown, dir: SortDir): number {
  const mul = dir === "asc" ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * mul;
  return String(a).localeCompare(String(b), undefined, { numeric: true }) * mul;
}

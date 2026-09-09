import { useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";
import { useToast } from "@/app/ToastContext";
import { Button } from "@/components/ui/Button";

type DataTableProps = {
  rows: Record<string, unknown>[];
  pageSize?: number;
};

export function DataTable({ rows, pageSize = 25 }: DataTableProps) {
  const { push: toast } = useToast();
  const [page, setPage] = useState(0);

  const columns = useMemo(() => (rows.length ? Object.keys(rows[0]) : []), [rows]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  if (!rows.length) {
    return <p className="text-sm text-text-muted">No rows returned.</p>;
  }

  function copyCsv() {
    const header = columns.join(",");
    const body = rows
      .map((row) => columns.map((c) => csvEscape(formatCell(row[c]))).join(","))
      .join("\n");
    void navigator.clipboard.writeText(`${header}\n${body}`);
    toast("Copied to clipboard", "success");
  }

  function downloadCsv() {
    const header = columns.join(",");
    const body = rows
      .map((row) => columns.map((c) => csvEscape(formatCell(row[c]))).join(","))
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "results.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("Download started", "success");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-text-muted">
          Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, rows.length)} of{" "}
          {rows.length}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={copyCsv}>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadCsv}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-border-subtle">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="border-b border-border-subtle bg-bg-elevated">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-secondary"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-b border-border-subtle/60 hover:bg-bg-elevated/50">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 font-mono text-xs tabular-nums text-text-primary">
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-text-muted">
            Page {safePage + 1} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

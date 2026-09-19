export type ResultStat = {
  label: string;
  value: string;
  column?: string;
};

function isNullish(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return null;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function isIdColumn(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === "id" || lower.endsWith("_id") || lower.endsWith("id");
}

/** Compact stats derived from the current result set, used to ground insight copy. */
export function deriveResultStats(rows: Record<string, unknown>[]): ResultStat[] {
  if (!rows.length) return [];

  const columns = Object.keys(rows[0]);
  const stats: ResultStat[] = [
    { label: "Rows", value: rows.length.toLocaleString() },
  ];

  const numericCols = columns.filter((col) => {
    if (isIdColumn(col)) return false;
    const sample = rows.map((r) => r[col]).filter((v) => !isNullish(v)).slice(0, 20);
    return sample.length > 0 && sample.every((v) => toNumber(v) !== null);
  });

  if (numericCols[0]) {
    const col = numericCols[0];
    const values = rows.map((r) => toNumber(r[col])).filter((v): v is number => v !== null);
    if (values.length) {
      const sum = values.reduce((a, b) => a + b, 0);
      const max = Math.max(...values);
      stats.push({ label: `Sum of ${col}`, value: formatNumber(sum), column: col });
      stats.push({ label: `Max ${col}`, value: formatNumber(max), column: col });
    }
  }

  const categoricalCols = columns.filter((col) => !numericCols.includes(col) && !isIdColumn(col));
  if (categoricalCols[0]) {
    const col = categoricalCols[0];
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = isNullish(row[col]) ? "" : String(row[col]);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let top: string | null = null;
    let topCount = 0;
    for (const [key, count] of counts) {
      if (count > topCount) {
        top = key;
        topCount = count;
      }
    }
    if (top) {
      stats.push({
        label: `Top ${col}`,
        value: `${top} (${topCount})`,
        column: col,
      });
    }
  }

  return stats.slice(0, 4);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

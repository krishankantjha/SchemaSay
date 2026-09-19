import type { ChartConfig } from "@/lib/api/types";

export type ChartKind = "table" | "line" | "bar" | "scatter" | "pie" | "histogram";

export type ResolvedChartConfig = {
  chart_type: ChartKind;
  x_axis?: string | null;
  y_axis?: string | null;
  color_axis?: string | null;
  source: "backend" | "inferred";
};

const TEMPORAL_HINTS = ["date", "time", "year", "month", "week", "day", "created", "updated", "timestamp"];
const PIE_INTENTS = ["percent", "percentage", "share", "proportion", "breakdown", "ratio", "composition"];
const HIST_INTENTS = ["distribution", "spread", "frequency", "range", "histogram"];

function isNullish(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return null;
}

function looksTemporal(name: string, values: unknown[]): boolean {
  const lower = name.toLowerCase();
  if (TEMPORAL_HINTS.some((h) => lower.includes(h))) return true;
  const sample = values.filter((v) => !isNullish(v)).slice(0, 8);
  if (!sample.length) return false;
  return sample.every((v) => {
    if (v instanceof Date) return true;
    if (typeof v !== "string") return false;
    const t = Date.parse(v);
    return Number.isFinite(t);
  });
}

function looksNumeric(name: string, values: unknown[]): boolean {
  const lower = name.toLowerCase();
  if (lower === "id" || lower.endsWith("_id") || lower.endsWith("id")) return false;
  const sample = values.filter((v) => !isNullish(v)).slice(0, 20);
  if (!sample.length) return false;
  return sample.every((v) => toNumber(v) !== null);
}

function classifyColumns(rows: Record<string, unknown>[]) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const temporal: string[] = [];
  const numeric: string[] = [];
  const categorical: string[] = [];

  for (const col of columns) {
    const values = rows.map((r) => r[col]);
    if (looksTemporal(col, values)) temporal.push(col);
    else if (looksNumeric(col, values)) numeric.push(col);
    else categorical.push(col);
  }

  return { columns, temporal, numeric, categorical };
}

function cardinality(rows: Record<string, unknown>[], col: string): number {
  return new Set(rows.map((r) => String(r[col] ?? "")).filter(Boolean)).size;
}

function inferChart(rows: Record<string, unknown>[], question: string): ResolvedChartConfig {
  if (!rows.length) return { chart_type: "table", source: "inferred" };

  const q = question.toLowerCase();
  const { temporal, numeric, categorical } = classifyColumns(rows);

  if (temporal.length && numeric.length) {
    return {
      chart_type: "line",
      x_axis: temporal[0],
      y_axis: numeric[0],
      color_axis: categorical[0] ?? null,
      source: "inferred",
    };
  }

  if (categorical.length && numeric.length) {
    const cat = categorical[0];
    const num = numeric[0];
    const card = cardinality(rows, cat);

    if (card < 10 && PIE_INTENTS.some((k) => q.includes(k))) {
      const nums = rows.map((r) => toNumber(r[num])).filter((v): v is number => v !== null);
      if (nums.length && nums.every((v) => v >= 0)) {
        return { chart_type: "pie", x_axis: cat, y_axis: num, source: "inferred" };
      }
    }

    if (card <= 30) {
      return { chart_type: "bar", x_axis: cat, y_axis: num, source: "inferred" };
    }
  }

  if (numeric.length >= 2) {
    return {
      chart_type: "scatter",
      x_axis: numeric[0],
      y_axis: numeric[1],
      color_axis: categorical[0] ?? null,
      source: "inferred",
    };
  }

  if (numeric.length === 1 && rows.length > 5 && HIST_INTENTS.some((k) => q.includes(k))) {
    return { chart_type: "histogram", x_axis: numeric[0], source: "inferred" };
  }

  if (categorical.length && numeric.length) {
    return { chart_type: "bar", x_axis: categorical[0], y_axis: numeric[0], source: "inferred" };
  }

  return { chart_type: "table", source: "inferred" };
}

const CHARTABLE: ChartKind[] = ["line", "bar", "scatter", "pie", "histogram"];

function isChartKind(value: string): value is ChartKind {
  return CHARTABLE.includes(value as ChartKind) || value === "table";
}

/** Prefer backend selection when it is chartable; otherwise infer from rows. */
export function resolveChartConfig(
  rows: Record<string, unknown>[],
  question: string,
  backend?: ChartConfig | null,
): ResolvedChartConfig {
  if (backend && isChartKind(backend.chart_type) && backend.chart_type !== "table") {
    const needsY = backend.chart_type !== "histogram";
    const hasAxes = Boolean(backend.x_axis) && (!needsY || Boolean(backend.y_axis));
    if (hasAxes) {
      return {
        chart_type: backend.chart_type,
        x_axis: backend.x_axis,
        y_axis: backend.y_axis,
        color_axis: backend.color_axis,
        source: "backend",
      };
    }
  }

  return inferChart(rows, question);
}

export function availableChartTypes(
  rows: Record<string, unknown>[],
  resolved: ResolvedChartConfig,
): ChartKind[] {
  const { temporal, numeric, categorical } = classifyColumns(rows);
  const types = new Set<ChartKind>();

  if (resolved.chart_type !== "table") types.add(resolved.chart_type);
  if ((categorical.length || temporal.length) && numeric.length) {
    types.add("bar");
    types.add("line");
    if (categorical.length && cardinality(rows, categorical[0]) < 12) types.add("pie");
  }
  if (numeric.length >= 2) types.add("scatter");
  if (numeric.length >= 1 && rows.length > 5) types.add("histogram");

  return [...types];
}

export function configForType(
  type: ChartKind,
  rows: Record<string, unknown>[],
  fallback: ResolvedChartConfig,
): ResolvedChartConfig {
  if (type === fallback.chart_type) return { ...fallback, chart_type: type };
  const { temporal, numeric, categorical } = classifyColumns(rows);

  if (type === "line") {
    return {
      chart_type: "line",
      x_axis: temporal[0] ?? categorical[0] ?? fallback.x_axis,
      y_axis: numeric[0] ?? fallback.y_axis,
      source: fallback.source,
    };
  }
  if (type === "bar" || type === "pie") {
    return {
      chart_type: type,
      x_axis: categorical[0] ?? temporal[0] ?? fallback.x_axis,
      y_axis: numeric[0] ?? fallback.y_axis,
      source: fallback.source,
    };
  }
  if (type === "scatter") {
    return {
      chart_type: "scatter",
      x_axis: numeric[0] ?? fallback.x_axis,
      y_axis: numeric[1] ?? numeric[0] ?? fallback.y_axis,
      source: fallback.source,
    };
  }
  if (type === "histogram") {
    return { chart_type: "histogram", x_axis: numeric[0] ?? fallback.x_axis, source: fallback.source };
  }
  return { chart_type: "table", source: fallback.source };
}

export function toNumeric(value: unknown): number {
  return toNumber(value) ?? 0;
}

export function histogramBins(
  values: number[],
  binCount = 10,
): { bin: string; count: number }[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ bin: formatTick(min), count: values.length }];

  const width = (max - min) / binCount || 1;
  const bins = Array.from({ length: binCount }, (_, i) => {
    const start = min + i * width;
    const end = start + width;
    return { bin: `${formatTick(start)}–${formatTick(end)}`, count: 0, start, end };
  });

  for (const value of values) {
    const index = Math.min(binCount - 1, Math.floor((value - min) / width));
    bins[index].count += 1;
  }

  return bins.map(({ bin, count }) => ({ bin, count }));
}

function formatTick(value: number): string {
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
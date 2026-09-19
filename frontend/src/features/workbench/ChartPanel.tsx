import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  ChartPie,
  ChartScatter,
  Download,
  LineChart as LineChartIcon,
  Maximize2,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartConfig } from "@/lib/api/types";
import { useToast } from "@/app/ToastContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { exportChartPng, exportCsv } from "@/lib/chart-export";
import {
  availableChartTypes,
  configForType,
  histogramBins,
  resolveChartConfig,
  toNumeric,
  type ChartKind,
  type ResolvedChartConfig,
} from "@/lib/chart-select";
import { cn } from "@/lib/utils";

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

type ChartPanelProps = {
  config: ChartConfig;
  rows: Record<string, unknown>[];
  question?: string;
};

export const ChartPanel = memo(function ChartPanel({ config, rows, question = "" }: ChartPanelProps) {
  const { push: toast } = useToast();
  const chartRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const resolved = useMemo(() => resolveChartConfig(rows, question, config), [rows, question, config]);
  const types = useMemo(() => availableChartTypes(rows, resolved), [rows, resolved]);
  const [viewMode, setViewMode] = useState<ChartKind>(resolved.chart_type);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setViewMode(resolved.chart_type);
  }, [resolved]);

  useBodyScrollLock(fullscreen);
  useFocusTrap(dialogRef, fullscreen);

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const activeConfig = useMemo(
    () => configForType(viewMode, rows, resolved),
    [viewMode, rows, resolved],
  );

  const data = useMemo(() => buildChartData(rows, activeConfig), [rows, activeConfig]);

  if (!rows.length || activeConfig.chart_type === "table" || !data.length) return null;

  const fullscreenHeight = Math.max(360, typeof window !== "undefined" ? window.innerHeight * 0.62 : 420);

  async function handleExportPng() {
    if (!chartRef.current) return;
    try {
      await exportChartPng(chartRef.current, "schemasay-chart.png");
      toast("Chart downloaded", "success");
    } catch {
      toast("Could not export chart", "error");
    }
  }

  function handleExportCsv() {
    const header = Object.keys(data[0] ?? {});
    exportCsv(
      "schemasay-chart.csv",
      header,
      data.map((row) => header.map((key) => String(row[key] ?? ""))),
    );
    toast("Chart data downloaded", "success");
  }

  const chartBody = (h: number) => (
    <ResponsiveContainer width="100%" height={h}>
      {renderChart(activeConfig, data)}
    </ResponsiveContainer>
  );

  return (
    <>
      <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Visualization
              </p>
              {viewMode === resolved.chart_type ? (
                <Badge variant="accent" className="normal-case">
                  Auto {activeConfig.chart_type}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] text-text-muted">
              {[activeConfig.x_axis, activeConfig.y_axis].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <div className="flex rounded-md border border-border-subtle p-0.5">
              {types.map((type) => (
                <ChartToggle
                  key={type}
                  active={viewMode === type}
                  onClick={() => setViewMode(type)}
                  type={type}
                />
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFullscreen(true)} aria-label="Open chart fullscreen">
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void handleExportPng()} aria-label="Export chart as PNG">
              <Download className="h-3.5 w-3.5" aria-hidden />
              PNG
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportCsv} aria-label="Export chart data as CSV">
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV
            </Button>
          </div>
        </div>
        <div ref={fullscreen ? undefined : chartRef} className="min-h-0">
          {chartBody(260)}
        </div>
      </div>

      {fullscreen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 motion-safe:animate-overlay-in">
          <button
            type="button"
            className="absolute inset-0 bg-bg-overlay/70 backdrop-blur-sm"
            aria-label="Close fullscreen chart"
            onClick={() => setFullscreen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Fullscreen chart"
            className="relative z-10 flex h-full max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-border-default bg-bg-surface p-4 shadow-2xl animate-dialog-in"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {activeConfig.chart_type} chart
                </p>
                <p className="text-[11px] text-text-muted">
                  {[activeConfig.x_axis, activeConfig.y_axis].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => void handleExportPng()}>
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  PNG
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setFullscreen(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div ref={chartRef} className="min-h-0 flex-1">
              {chartBody(fullscreenHeight)}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
});

function ChartToggle({
  active,
  onClick,
  type,
}: {
  active: boolean;
  onClick: () => void;
  type: ChartKind;
}) {
  const Icon =
    type === "line"
      ? LineChartIcon
      : type === "pie"
        ? ChartPie
        : type === "scatter"
          ? ChartScatter
          : BarChart3;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium capitalize transition-colors duration-fast",
        active
          ? "bg-accent-muted text-accent"
          : "text-text-muted hover:bg-bg-elevated hover:text-text-secondary",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {type}
    </button>
  );
}

function buildChartData(
  rows: Record<string, unknown>[],
  config: ResolvedChartConfig,
): Record<string, string | number>[] {
  if (config.chart_type === "histogram" && config.x_axis) {
    const values = rows.map((row) => toNumeric(row[config.x_axis!]));
    return histogramBins(values);
  }

  if (config.chart_type === "pie" && config.x_axis && config.y_axis) {
    const grouped = new Map<string, number>();
    for (const row of rows) {
      const key = String(row[config.x_axis] ?? "Unknown");
      grouped.set(key, (grouped.get(key) ?? 0) + toNumeric(row[config.y_axis]));
    }
    const entries = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 8);
    const rest = entries.slice(8).reduce((sum, [, v]) => sum + v, 0);
    const data = top.map(([name, value]) => ({ [config.x_axis!]: name, [config.y_axis!]: value }));
    if (rest) data.push({ [config.x_axis]: "Other", [config.y_axis]: rest });
    return data;
  }

  if (!config.x_axis) return [];

  return rows.map((row) => {
    const xValue =
      config.chart_type === "scatter" ? toNumeric(row[config.x_axis!]) : String(row[config.x_axis!] ?? "");
    const next: Record<string, string | number> = {
      [config.x_axis!]: xValue,
    };
    if (config.y_axis) next[config.y_axis] = toNumeric(row[config.y_axis]);
    return next;
  });
}

function renderChart(config: ResolvedChartConfig, data: Record<string, string | number>[]) {
  const xKey = config.chart_type === "histogram" ? "bin" : config.x_axis!;
  const yKey = config.chart_type === "histogram" ? "count" : config.y_axis!;

  if (config.chart_type === "pie") {
    return (
      <PieChart>
        <Tooltip content={<ChartTooltip xLabel={xKey} yLabel={yKey} />} />
        <Pie data={data} dataKey={yKey} nameKey={xKey} innerRadius={48} outerRadius={88} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    );
  }

  if (config.chart_type === "scatter") {
    return (
      <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          name={xKey}
          tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border-subtle)" }}
        />
        <YAxis
          dataKey={yKey}
          name={yKey}
          tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip content={<ChartTooltip xLabel={xKey} yLabel={yKey} />} />
        <Scatter data={data} fill="var(--color-chart-1)" isAnimationActive={false} />
      </ScatterChart>
    );
  }

  if (config.chart_type === "line") {
    return (
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border-subtle)" }}
        />
        <YAxis
          tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip content={<ChartTooltip xLabel={xKey} yLabel={yKey} />} />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-chart-1)" }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    );
  }

  return (
    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey={xKey}
        tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
        tickLine={false}
        axisLine={{ stroke: "var(--color-border-subtle)" }}
      />
      <YAxis
        tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        width={48}
      />
      <Tooltip content={<ChartTooltip xLabel={xKey} yLabel={yKey} />} />
      <Bar dataKey={yKey} fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
    </BarChart>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  xLabel,
  yLabel,
}: {
  active?: boolean;
  payload?: { value: number; payload?: Record<string, string | number> }[];
  label?: string;
  xLabel: string;
  yLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const xValue = label ?? payload[0]?.payload?.[xLabel];
  return (
    <div className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-text-primary">{String(xValue ?? "")}</p>
      <p className="mt-1 text-text-secondary">
        {yLabel}:{" "}
        <span className="font-mono tabular-nums text-text-primary">
          {typeof payload[0]?.value === "number"
            ? payload[0].value.toLocaleString()
            : String(payload[0]?.value ?? "")}
        </span>
      </p>
      <p className="text-[10px] text-text-muted">{xLabel}</p>
    </div>
  );
}

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartConfig } from "@/lib/api/types";

type ChartPanelProps = {
  config: ChartConfig;
  rows: Record<string, unknown>[];
};

export function ChartPanel({ config, rows }: ChartPanelProps) {
  if (!rows.length || config.chart_type === "table" || !config.x_axis) {
    return null;
  }

  const data = rows.map((row) => ({
    ...row,
    [config.x_axis!]: String(row[config.x_axis!] ?? ""),
    ...(config.y_axis
      ? { [config.y_axis]: Number(row[config.y_axis]) || 0 }
      : {}),
  }));

  const height = 220;

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">Chart</p>
      <ResponsiveContainer width="100%" height={height}>
        {config.chart_type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
            <XAxis dataKey={config.x_axis} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} />
            <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            {config.y_axis ? (
              <Line
                type="monotone"
                dataKey={config.y_axis}
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                dot={false}
              />
            ) : null}
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
            <XAxis dataKey={config.x_axis} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} />
            <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            {config.y_axis ? (
              <Bar dataKey={config.y_axis} fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
            ) : null}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

import type { MetricCreate, SchemaTableNode } from "@/lib/api/types";

export type MetricStarter = Omit<MetricCreate, "connection_id"> & {
  hint: string;
};

const PRICE_COLUMNS = ["price", "amount", "total_amount", "revenue", "total"];
const DATE_COLUMNS = ["created_at", "order_date", "date", "timestamp"];

function findColumn(table: SchemaTableNode, candidates: string[]): string | null {
  const names = new Set(table.columns.map((column) => column.name.toLowerCase()));
  for (const candidate of candidates) {
    if (names.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Suggest 3–5 KPI templates from synced schema table/column names.
 */
export function buildMetricStarters(tables: SchemaTableNode[]): MetricStarter[] {
  const starters: MetricStarter[] = [];

  for (const table of tables) {
    const priceCol = findColumn(table, PRICE_COLUMNS);
    if (priceCol) {
      starters.push({
        name: `${table.name}_revenue`,
        label: `Total ${table.name} revenue`,
        description: `Sum of ${priceCol} on ${table.name}`,
        sql_expression: `SUM(${table.name}.${priceCol})`,
        base_table: table.name,
        dimensions: [],
        hint: `Answers questions like "total revenue from ${table.name}"`,
      });
    }

    starters.push({
      name: `${table.name}_count`,
      label: `${table.name} count`,
      description: `Row count for ${table.name}`,
      sql_expression: `COUNT(*)`,
      base_table: table.name,
      dimensions: [],
      hint: `Answers "how many ${table.name}" without NL→SQL`,
    });

    const dateCol = findColumn(table, DATE_COLUMNS);
    if (priceCol && dateCol) {
      starters.push({
        name: `${table.name}_revenue_by_month`,
        label: `${table.name} revenue by month`,
        description: `Monthly ${priceCol} totals`,
        sql_expression: `SUM(${table.name}.${priceCol})`,
        base_table: table.name,
        dimensions: [
          {
            name: "month",
            label: "Month",
            column_ref: `${table.name}.${dateCol}`,
            dimension_type: "time",
          },
        ],
        hint: "Grouped time-series KPI",
      });
    }
  }

  const seen = new Set<string>();
  return starters.filter((starter) => {
    if (seen.has(starter.name)) return false;
    seen.add(starter.name);
    return true;
  }).slice(0, 5);
}

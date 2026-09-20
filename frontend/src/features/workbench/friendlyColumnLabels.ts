/** Map SQL column names to readable labels in simple Ask view. */
export function friendlyColumnLabel(column: string, question?: string): string {
  const lower = column.toLowerCase();
  const q = (question ?? "").toLowerCase();

  if (lower === "count(*)" || lower.startsWith("count(")) {
    if (/order/.test(q)) return "Total orders";
    if (/customer|user|buyer/.test(q)) return "Total customers";
    return "Count";
  }
  if (lower.startsWith("sum(")) {
    if (/revenue|sales|price|amount/.test(q)) return "Total";
    return "Sum";
  }
  if (lower.startsWith("avg(")) return "Average";
  if (lower.startsWith("min(")) return "Minimum";
  if (lower.startsWith("max(")) return "Maximum";

  return column.replace(/_/g, " ");
}

export function buildColumnLabelMap(
  columns: string[],
  question?: string,
): Record<string, string> {
  return Object.fromEntries(columns.map((col) => [col, friendlyColumnLabel(col, question)]));
}

import type { QueryExplanation } from "@/lib/api/types";

export function buildAnswerInterpretation(
  explanation: QueryExplanation | null | undefined,
  rowCount: number,
  columns: string[],
): string {
  if (explanation?.summary?.trim()) {
    return explanation.summary.trim();
  }

  const parts: string[] = [];
  if (explanation?.tables_used?.length) {
    parts.push(`Using ${explanation.tables_used.join(", ")}`);
  }
  parts.push(`${rowCount.toLocaleString()} row${rowCount === 1 ? "" : "s"}`);
  if (columns.length) {
    const preview = columns.slice(0, 4).join(", ");
    parts.push(`columns: ${preview}${columns.length > 4 ? ", …" : ""}`);
  }
  return parts.join(" · ");
}

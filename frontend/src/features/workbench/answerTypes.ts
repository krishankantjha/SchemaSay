import { isScalarResult } from "@/features/workbench/buildSimpleAnswer";

export type AnswerType = "scalar" | "small_table" | "large_table" | "empty";

const SMALL_TABLE_MAX = 10;

/** Classify query results for Ask layout rules. */
export function classifyAnswer(rows: Record<string, unknown>[]): AnswerType {
  if (!rows.length) return "empty";
  if (isScalarResult(rows)) return "scalar";
  if (rows.length <= SMALL_TABLE_MAX) return "small_table";
  return "large_table";
}

/** Whether the data table should be visible without clicking "Show data". */
export function shouldShowDataByDefault(rows: Record<string, unknown>[]): boolean {
  const type = classifyAnswer(rows);
  return type === "small_table" || type === "large_table";
}

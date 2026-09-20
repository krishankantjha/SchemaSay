import type { QueryExplanation } from "@/lib/api/types";

function formatValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

function extractCountSubject(question: string): string | null {
  const q = question.toLowerCase().trim();
  const patterns = [
    /how many ([a-z][a-z0-9_\s]*?)(?:\s+are there|\s+exist|\s+do we have)?[\?\.]?$/,
    /how many ([a-z][a-z0-9_\s]*?)[\?\.]?$/,
    /number of ([a-z][a-z0-9_\s]*?)[\?\.]?$/,
    /count of ([a-z][a-z0-9_\s]*?)[\?\.]?$/,
  ];
  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/\s+/g, " ");
    }
  }
  return null;
}

function isAggregateColumn(column: string): boolean {
  const lower = column.toLowerCase();
  return (
    lower.startsWith("count(") ||
    lower.startsWith("sum(") ||
    lower.startsWith("avg(") ||
    lower.startsWith("min(") ||
    lower.startsWith("max(")
  );
}

/** Backend summaries are for trust/audit — not user-facing headlines. */
export function isTechnicalSummary(summary: string): boolean {
  const trimmed = summary.trim();
  return (
    /^Answered '/i.test(trimmed) ||
    /using table\(s\):/i.test(trimmed) ||
    /^SELECT\b/i.test(trimmed)
  );
}

function buildAnswerFromRows(question: string, rows: Record<string, unknown>[]): string | null {
  if (rows.length === 1) {
    const keys = Object.keys(rows[0]);
    if (keys.length === 1) {
      const column = keys[0];
      const value = rows[0][column];
      const formatted = formatValue(value);
      const q = question.toLowerCase();

      if (/how many|number of|count of/.test(q) || isAggregateColumn(column)) {
        const subject = extractCountSubject(question) ?? "results";
        return `There are ${formatted} ${subject}.`;
      }
      if (/total|sum|revenue|sales|amount/.test(q) || /^sum\(/i.test(column)) {
        return `The total is ${formatted}.`;
      }
      if (/average|avg|mean/.test(q) || /^avg\(/i.test(column)) {
        return `The average is ${formatted}.`;
      }
      if (/maximum|max|highest|largest/.test(q) || /^max\(/i.test(column)) {
        return `The maximum is ${formatted}.`;
      }
      if (/minimum|min|lowest|smallest/.test(q) || /^min\(/i.test(column)) {
        return `The minimum is ${formatted}.`;
      }
      return `The answer is ${formatted}.`;
    }
  }

  if (rows.length > 1) {
    return `Found ${rows.length.toLocaleString()} results for your question.`;
  }

  return null;
}

/** Plain-English headline for Ask results. */
export function buildSimpleAnswer(
  question: string,
  rows: Record<string, unknown>[],
  explanation?: QueryExplanation | null,
): string | null {
  const fromRows = buildAnswerFromRows(question, rows);
  if (fromRows) return fromRows;

  const summary = explanation?.summary?.trim();
  if (summary && !isTechnicalSummary(summary)) {
    return summary;
  }

  return null;
}

export function buildSimpleInterpretation(explanation?: QueryExplanation | null): string {
  const tables = explanation?.tables_used?.filter(Boolean) ?? [];
  if (tables.length === 1) {
    return `This answer comes from your ${tables[0].replace(/_/g, " ")} data.`;
  }
  if (tables.length > 1) {
    return `This answer combines data from ${tables.map((t) => t.replace(/_/g, " ")).join(", ")}.`;
  }

  const summary = explanation?.summary?.trim();
  if (summary && !isTechnicalSummary(summary)) {
    return summary;
  }

  return "This answer was generated from your connected data.";
}

export function isScalarResult(rows: Record<string, unknown>[]): boolean {
  return rows.length === 1 && Object.keys(rows[0]).length === 1;
}

export function shouldHideAggregateTable(rows: Record<string, unknown>[], simpleView: boolean): boolean {
  if (!simpleView) return false;
  return isScalarResult(rows);
}

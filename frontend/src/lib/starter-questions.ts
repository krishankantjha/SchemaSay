import type { SchemaTableNode } from "@/lib/api/types";

const FALLBACK_QUESTIONS = [
  "How many rows are in the largest table?",
  "Show the 10 most recent records",
];

/**
 * Build starter Ask chips from synced schema table names.
 */
export function buildStarterQuestions(tables: SchemaTableNode[]): string[] {
  if (!tables.length) return FALLBACK_QUESTIONS;

  const names = new Set(tables.map((t) => t.name.toLowerCase()));
  const questions: string[] = [];

  if (names.has("orders")) {
    questions.push("How many orders exist?");
    questions.push("What is total revenue for orders?");
  }
  if (names.has("users")) {
    questions.push("How many users are there?");
  }
  if (names.has("products")) {
    questions.push("List all products");
  }
  if (names.has("order_items")) {
    questions.push("How many order items were sold?");
  }

  if (questions.length === 0) {
    const first = tables[0]?.name;
    if (first) {
      questions.push(`How many rows are in ${first}?`);
    }
    if (tables[1]) {
      questions.push(`Show the first 10 rows from ${tables[1].name}`);
    }
  }

  return questions.slice(0, 4);
}

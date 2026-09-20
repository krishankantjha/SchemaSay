export const FEEDBACK_CATEGORIES = [
  {
    id: "incomplete",
    label: "Missing part of the answer",
    description: "Didn't get the full breakdown or detail I needed",
  },
  {
    id: "not_what_i_meant",
    label: "Not what I meant",
    description: "Wrong metric, time period, or interpretation",
  },
  {
    id: "need_change",
    label: "Need a change or addition",
    description: "Add a filter, sort, group by, or extra column",
  },
  {
    id: "empty_or_too_much",
    label: "Too empty or too much data",
    description: "Zero rows or an overwhelming table",
  },
  {
    id: "other",
    label: "Something else",
    description: "Describe in your own words below",
  },
] as const;

export type FeedbackCategoryId = (typeof FEEDBACK_CATEGORIES)[number]["id"];

export function refineSuggestion(
  question: string,
  categories: FeedbackCategoryId[],
  comment?: string,
): string {
  const base = question.trim();
  const note = comment?.trim();
  if (!base) return note ?? "";

  if (categories.includes("incomplete")) {
    return note ? `${base} — ${note}` : `${base} — include more detail and breakdown`;
  }
  if (categories.includes("not_what_i_meant")) {
    return note ? `${base} (I meant: ${note})` : `Clarify: ${base}`;
  }
  if (categories.includes("need_change")) {
    return note ? `${base} — ${note}` : `${base} — with a different filter or grouping`;
  }
  if (categories.includes("empty_or_too_much")) {
    return note ? `${base} — ${note}` : `Broaden or narrow: ${base}`;
  }
  return note ? `${base} — ${note}` : `Refine: ${base}`;
}

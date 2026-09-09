import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { insightsApi } from "@/lib/api/endpoints";
import type { InsightRequest, InsightResponse } from "@/lib/api/types";

type GenerateInsightInput = {
  question: string;
  sql: string;
  rows: Record<string, unknown>[];
};

export function useInsightGeneration() {
  return useMutation({
    mutationFn: async (input: GenerateInsightInput): Promise<InsightResponse | null> => {
      if (!input.rows.length) return null;

      const payload: InsightRequest = {
        question: input.question,
        sql_query: input.sql,
        columns: Object.keys(input.rows[0]),
        rows: input.rows,
      };

      try {
        return await insightsApi.generate(payload);
      } catch (err) {
        const message = err instanceof ApiError ? err.detail : "Could not generate insight";
        return {
          insight: "",
          success: false,
          error: typeof message === "string" ? message : "Could not generate insight",
          correlation_id: null,
          usage_stats: null,
        };
      }
    },
  });
}

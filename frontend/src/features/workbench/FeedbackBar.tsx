import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { feedbackApi } from "@/lib/api/endpoints";
import type { QueryExplanation } from "@/lib/api/types";
import { buildAnswerInterpretation } from "@/features/workbench/buildAnswerInterpretation";
import {
  FEEDBACK_CATEGORIES,
  refineSuggestion,
  type FeedbackCategoryId,
} from "@/features/workbench/feedbackCategories";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

type FeedbackBarProps = {
  connectionId: number;
  question: string;
  generatedSql: string;
  correlationId?: string | null;
  explanation?: QueryExplanation | null;
  rowCount: number;
  columns: string[];
  onRefineQuestion?: (nextQuestion: string) => void;
  disabled?: boolean;
};

type SubmitRating = "thumbs_up" | "thumbs_down" | "corrected";

export function FeedbackBar({
  connectionId,
  question,
  generatedSql,
  correlationId,
  explanation,
  rowCount,
  columns,
  onRefineQuestion,
  disabled,
}: FeedbackBarProps) {
  const [phase, setPhase] = useState<"ask" | "negative_form" | "submitted">("ask");
  const [rating, setRating] = useState<SubmitRating | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<FeedbackCategoryId[]>([]);
  const [comment, setComment] = useState("");
  const [showAdvancedSql, setShowAdvancedSql] = useState(false);
  const [correctedSql, setCorrectedSql] = useState(generatedSql);
  const [message, setMessage] = useState("");
  const [refineHint, setRefineHint] = useState("");

  const interpretation = buildAnswerInterpretation(explanation, rowCount, columns);

  const mutation = useMutation({
    mutationFn: feedbackApi.create,
    onSuccess: (_, vars) => {
      setRating(vars.rating);
      setPhase("submitted");
      if (vars.rating === "thumbs_up") {
        setMessage("Glad that helped.");
      } else if (vars.rating === "corrected") {
        setMessage("Thanks — your SQL suggestion was saved.");
        setShowAdvancedSql(false);
      } else {
        setMessage("Thanks — we'll use this to improve answers.");
        setRefineHint(
          refineSuggestion(question, (vars.feedback_categories ?? []) as FeedbackCategoryId[]),
        );
      }
    },
    onError: (err) => {
      setMessage(err instanceof ApiError ? err.detail : "Failed to submit feedback");
    },
  });

  const locked = disabled || mutation.isPending || phase === "submitted";

  function toggleCategory(id: FeedbackCategoryId) {
    setSelectedCategories((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function submit(payload: Parameters<typeof feedbackApi.create>[0]) {
    setMessage("");
    mutation.mutate(payload);
  }

  function handleThumbsUp() {
    submit({
      connection_id: connectionId,
      rating: "thumbs_up",
      question,
      generated_sql: generatedSql,
      correlation_id: correlationId ?? undefined,
      result_row_count: rowCount,
      result_columns: columns,
    });
  }

  function handleNegativeSubmit() {
    if (!selectedCategories.length && !comment.trim()) {
      setMessage("Pick at least one reason or add a short note.");
      return;
    }
    submit({
      connection_id: connectionId,
      rating: "thumbs_down",
      question,
      generated_sql: generatedSql,
      correlation_id: correlationId ?? undefined,
      feedback_categories: selectedCategories,
      comment: comment.trim() || undefined,
      result_row_count: rowCount,
      result_columns: columns,
    });
  }

  function handleSqlCorrection() {
    if (!correctedSql.trim()) return;
    submit({
      connection_id: connectionId,
      rating: "corrected",
      question,
      generated_sql: generatedSql,
      corrected_sql: correctedSql,
      correlation_id: correlationId ?? undefined,
      comment: comment.trim() || undefined,
      feedback_categories: selectedCategories,
      result_row_count: rowCount,
      result_columns: columns,
    });
  }

  const showAliasHint =
    phase === "submitted" &&
    rating === "thumbs_down" &&
    selectedCategories.includes("not_what_i_meant");

  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <div className="rounded-md border border-accent/20 bg-accent-muted/20 px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
          How we interpreted your question
        </p>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">{interpretation}</p>
      </div>

      {phase === "ask" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-text-primary">Did this answer your question?</span>
          <Tooltip content="I have what I need">
            <Button
              variant="ghost"
              size="sm"
              disabled={locked}
              onClick={handleThumbsUp}
              loading={mutation.isPending}
            >
              <ThumbsUp className="h-4 w-4" />
              Yes
            </Button>
          </Tooltip>
          <Tooltip content="Still missing something or not what I needed">
            <Button
              variant="ghost"
              size="sm"
              disabled={locked}
              onClick={() => setPhase("negative_form")}
            >
              <ThumbsDown className="h-4 w-4" />
              Not yet
            </Button>
          </Tooltip>
        </div>
      ) : null}

      {phase === "negative_form" ? (
        <div className="animate-reveal space-y-3">
          <p className="text-sm font-medium text-text-primary">What&apos;s still off?</p>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_CATEGORIES.map((category) => {
              const selected = selectedCategories.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => toggleCategory(category.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-left text-xs transition-colors",
                    selected
                      ? "border-accent/40 bg-accent-muted text-text-primary"
                      : "border-border-subtle bg-bg-elevated text-text-secondary hover:border-border-default",
                  )}
                  title={category.description}
                >
                  {category.label}
                </button>
              );
            })}
          </div>

          <div>
            <Label htmlFor="feedback-comment">Anything else? (optional)</Label>
            <textarea
              id="feedback-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={2}
              placeholder="e.g. I expected a monthly breakdown, not a single total"
              className="control-base mt-1 min-h-[4.5rem] w-full p-2 text-sm"
              disabled={mutation.isPending}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleNegativeSubmit} loading={mutation.isPending}>
              Send feedback
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => {
                setPhase("ask");
                setMessage("");
              }}
            >
              Cancel
            </Button>
          </div>

          <div className="border-t border-border-subtle pt-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-xs font-medium text-text-muted"
              onClick={() => setShowAdvancedSql((value) => !value)}
            >
              Advanced: I know the SQL fix (optional)
              {showAdvancedSql ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
            {showAdvancedSql ? (
              <div className="mt-2 space-y-2 animate-reveal">
                <textarea
                  value={correctedSql}
                  onChange={(event) => setCorrectedSql(event.target.value)}
                  rows={4}
                  className="control-base min-h-[6rem] w-full p-2 font-mono text-xs"
                  aria-label="Corrected SQL"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={mutation.isPending || !correctedSql.trim()}
                  onClick={handleSqlCorrection}
                >
                  Submit SQL suggestion
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === "submitted" ? (
        <div className="animate-reveal space-y-3">
          <p className={cn("text-sm", mutation.isError ? "text-danger" : "text-success")} role="status">
            {message}
          </p>

          {rating === "thumbs_down" && refineHint && onRefineQuestion ? (
            <div className="rounded-md border border-border-subtle bg-bg-elevated/50 p-3">
              <p className="text-xs font-medium text-text-primary">Try refining your question</p>
              <p className="mt-1 text-xs text-text-secondary">{refineHint}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => onRefineQuestion(refineHint)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Use suggested wording
              </Button>
            </div>
          ) : null}

          {showAliasHint ? (
            <p className="text-xs text-text-muted">
              If names don&apos;t match your team&apos;s vocabulary, add{" "}
              <Link to="/connections" className="font-medium text-accent">
                business language aliases
              </Link>{" "}
              on the Connections page.
            </p>
          ) : null}
        </div>
      ) : null}

      {message && phase !== "submitted" ? (
        <p className={cn("text-xs", mutation.isError ? "text-danger" : "text-text-muted")} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { feedbackApi } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/Button";

type FeedbackBarProps = {
  connectionId: number;
  question: string;
  generatedSql: string;
  disabled?: boolean;
};

export function FeedbackBar({ connectionId, question, generatedSql, disabled }: FeedbackBarProps) {
  const [showCorrect, setShowCorrect] = useState(false);
  const [correctedSql, setCorrectedSql] = useState(generatedSql);
  const [message, setMessage] = useState("");

  const mutation = useMutation({
    mutationFn: feedbackApi.create,
    onSuccess: (_, vars) => {
      setMessage(
        vars.rating === "corrected" ? "Correction saved — thanks!" : "Feedback recorded. Thank you!",
      );
      setShowCorrect(false);
    },
    onError: (err) => {
      setMessage(err instanceof ApiError ? err.detail : "Failed to submit feedback");
    },
  });

  function submit(rating: "thumbs_up" | "thumbs_down" | "corrected", sql?: string) {
    setMessage("");
    mutation.mutate({
      connection_id: connectionId,
      rating,
      question,
      generated_sql: generatedSql,
      corrected_sql: sql,
    });
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-text-secondary">Was this correct?</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || mutation.isPending}
          onClick={() => submit("thumbs_up")}
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || mutation.isPending}
          onClick={() => submit("thumbs_down")}
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || mutation.isPending}
          onClick={() => {
            setCorrectedSql(generatedSql);
            setShowCorrect((v) => !v);
          }}
        >
          Suggest correction
        </Button>
        {message ? <span className="text-xs text-success">{message}</span> : null}
      </div>

      {showCorrect ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={correctedSql}
            onChange={(e) => setCorrectedSql(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border-default bg-bg-elevated p-2 font-mono text-xs text-text-primary focus:border-border-focus focus:outline-none"
          />
          <Button
            size="sm"
            disabled={mutation.isPending || !correctedSql.trim()}
            onClick={() => submit("corrected", correctedSql)}
          >
            Submit correction
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import { useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { GripVertical, Send, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { cn } from "@/lib/utils";

type AskComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  onCancel?: () => void;
  expanded?: boolean;
  compact?: boolean;
  placeholder?: string;
  /** Previous question shown above the input in follow-up mode. */
  contextQuestion?: string;
  className?: string;
};

export function AskComposer({
  value,
  onChange,
  onSubmit,
  loading = false,
  disabled = false,
  onCancel,
  expanded = false,
  compact = false,
  placeholder,
  contextQuestion,
  className,
}: AskComposerProps) {
  const [dragOver, setDragOver] = useState(false);
  const canSubmit = Boolean(value.trim()) && !loading && !disabled;
  const hint = placeholder ?? (compact ? "Ask a follow-up…" : "Ask anything about your data…");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (canSubmit) onSubmit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) onSubmit();
    }
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    setDragOver(false);
    const text = e.dataTransfer.getData("text/plain");
    if (!text) return;
    onChange(
      value.trim()
        ? `${value.trimEnd()}${value.endsWith(" ") || value.endsWith(",") ? "" : " "}${text}`
        : text,
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("shrink-0", className)}>
      {contextQuestion ? (
        <p className="mb-2 line-clamp-2 text-xs text-text-muted">
          <span className="font-medium text-text-secondary">Follow up on:</span> {contextQuestion}
        </p>
      ) : null}
      <div
        className={cn(
          "ask-composer group relative rounded-[var(--radius-lg)] border bg-bg-elevated/60",
          "border-border-default",
          dragOver &&
            "!border-accent !bg-accent-muted/20 !shadow-[0_0_0_3px_var(--state-focus-ring)]",
          disabled && "opacity-60",
        )}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onDragEnter={handleDragEnter}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          rows={compact ? 2 : expanded ? 4 : 3}
          disabled={disabled || loading}
          placeholder={hint}
          aria-label="Question"
          aria-busy={loading || undefined}
          className={cn(
            "w-full resize-none rounded-[var(--radius-lg)] bg-transparent px-4 text-sm leading-relaxed",
            "text-text-primary placeholder:text-text-muted",
            "focus:outline-none disabled:cursor-not-allowed",
            compact ? "min-h-[4.5rem] pt-3 pb-12" : expanded ? "min-h-[7.5rem] pt-4 pb-14" : "min-h-[6.25rem] pt-4 pb-14",
          )}
        />

        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center gap-2 rounded-t-[var(--radius-lg)]",
            "border-b border-transparent bg-accent-muted/0 py-2 opacity-0 transition-opacity duration-150",
            dragOver && "border-accent/20 bg-accent-muted/30 opacity-100",
          )}
          aria-hidden
        >
          <GripVertical className="icon-sm text-accent" strokeWidth={2} />
          <span className="text-xs font-medium text-accent">Drop table or column here</span>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 border-t border-border-subtle/80 px-3 py-2">
          <p className="hidden flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-muted sm:flex">
            <span className="inline-flex items-center gap-1">
              <Kbd>Enter</Kbd>
              <span>{compact ? "follow up" : "ask"}</span>
            </span>
            {!compact ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <Kbd>⇧ Enter</Kbd>
                  <span>new line</span>
                </span>
                <span className="text-text-muted/80">· drag from schema</span>
              </>
            ) : (
              <span className="text-text-muted/80">· refine this result</span>
            )}
          </p>
          {loading && onCancel ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="ml-auto"
              onClick={onCancel}
              aria-label="Cancel question"
            >
              <X className="icon-sm" strokeWidth={2} aria-hidden />
              Cancel
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              className="ml-auto"
              disabled={!canSubmit}
              loading={loading}
              aria-label={loading ? "Asking…" : "Ask question"}
            >
              <Send className="icon-sm" strokeWidth={2} aria-hidden />
              {loading ? "Asking…" : "Ask"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

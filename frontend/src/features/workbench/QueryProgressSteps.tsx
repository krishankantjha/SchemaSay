import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "analyze", label: "Analyzing" },
  { id: "generate", label: "Generating SQL" },
  { id: "validate", label: "Validating" },
  { id: "execute", label: "Executing" },
] as const;

type QueryProgressStepsProps = {
  active: boolean;
};

export function QueryProgressSteps({ active }: QueryProgressStepsProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setStepIndex((i) => (i < STEPS.length - 1 ? i + 1 : i));
    }, 850);
    return () => window.clearInterval(interval);
  }, [active]);

  if (!active) return null;

  const current = STEPS[stepIndex];

  return (
    <div
      className="mb-4 animate-reveal rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated/60 px-3 py-3 sm:px-4"
      role="status"
      aria-live="polite"
      aria-label={`Query in progress: ${current.label}`}
    >
      <p className="mb-3 text-sm font-medium text-text-primary">
        {current.label}
        <span className="font-normal text-text-muted">
          {stepIndex === 0
            ? " — reading your question and schema"
            : stepIndex === 1
              ? " — drafting a governed SELECT"
              : stepIndex === 2
                ? " — checking tables, columns, and policy"
                : " — running against your database"}
        </span>
      </p>

      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
        {STEPS.map((step, index) => {
          const done = index < stepIndex;
          const isCurrent = index === stepIndex;
          return (
            <li key={step.id} className="flex min-w-0 items-center gap-2 sm:flex-1">
              {index > 0 ? (
                <span
                  className={cn(
                    "hidden h-px flex-1 sm:block",
                    done || isCurrent ? "bg-accent/50" : "bg-border-subtle",
                  )}
                  aria-hidden
                />
              ) : null}
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                    done && "border-success/40 bg-[var(--color-success-muted)] text-success",
                    isCurrent && "border-accent/40 bg-accent-muted text-accent",
                    !done && !isCurrent && "border-border-subtle text-text-muted",
                  )}
                >
                  {done ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : isCurrent ? (
                    <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-border-default" aria-hidden />
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    isCurrent ? "font-medium text-text-primary" : done ? "text-text-secondary" : "text-text-muted",
                  )}
                >
                  {step.label}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

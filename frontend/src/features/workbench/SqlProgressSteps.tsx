import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "validate", label: "Validating SQL" },
  { id: "execute", label: "Executing query" },
  { id: "prepare", label: "Preparing results" },
] as const;

type SqlProgressStepsProps = {
  active: boolean;
};

export function SqlProgressSteps({ active }: SqlProgressStepsProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setStepIndex((i) => (i < STEPS.length - 1 ? i + 1 : i));
    }, 700);
    return () => window.clearInterval(interval);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="flex items-center gap-4 animate-reveal rounded-lg border border-border-subtle bg-bg-elevated/60 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      {STEPS.map((step, index) => {
        const done = index < stepIndex;
        const current = index === stepIndex;
        return (
          <div key={step.id} className="flex items-center gap-2">
            {index > 0 ? <span className="hidden h-px w-4 bg-border-subtle sm:block" aria-hidden /> : null}
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border",
                done && "border-success/40 bg-[var(--color-success-muted)] text-success",
                current && "border-accent/40 bg-accent-muted text-accent",
                !done && !current && "border-border-subtle text-text-muted",
              )}
            >
              {done ? (
                <Check className="h-3 w-3" aria-hidden />
              ) : current ? (
                <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-border-default" aria-hidden />
              )}
            </span>
            <span
              className={cn(
                "text-xs",
                current ? "font-medium text-text-primary" : "text-text-muted",
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

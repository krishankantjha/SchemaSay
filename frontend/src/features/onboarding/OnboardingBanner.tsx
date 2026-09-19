import { Link } from "react-router-dom";
import { Check, ChevronRight, X } from "lucide-react";
import { useOnboardingStatus, type OnboardingStep } from "@/features/onboarding/useOnboardingStatus";
import { cn } from "@/lib/utils";

const STEP_META: Record<OnboardingStep, { title: string; cta: string; to: string }> = {
  connect: {
    title: "Connect your database",
    cta: "Add connection",
    to: "/connections?welcome=1",
  },
  explore: {
    title: "Explore your schema",
    cta: "Open schema explorer",
    to: "/schema",
  },
  ask: {
    title: "Ask your first question",
    cta: "Go to Ask",
    to: "/ask",
  },
};

const STEP_ORDER: OnboardingStep[] = ["connect", "explore", "ask"];

export function OnboardingBanner() {
  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    showBanner,
    hasSchema,
    steps,
    dismiss,
    remindLater,
  } = useOnboardingStatus();

  if (!showBanner) return null;

  const meta = STEP_META[currentStep];
  const exploreHint =
    currentStep === "explore" && !hasSchema
      ? "Sync your schema first, then browse tables and columns."
      : currentStep === "explore"
        ? "Browse tables, keys, and relationships before asking questions."
        : currentStep === "connect"
          ? "Test the connection, then save and sync schema."
          : "Ask in plain English — Query Trust will show validation and confidence.";

  return (
    <div className="mb-3 rounded-lg border border-border-default bg-bg-surface px-3 py-3">
      <div className="mb-3 flex items-center gap-2">
        {STEP_ORDER.map((id, index) => {
          const done = steps[id];
          const active = id === currentStep;
          return (
            <div key={id} className="flex min-w-0 flex-1 items-center gap-2">
              {index > 0 ? (
                <span
                  className={cn("h-px flex-1", done || active ? "bg-accent/50" : "bg-border-subtle")}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  done && "border-success/40 bg-[var(--color-success-muted)] text-success",
                  active && !done && "border-accent/40 bg-accent-muted text-accent",
                  !done && !active && "border-border-subtle text-text-muted",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden truncate text-xs sm:inline",
                  active ? "font-medium text-text-primary" : "text-text-muted",
                )}
              >
                {STEP_META[id].title.replace(" your", "")}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
            Step {currentStepIndex} of {totalSteps}
          </span>
          <span className="mx-2 text-text-muted">·</span>
          <span className="text-sm text-text-primary">{meta.title}</span>
          {exploreHint ? <p className="mt-0.5 text-xs text-text-secondary">{exploreHint}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={currentStep === "explore" && !hasSchema ? "/connections" : meta.to}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-accent bg-bg-elevated px-3 text-xs font-medium text-accent no-underline transition-colors hover:bg-accent-muted"
          >
            {currentStep === "explore" && !hasSchema ? "Sync schema" : meta.cta}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={remindLater}
            className="hidden text-xs text-text-muted hover:text-text-secondary sm:inline"
          >
            Remind later
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-11 w-11 items-center justify-center rounded-md text-text-muted hover:bg-bg-elevated hover:text-text-secondary"
            aria-label="Dismiss getting started"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function SchemaStatusBar() {
  const { showCompactStatus, tableCount, columnCount } = useOnboardingStatus();

  if (!showCompactStatus || tableCount === 0) return null;

  return (
    <div className="mb-3 flex items-center gap-2 text-xs text-text-secondary">
      <Check className="h-3.5 w-3.5 text-success" aria-hidden />
      <span>
        Schema synced · {tableCount} table{tableCount === 1 ? "" : "s"}
        {columnCount > 0 ? ` · ${columnCount} columns` : ""}
      </span>
    </div>
  );
}

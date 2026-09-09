import { Link } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import { useOnboardingStatus, type OnboardingStep } from "@/features/onboarding/useOnboardingStatus";

const STEP_META: Record<OnboardingStep, { title: string; cta: string; to: string }> = {
  connect: {
    title: "Connect your database",
    cta: "Add connection",
    to: "/connections?welcome=1",
  },
  sync: {
    title: "Sync your schema",
    cta: "Sync schema",
    to: "/connections",
  },
  ask: {
    title: "Ask your first question",
    cta: "Go to Ask",
    to: "/ask",
  },
};

export function OnboardingBanner() {
  const { currentStep, currentStepIndex, totalSteps, showBanner, dismiss, remindLater } =
    useOnboardingStatus();

  if (!showBanner) return null;

  const meta = STEP_META[currentStep];

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border-default bg-bg-surface px-3 py-2">
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
          Step {currentStepIndex} of {totalSteps}
        </span>
        <span className="mx-2 text-text-muted">·</span>
        <span className="text-sm text-text-primary">{meta.title}</span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to={meta.to}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-accent bg-bg-elevated px-3 text-xs font-medium text-accent no-underline transition-colors hover:bg-accent-muted"
        >
          {meta.cta}
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
          className="rounded p-1 text-text-muted hover:bg-bg-elevated hover:text-text-secondary"
          aria-label="Dismiss getting started"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function SchemaStatusBar() {
  const { showCompactStatus, tableCount, columnCount } = useOnboardingStatus();

  if (!showCompactStatus || tableCount === 0) return null;

  return (
    <div className="mb-3 flex items-center gap-2 text-xs text-text-secondary">
      <span className="text-success">✓</span>
      <span>
        Schema synced · {tableCount} table{tableCount === 1 ? "" : "s"}
        {columnCount > 0 ? ` · ${columnCount} columns` : ""}
      </span>
    </div>
  );
}

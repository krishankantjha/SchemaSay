import { useEffect, useRef, useId } from "react";
import { ShieldCheck, X } from "lucide-react";
import type { QueryExplanation } from "@/lib/api/types";
import { QueryTrustPanel } from "@/features/workbench/QueryTrustPanel";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/utils";

type TrustMobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  explanation: QueryExplanation | null;
  correlationId?: string | null;
  error?: string | null;
  sql?: string | null;
  running?: boolean;
};

export function TrustMobileDrawer({
  open,
  onClose,
  ...trustProps
}: TrustMobileDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useBodyScrollLock(open);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] xl:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-bg-overlay/70"
        aria-label="Close query trust panel"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute inset-y-0 right-0 flex w-[min(340px,92vw)] flex-col",
          "border-l border-border-subtle bg-bg-surface shadow-2xl",
          "motion-safe:animate-drawer-in-right",
        )}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
          <h2 id={titleId} className="type-heading flex items-center gap-2">
            <ShieldCheck className="icon-md text-accent" strokeWidth={2} aria-hidden />
            Query Trust
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="workbench-panel-toggle"
            aria-label="Close query trust panel"
          >
            <X className="icon-md" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <QueryTrustPanel {...trustProps} className="border-l-0" />
        </div>
      </div>
    </div>
  );
}

type TrustMobileToggleProps = {
  onClick: () => void;
};

export function TrustMobileToggle({ onClick }: TrustMobileToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed bottom-4 left-4 z-40 flex h-11 items-center gap-2 rounded-full",
        "border border-border-default bg-bg-surface px-4 shadow-lg",
        "text-sm font-medium text-text-primary",
        "transition-colors hover:border-accent hover:bg-accent-muted/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)]",
        "xl:hidden",
      )}
      aria-label="Open query trust panel"
    >
      <ShieldCheck className="icon-md text-accent" strokeWidth={2} aria-hidden />
      Trust
    </button>
  );
}

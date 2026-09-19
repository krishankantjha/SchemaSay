import { useEffect, useRef, useId } from "react";
import { Database, X } from "lucide-react";
import type { SchemaTableNode } from "@/lib/api/types";
import { SchemaTreeSidebar } from "@/features/workbench/SchemaTreeSidebar";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/utils";

type SchemaMobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  tables: SchemaTableNode[];
  isLoading: boolean;
  loadFailed?: boolean;
  syncError?: string | null;
  onSync: (profile: boolean) => void;
  isSyncing: boolean;
  connectionName?: string;
  onInsertColumn?: (ref: string) => void;
  onInsertTable?: (name: string) => void;
};

export function SchemaMobileDrawer({
  open,
  onClose,
  ...sidebarProps
}: SchemaMobileDrawerProps) {
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
    <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-bg-overlay/70"
        aria-label="Close schema panel"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(320px,88vw)] flex-col",
          "border-r border-border-subtle bg-bg-surface shadow-2xl",
          "motion-safe:animate-drawer-in",
        )}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
          <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Database className="icon-md text-accent" strokeWidth={2} aria-hidden />
            Schema browser
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="workbench-panel-toggle"
            aria-label="Close schema panel"
          >
            <X className="icon-md" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SchemaTreeSidebar {...sidebarProps} />
        </div>
      </div>
    </div>
  );
}

type SchemaMobileToggleProps = {
  onClick: () => void;
  tableCount?: number;
};

export function SchemaMobileToggle({ onClick, tableCount }: SchemaMobileToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed bottom-4 right-4 z-40 flex h-11 items-center gap-2 rounded-full",
        "border border-border-default bg-bg-surface px-4 shadow-lg",
        "text-sm font-medium text-text-primary",
        "transition-colors hover:border-accent hover:bg-accent-muted/30",
        "focus-ring",
        "lg:hidden",
      )}
      aria-label={`Open schema browser${tableCount ? `, ${tableCount} tables loaded` : ""}`}
    >
      <Database className="icon-md text-accent" strokeWidth={2} aria-hidden />
      Schema
      {tableCount != null && tableCount > 0 ? (
        <span className="rounded-full bg-accent-muted px-1.5 py-0.5 text-[10px] tabular-nums text-accent">
          {tableCount}
        </span>
      ) : null}
    </button>
  );
}

import { formatSyncFreshness, syncFreshnessTone } from "@/lib/schema-search";
import { cn } from "@/lib/utils";

type SchemaSyncStatusProps = {
  isSyncing: boolean;
  syncError?: string | null;
  lastSyncedAt?: number | null;
  syncSuccessAt?: number | null;
  tableCount?: number;
  className?: string;
};

type StatusTone = "success" | "warning" | "danger" | "accent" | "muted";

function StatusDot({ tone, pulse }: { tone: StatusTone; pulse?: boolean }) {
  return (
    <span
      className={cn(
        "status-dot",
        tone === "success" && "status-dot-success",
        tone === "warning" && "status-dot-warning",
        tone === "danger" && "status-dot-danger",
        tone === "accent" && "status-dot-accent",
        tone === "muted" && "status-dot-muted",
        pulse && "status-dot-pulse",
      )}
      aria-hidden
    />
  );
}

function StatusRow({
  tone,
  pulse,
  label,
  detail,
  className,
  role,
}: {
  tone: StatusTone;
  pulse?: boolean;
  label: string;
  detail?: string;
  className?: string;
  role?: "status" | "alert";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-md)] border border-border-subtle/80 bg-bg-elevated/40 px-2 py-1.5",
        className,
      )}
      role={role}
      aria-live={role === "status" ? "polite" : undefined}
    >
      <StatusDot tone={tone} pulse={pulse} />
      <p className="min-w-0 truncate text-[11px] leading-snug text-text-secondary">
        <span className="font-medium text-text-primary">{label}</span>
        {detail ? <span className="text-text-muted"> · {detail}</span> : null}
      </p>
    </div>
  );
}

export function SchemaSyncStatus({
  isSyncing,
  syncError,
  lastSyncedAt,
  syncSuccessAt,
  tableCount,
  className,
}: SchemaSyncStatusProps) {
  const showSuccess =
    syncSuccessAt != null && Date.now() - syncSuccessAt < 4000 && !syncError && !isSyncing;

  const tableLabel =
    tableCount != null ? `${tableCount} table${tableCount === 1 ? "" : "s"}` : undefined;

  if (isSyncing) {
    return (
      <StatusRow
        tone="accent"
        pulse
        label="Syncing"
        detail="Reading schema"
        className={className}
        role="status"
      />
    );
  }

  if (syncError) {
    return (
      <StatusRow
        tone="danger"
        label="Sync failed"
        detail={syncError.length > 48 ? `${syncError.slice(0, 48)}…` : syncError}
        className={cn("border-danger/25 bg-[var(--color-danger-muted)]/50", className)}
        role="alert"
      />
    );
  }

  if (showSuccess) {
    return (
      <StatusRow
        tone="success"
        label="Synced"
        detail={tableLabel ?? "Ready"}
        className={cn("border-success/25 bg-[var(--color-success-muted)]/50 animate-reveal", className)}
        role="status"
      />
    );
  }

  const freshness = formatSyncFreshness(lastSyncedAt);
  const tone = syncFreshnessTone(lastSyncedAt);

  return (
    <StatusRow
      tone={tone}
      label={freshness}
      detail={tableLabel}
      className={className}
    />
  );
}

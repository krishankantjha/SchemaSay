import { Search } from "lucide-react";
import { useCommandPalette } from "@/features/command/CommandPaletteContext";
import { Kbd } from "@/components/ui/Kbd";
import { modKeyLabel } from "@/lib/keyboard";
import { cn } from "@/lib/utils";

type CommandPaletteTriggerProps = {
  className?: string;
  compact?: boolean;
};

export function CommandPaletteTrigger({ className, compact = false }: CommandPaletteTriggerProps) {
  const { setOpen } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "nav-utility pressable",
        compact
          ? "w-[var(--control-height)] min-w-[var(--control-height)] px-0"
          : "px-3",
        className,
      )}
      aria-label="Open command palette"
    >
      <Search className="icon-sm text-text-muted" strokeWidth={2} aria-hidden />
      {!compact ? <span className="hidden flex-1 text-left sm:inline">Search…</span> : null}
      {!compact ? (
        <Kbd className="ml-auto hidden bg-bg-surface sm:inline-flex">{modKeyLabel()}K</Kbd>
      ) : null}
    </button>
  );
}

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Option<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  size?: "sm" | "md";
  ariaLabel?: string;
  fullWidth?: boolean;
  className?: string;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  ariaLabel,
  fullWidth = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface p-0.5",
        fullWidth && "flex w-full",
        className,
      )}
    >
      {options.map(({ value: option, label, icon: Icon }) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-[calc(var(--radius-md)-2px)] font-medium transition-colors duration-fast",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)]",
              size === "sm" ? "px-2.5 py-1 text-[10px] uppercase tracking-wide" : "px-3 py-1.5 text-xs",
              fullWidth && "flex-1",
              selected
                ? "bg-accent-muted text-accent shadow-sm"
                : "text-text-muted hover:bg-bg-elevated hover:text-text-secondary",
            )}
          >
            {Icon ? <Icon className="icon-sm" strokeWidth={2} aria-hidden /> : null}
            <span className={Icon && fullWidth ? "hidden sm:inline" : undefined}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

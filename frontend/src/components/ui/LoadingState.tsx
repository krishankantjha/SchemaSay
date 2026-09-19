import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  fullScreen?: boolean;
  compact?: boolean;
};

const sizeMap = {
  sm: { icon: "h-4 w-4", text: "text-xs", gap: "gap-2" },
  md: { icon: "h-5 w-5", text: "text-sm", gap: "gap-2.5" },
  lg: { icon: "h-6 w-6", text: "text-base", gap: "gap-3" },
};

export function LoadingState({
  message = "Loading…",
  size = "md",
  className,
  fullScreen = false,
  compact = false,
}: LoadingStateProps) {
  const s = sizeMap[size];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        fullScreen ? "min-h-screen bg-bg-base px-4" : compact ? "py-4" : "py-8",
        className,
      )}
    >
      <div className={cn("flex items-center", s.gap, s.text, "text-text-secondary")}>
        <Loader2 className={cn(s.icon, "motion-safe:animate-spin text-accent")} aria-hidden />
        <span>{message}</span>
      </div>
    </div>
  );
}

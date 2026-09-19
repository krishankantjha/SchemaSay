import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "bottom";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
};

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <span className={cn("tooltip-anchor", className)}>
      {children}
      <span
        role="tooltip"
        className={cn("tooltip-bubble", side === "bottom" && "tooltip-bubble-bottom")}
      >
        {content}
      </span>
    </span>
  );
}

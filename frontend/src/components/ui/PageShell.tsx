import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageShellWidth = "narrow" | "default" | "wide";

type PageShellProps = {
  children: ReactNode;
  width?: PageShellWidth;
  className?: string;
};

const WIDTH: Record<PageShellWidth, string> = {
  narrow: "max-w-4xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
};

export function PageShell({ children, width = "default", className }: PageShellProps) {
  return (
    <div className={cn("page-shell mx-auto w-full space-y-6", WIDTH[width], className)}>
      {children}
    </div>
  );
}

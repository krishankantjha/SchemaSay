import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AuthCardProps = {
  children: ReactNode;
  className?: string;
};

export function AuthCard({ children, className = "" }: AuthCardProps) {
  return (
    <div
      className={cn(
        "surface-card w-full p-[var(--space-card)]",
        "lg:max-h-[calc(100vh-var(--space-page)*2)] lg:overflow-y-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}

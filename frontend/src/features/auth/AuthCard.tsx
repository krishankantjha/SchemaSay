import type { ReactNode } from "react";

type AuthCardProps = {
  children: ReactNode;
  className?: string;
};

export function AuthCard({ children, className = "" }: AuthCardProps) {
  return (
    <div
      className={[
        "max-h-[calc(100vh-3rem)] w-full overflow-y-auto rounded-xl",
        "border border-border-subtle bg-bg-surface/85 p-6 shadow-[0_16px_48px_-20px_rgba(0,0,0,0.4)] backdrop-blur-md",
        "sm:p-7",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

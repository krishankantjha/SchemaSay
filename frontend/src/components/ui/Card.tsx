import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={[
        "rounded-lg border border-border-subtle bg-bg-surface p-4",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function CardHeader({ className = "", ...props }: CardProps) {
  return <div className={["mb-3", className].join(" ")} {...props} />;
}

export function CardTitle({ className = "", ...props }: CardProps) {
  return <h3 className={["text-sm font-semibold text-text-primary", className].join(" ")} {...props} />;
}

export function CardDescription({ className = "", ...props }: CardProps) {
  return <p className={["text-sm text-text-secondary", className].join(" ")} {...props} />;
}

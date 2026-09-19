import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "elevated" | "ghost";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

const variantClasses: Record<CardVariant, string> = {
  default: "surface-card",
  elevated: "surface-elevated shadow-sm",
  ghost: "rounded-[var(--radius-md)] border border-transparent bg-transparent",
};

export function Card({ variant = "default", className, ...props }: CardProps) {
  return (
    <div
      className={cn("p-[var(--space-card)]", variantClasses[variant], className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 space-y-1", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("type-heading", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("type-body leading-relaxed", className)} {...props} />;
}

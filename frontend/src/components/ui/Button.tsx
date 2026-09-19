import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-[var(--color-on-accent)] border border-transparent shadow-sm hover:bg-accent-hover hover:shadow-md active:bg-accent-hover active:shadow-none",
  secondary:
    "bg-bg-elevated text-text-primary border border-border-default shadow-sm hover:border-accent/35 hover:bg-bg-surface hover:shadow-md active:border-border-default active:bg-bg-elevated active:shadow-sm",
  ghost:
    "bg-transparent text-text-secondary border border-transparent hover:border-border-subtle hover:bg-bg-elevated hover:text-text-primary hover:shadow-sm active:border-border-subtle active:bg-bg-surface active:text-text-primary",
  danger:
    "bg-[var(--color-danger-muted)] text-danger border border-danger/30 shadow-sm hover:border-danger/45 hover:bg-danger/15 hover:shadow-md active:bg-danger/20 active:shadow-sm",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-[var(--control-height-sm)] min-h-[var(--control-height-sm)] px-3 text-xs gap-1.5",
  md: "h-[var(--control-height)] min-h-[var(--control-height)] px-4 text-sm gap-2",
  lg: "h-[var(--control-height-lg)] min-h-[var(--control-height-lg)] px-5 text-sm gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      className,
      disabled,
      loading = false,
      leftIcon,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium",
          "pressable",
          "focus-visible:outline-none focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="icon-md motion-safe:animate-spin" aria-hidden />
        ) : leftIcon ? (
          <span className="shrink-0 [&>svg]:icon-md">{leftIcon}</span>
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

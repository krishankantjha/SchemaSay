import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

type IconInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon: ReactNode;
  error?: string;
  success?: boolean;
};

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(
  ({ className = "", icon, error, success, ...props }, ref) => {
    const borderClass = error
      ? "border-danger"
      : success
        ? "border-success/50"
        : "border-border-default hover:border-border-focus/60";

    return (
      <div className="w-full">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">
            {icon}
          </span>
          <input
            ref={ref}
            className={[
              "h-11 w-full rounded-lg border bg-bg-elevated/80 pl-10 pr-3.5 text-sm text-text-primary",
              "placeholder:text-text-muted transition-all duration-150",
              "focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-accent/20",
              borderClass,
              className,
            ].join(" ")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${props.id}-error` : undefined}
            {...props}
          />
        </div>
        {error ? (
          <p id={`${props.id}-error`} className="mt-1.5 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

IconInput.displayName = "IconInput";

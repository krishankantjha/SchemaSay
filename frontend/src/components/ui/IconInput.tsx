import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type IconInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon: ReactNode;
  error?: string;
  success?: boolean;
};

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(
  ({ className, icon, error, success, id, ...props }, ref) => {
    const errorId = id ? `${id}-error` : undefined;

    return (
      <div className="w-full">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
          <input
            ref={ref}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "control-base w-full pl-10 pr-3.5 text-sm placeholder:text-text-muted",
              error && "control-error",
              success && !error && "border-success/50",
              className,
            )}
            {...props}
          />
        </div>
        {error ? (
          <p id={errorId} className="mt-[var(--space-stack-md)] text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

IconInput.displayName = "IconInput";

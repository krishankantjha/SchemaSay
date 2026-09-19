import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  icon?: ReactNode;
  error?: string;
  success?: boolean;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, icon, error, success, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const errorId = id ? `${id}-error` : undefined;

    return (
      <div className="w-full">
        <div className="relative">
          {icon ? (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "control-base w-full pr-10 text-sm placeholder:text-text-muted",
              icon ? "pl-10" : "pl-3.5",
              error && "control-error",
              success && !error && "border-success/50",
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            className="focus-ring absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-text-muted transition-colors duration-fast hover:text-text-secondary"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
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

PasswordInput.displayName = "PasswordInput";

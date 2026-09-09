import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  icon?: ReactNode;
  error?: string;
  success?: boolean;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className = "", icon, error, success, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    const borderClass = error
      ? "border-danger"
      : success
        ? "border-success/50"
        : "border-border-default hover:border-border-focus/60";

    return (
      <div className="w-full">
        <div className="relative">
          {icon ? (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">
              {icon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            className={[
              "h-11 w-full rounded-lg border bg-bg-elevated/80 pr-10 text-sm text-text-primary",
              icon ? "pl-10" : "pl-3.5",
              "placeholder:text-text-muted transition-all duration-150",
              "focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-accent/20",
              borderClass,
              className,
            ].join(" ")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-secondary"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error ? (
          <p id={`${id}-error`} className="mt-1.5 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";

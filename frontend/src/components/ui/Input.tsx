import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={[
            "h-10 w-full rounded-md border bg-bg-elevated px-3 text-sm text-text-primary",
            "placeholder:text-text-muted transition-colors",
            "focus:border-border-focus focus:outline-none",
            error ? "border-danger" : "border-border-default",
            className,
          ].join(" ")}
          {...props}
        />
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
    );
  },
);

Input.displayName = "Input";

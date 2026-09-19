import { Check, Info, X } from "lucide-react";
import {
  PASSWORD_RULES,
  passwordStrengthLabel,
  scorePassword,
} from "@/lib/password-validation";

type PasswordStrengthProps = {
  password: string;
  showRules?: boolean;
  /** Show requirement checklist before user types (on focus) */
  focused?: boolean;
};

export function PasswordStrength({
  password,
  showRules = true,
  focused = false,
}: PasswordStrengthProps) {
  const showPanel = focused || password.length > 0;
  if (!showPanel) return null;

  const score = scorePassword(password);
  const label = passwordStrengthLabel(score);
  const barColor =
    score < 40 ? "bg-danger" : score < 80 ? "bg-warning" : score < 100 ? "bg-info" : "bg-success";
  const allPassed = score === 100;

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      {password ? (
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated"
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Password strength"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
              style={{ width: `${Math.max(score, 8)}%` }}
            />
          </div>
          {label ? (
            <span className="text-[11px] font-medium text-text-secondary">{label}</span>
          ) : null}
        </div>
      ) : focused ? (
        <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <Info className="h-3 w-3 shrink-0" aria-hidden />
          Use a strong password that meets all requirements below.
        </p>
      ) : null}

      {showRules ? (
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2" role="list" aria-label="Password requirements">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(password);
            return (
              <li
                key={rule.id}
                className={[
                  "flex items-center gap-1.5 text-[11px] transition-colors",
                  password ? (ok ? "text-success" : "text-text-muted") : "text-text-muted",
                ].join(" ")}
              >
                {password ? (
                  ok ? (
                    <Check className="h-3 w-3 shrink-0" aria-hidden />
                  ) : (
                    <X className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                  )
                ) : (
                  <span className="h-3 w-3 shrink-0 rounded-full border border-border-default" aria-hidden />
                )}
                <span>{rule.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {allPassed ? (
        <p className="text-[11px] text-success">Password meets all requirements.</p>
      ) : null}
    </div>
  );
}

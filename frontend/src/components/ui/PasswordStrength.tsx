import { Check, X } from "lucide-react";
import {
  PASSWORD_RULES,
  passwordStrengthLabel,
  scorePassword,
} from "@/lib/password-validation";

type PasswordStrengthProps = {
  password: string;
  showRules?: boolean;
};

export function PasswordStrength({ password, showRules = true }: PasswordStrengthProps) {
  if (!password) return null;

  const score = scorePassword(password);
  const label = passwordStrengthLabel(score);
  const barColor =
    score < 40 ? "bg-danger" : score < 80 ? "bg-warning" : score < 100 ? "bg-info" : "bg-success";

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
        {label ? (
          <span className="text-[11px] font-medium text-text-secondary">{label}</span>
        ) : null}
      </div>

      {showRules ? (
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2" role="list">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(password);
            return (
              <li
                key={rule.id}
                className={[
                  "flex items-center gap-1.5 text-[11px]",
                  ok ? "text-success" : "text-text-muted",
                ].join(" ")}
              >
                {ok ? (
                  <Check className="h-3 w-3 shrink-0" aria-hidden />
                ) : (
                  <X className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                )}
                <span>{rule.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

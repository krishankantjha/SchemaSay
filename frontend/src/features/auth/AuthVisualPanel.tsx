import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Lock } from "lucide-react";
import { SchemaSayLogo } from "@/components/brand/SchemaSayLogo";
import { QueryTrustDemo } from "@/features/auth/QueryTrustDemo";

type AuthVisualPanelProps = {
  eyebrow: string;
  headline: string;
  subtext: string;
  features?: string[];
};

const DEFAULT_FEATURES = [
  "Schema-aware SQL generation",
  "Human-readable explanations",
  "Auditable query history",
];

export function AuthVisualPanel({
  eyebrow,
  headline,
  subtext,
  features = DEFAULT_FEATURES,
}: AuthVisualPanelProps) {
  return (
    <div className="relative hidden h-full min-h-0 overflow-hidden border-r border-border-subtle bg-bg-surface lg:flex lg:flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[var(--color-accent-subtle)] blur-3xl"
      />
      <div aria-hidden className="auth-grid-bg" />

      <div className="auth-visual-scroll relative z-10 flex min-h-0 flex-1 flex-col px-[var(--auth-panel-padding)] py-[var(--space-5)]">
        <Link
          to="/ask"
          aria-label="SchemaSay home"
          className="focus-ring mb-[var(--space-5)] inline-flex w-fit rounded-[var(--radius-md)] no-underline"
        >
          <SchemaSayLogo size="lg" />
        </Link>

        <div className="shrink-0">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h2 className="auth-headline">{headline}</h2>
          <p className="auth-subtext">{subtext}</p>
        </div>

        <div className="mt-[var(--space-4)] min-h-0 shrink">
          <QueryTrustDemo />
        </div>

        <div className="mt-auto shrink-0 pt-[var(--space-4)]">
          <ul className="auth-feature-list auth-feature-list-compact">
            {features.map((feature) => (
              <li key={feature} className="auth-feature-item">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} aria-hidden />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-[var(--space-3)] flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-1 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3 text-accent" strokeWidth={2} aria-hidden />
              Encrypted connections
            </span>
            <span>Read-only queries</span>
            <span>Schema-aware generation</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-[var(--space-page)] py-[var(--space-5)] lg:overflow-hidden lg:py-[var(--space-5)]">
        <div className="my-auto w-full max-w-[var(--auth-card-max-width)]">{children}</div>
      </div>
    </div>
  );
}

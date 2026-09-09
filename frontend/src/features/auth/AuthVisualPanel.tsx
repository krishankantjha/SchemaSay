import type { ReactNode } from "react";
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
    <div className="relative hidden min-h-screen overflow-hidden border-r border-border-subtle bg-bg-surface lg:flex lg:flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-subtle) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 70% 55% at 45% 35%, black 15%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-8 py-8 xl:px-12 xl:py-10">
        <SchemaSayLogo size="lg" showTagline className="mb-10" />

        <p className="text-sm font-medium text-accent">{eyebrow}</p>
        <h2 className="mt-2 max-w-md text-2xl font-semibold leading-snug tracking-tight text-text-primary xl:text-3xl">
          {headline}
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-text-secondary">{subtext}</p>

        <div className="mt-8">
          <QueryTrustDemo />
        </div>

        <ul className="mt-8 space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm text-text-secondary">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-accent" /> Encrypted connections
          </span>
          <span>Read-only queries</span>
          <span>Schema-aware generation</span>
        </div>
      </div>
    </div>
  );
}

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-bg-base lg:min-h-0 lg:flex-1">
      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="w-full max-w-[440px]">{children}</div>
      </div>
    </div>
  );
}

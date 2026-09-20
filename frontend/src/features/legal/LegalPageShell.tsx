import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { SchemaSayLogo } from "@/components/brand/SchemaSayLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type LegalPageShellProps = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

export function LegalPageShell({ title, lastUpdated, children }: LegalPageShellProps) {
  return (
    <div className="min-h-[100dvh] bg-bg-base">
      <header className="sticky top-0 z-10 border-b border-border-subtle bg-bg-base/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-[var(--space-page)] py-4">
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary no-underline hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Link>
          <Link to="/" aria-label="SchemaSay home" className="no-underline">
            <SchemaSayLogo size="sm" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-[var(--space-page)] py-8 pb-16">
        <h1 className="type-display text-2xl sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-text-muted">Last updated: {lastUpdated}</p>
        <article className="legal-prose mt-8 space-y-8">{children}</article>
        <footer className="mt-12 flex flex-wrap gap-4 border-t border-border-subtle pt-6 text-sm text-text-muted">
          <Link to="/terms" className="text-accent hover:text-accent-hover">
            Terms of Service
          </Link>
          <Link to="/privacy" className="text-accent hover:text-accent-hover">
            Privacy Policy
          </Link>
          <Link to="/login" className="hover:text-text-primary">
            Sign in
          </Link>
        </footer>
      </main>
    </div>
  );
}

type LegalSectionProps = {
  title: string;
  children: ReactNode;
};

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-text-secondary">{children}</div>
    </section>
  );
}

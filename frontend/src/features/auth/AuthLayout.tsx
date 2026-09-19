import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { SchemaSayLogo } from "@/components/brand/SchemaSayLogo";
import { SkipLink } from "@/components/ui/SkipLink";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AuthPageShell, AuthVisualPanel } from "@/features/auth/AuthVisualPanel";

type AuthLayoutProps = {
  visual: {
    eyebrow: string;
    headline: string;
    subtext: string;
  };
  children: ReactNode;
};

export function AuthLayout({ visual, children }: AuthLayoutProps) {
  return (
    <div className="auth-page grid h-[100dvh] max-h-[100dvh] overflow-hidden bg-bg-base lg:grid-cols-2">
      <AuthVisualPanel {...visual} />

      <div className="relative flex min-h-0 flex-col lg:overflow-hidden">
        <SkipLink />
        <header className="absolute right-0 top-0 z-10 flex w-full items-center justify-between px-[var(--space-page)] py-[var(--space-4)]">
          <Link
            to="/ask"
            aria-label="SchemaSay home"
            className="focus-ring inline-flex w-fit rounded-[var(--radius-md)] no-underline lg:hidden"
          >
            <SchemaSayLogo size="sm" />
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <AuthPageShell>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        </AuthPageShell>
      </div>
    </div>
  );
}

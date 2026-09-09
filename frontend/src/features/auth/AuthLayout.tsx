import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { SchemaSayLogo } from "@/components/brand/SchemaSayLogo";
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
    <div className="grid min-h-screen bg-bg-base lg:grid-cols-2 lg:items-stretch">
      <AuthVisualPanel {...visual} />

      <div className="relative flex min-h-screen flex-col lg:min-h-0">
        <header className="absolute right-0 top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/login" className="lg:hidden">
            <SchemaSayLogo size="sm" />
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <AuthPageShell>{children}</AuthPageShell>
      </div>
    </div>
  );
}

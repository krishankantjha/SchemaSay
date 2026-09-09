import { NavLink } from "react-router-dom";
import {
  Database,
  LineChart,
  MessageSquare,
  ScrollText,
  Shield,
  Terminal,
} from "lucide-react";
import { SchemaSayLogo } from "@/components/brand/SchemaSayLogo";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { MobileNav } from "@/components/layout/MobileNav";
import { ConnectionSelect } from "@/features/connections/ConnectionSelect";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const NAV_ITEMS = [
  { to: "/ask", label: "Ask", icon: MessageSquare },
  { to: "/sql", label: "SQL", icon: Terminal },
  { to: "/schema", label: "Schema", icon: Database },
  { to: "/metrics", label: "Metrics", icon: LineChart },
  { to: "/govern", label: "Govern", icon: Shield },
  { to: "/audit", label: "Audit", icon: ScrollText },
] as const;

function NavDivider() {
  return <span className="mx-1 hidden h-4 w-px bg-border-subtle lg:block" aria-hidden />;
}

export function TopNav() {
  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-border-subtle bg-bg-base/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <MobileNav />

        <NavLink to="/ask" className="shrink-0 no-underline">
          <SchemaSayLogo size="sm" />
        </NavLink>

        <nav className="hidden items-center md:flex" aria-label="Main">
          {NAV_ITEMS.map(({ to, label, icon: Icon }, index) => (
            <span key={to} className="flex items-center">
              {index === 3 || index === 4 ? <NavDivider /> : null}
              <NavLink
                to={to}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm no-underline transition-colors",
                    isActive
                      ? "bg-accent-muted font-medium text-accent"
                      : "text-text-muted hover:bg-bg-elevated hover:text-text-secondary",
                  ].join(" ")
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ConnectionSelect />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

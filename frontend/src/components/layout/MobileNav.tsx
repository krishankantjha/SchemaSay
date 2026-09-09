import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import {
  Database,
  LineChart,
  MessageSquare,
  ScrollText,
  Shield,
  Terminal,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/ask", label: "Ask", icon: MessageSquare },
  { to: "/sql", label: "SQL", icon: Terminal },
  { to: "/schema", label: "Schema", icon: Database },
  { to: "/metrics", label: "Metrics", icon: LineChart },
  { to: "/govern", label: "Govern", icon: Shield },
  { to: "/audit", label: "Audit", icon: ScrollText },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-elevated"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-bg-overlay"
            aria-label="Close menu overlay"
            onClick={() => setOpen(false)}
          />
          <nav className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border-subtle bg-bg-surface p-4 shadow-md">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  [
                    "mb-0.5 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm no-underline",
                    isActive
                      ? "bg-accent-muted text-accent"
                      : "text-text-secondary hover:bg-bg-elevated",
                  ].join(" ")
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </>
      ) : null}
    </div>
  );
}

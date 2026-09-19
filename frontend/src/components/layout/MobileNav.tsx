import { useEffect, useId, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/navConfig";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = useId();

  useBodyScrollLock(open);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) triggerRef.current?.focus();
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-text-secondary",
          "transition-colors hover:bg-bg-elevated hover:text-text-primary",
          "focus-ring",
        )}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {open ? (
          <X className="h-5 w-5" strokeWidth={2} aria-hidden />
        ) : (
          <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
        )}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-bg-overlay/70 motion-safe:animate-overlay-in"
            aria-label="Close menu overlay"
            onClick={() => setOpen(false)}
          />
          <nav
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border-subtle bg-bg-surface p-[var(--space-sidebar)] shadow-[var(--shadow-dropdown)] motion-safe:animate-drawer-in"
          >
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "nav-link mb-0.5 min-h-[44px] gap-2.5 px-3 py-2.5 no-underline",
                    "focus-ring",
                    isActive && "nav-link-active",
                  )
                }
              >
                <Icon aria-hidden strokeWidth={2} />
                {label}
              </NavLink>
            ))}
          </nav>
        </>
      ) : null}
    </div>
  );
}

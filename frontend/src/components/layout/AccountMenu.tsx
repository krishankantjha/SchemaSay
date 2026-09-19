import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Plug, Settings, Shield, User } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/utils";

function initials(email: string, name?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  }
  return email.slice(0, 2).toUpperCase();
}

export function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useFocusTrap(menuRef, open);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

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

  if (!user) return null;

  const label = initials(user.email, user.full_name);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-[var(--control-height)] w-[var(--control-height)] items-center justify-center rounded-full",
          "border border-border-default bg-bg-elevated text-xs font-semibold text-accent",
          "pressable hover:border-accent/40 hover:bg-accent-muted/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)]",
        )}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        {label}
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          className="absolute right-0 top-full z-50 mt-2 w-56 animate-reveal overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface py-1 shadow-[var(--shadow-dropdown)]"
          role="menu"
        >
          <div className="border-b border-border-subtle px-3.5 py-2.5" role="presentation">
            <p className="truncate type-heading">{user.full_name || "Account"}</p>
            <p className="truncate type-meta mt-0.5 normal-case tracking-normal">{user.email}</p>
          </div>
          <MenuLink to="/connections" icon={Plug} onClick={() => setOpen(false)}>
            Connections
          </MenuLink>
          <MenuLink to="/govern" icon={Shield} onClick={() => setOpen(false)}>
            Security & policies
          </MenuLink>
          <MenuButton icon={User} disabled title="Coming soon">
            Profile
          </MenuButton>
          <MenuButton icon={Settings} disabled title="Coming soon">
            Preferences
          </MenuButton>
          <div className="my-1 border-t border-border-subtle" role="separator" />
          <MenuButton
            icon={LogOut}
            onClick={() => {
              setOpen(false);
              void handleLogout();
            }}
          >
            Log out
          </MenuButton>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  to,
  icon: Icon,
  children,
  onClick,
}: {
  to: string;
  icon: typeof User;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] w-full items-center gap-2.5 px-3.5 py-2 text-sm text-text-secondary no-underline",
        "transition-colors duration-fast hover:bg-bg-elevated hover:text-text-primary",
        "focus-visible:outline-none focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)]",
      )}
    >
      <Icon className="icon-md" strokeWidth={2} aria-hidden />
      {children}
    </Link>
  );
}

function MenuButton({
  icon: Icon,
  children,
  onClick,
  disabled,
  title,
}: {
  icon: typeof User;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-text-secondary",
        "transition-colors duration-fast hover:bg-bg-elevated hover:text-text-primary",
        "focus-visible:outline-none focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <Icon className="icon-md" strokeWidth={2} aria-hidden />
      {children}
    </button>
  );
}

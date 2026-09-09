import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Plug, Settings, Shield, User } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";

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

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

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
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border-default bg-bg-elevated text-xs font-semibold text-accent transition-colors hover:border-accent/40"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {label}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border border-border-subtle bg-bg-surface py-1 shadow-md">
          <div className="border-b border-border-subtle px-3 py-2">
            <p className="truncate text-sm font-medium text-text-primary">
              {user.full_name || "Account"}
            </p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
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
          <div className="my-1 border-t border-border-subtle" />
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
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary no-underline hover:bg-bg-elevated hover:text-text-primary"
    >
      <Icon className="h-4 w-4 shrink-0" />
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
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </button>
  );
}

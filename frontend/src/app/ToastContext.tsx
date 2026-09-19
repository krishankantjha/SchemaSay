import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  exiting?: boolean;
};

type ToastContextValue = {
  toasts: Toast[];
  push: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const AUTO_DISMISS_MS = 4000;
const EXIT_MS = 180;

const variantIcon = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const clearTimer = useCallback((id: string) => {
    const existing = timers.current.get(id);
    if (existing) {
      window.clearTimeout(existing);
      timers.current.delete(id);
    }
  }, []);

  const remove = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  const dismiss = useCallback(
    (id: string) => {
      setToasts((prev) => {
        const target = prev.find((t) => t.id === id);
        if (!target || target.exiting) return prev;
        return prev.map((t) => (t.id === id ? { ...t, exiting: true } : t));
      });
      clearTimer(id);
      const timeout = window.setTimeout(() => remove(id), EXIT_MS);
      timers.current.set(id, timeout);
    },
    [clearTimer, remove],
  );

  const push = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-4), { id, message, variant }]);
      const timeout = window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timeout);
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      active.forEach((timeout) => window.clearTimeout(timeout));
      active.clear();
    };
  }, []);

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast();

  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-20 right-4 z-[100] flex max-w-sm flex-col gap-2 lg:bottom-4"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = variantIcon[toast.variant];
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-sm shadow-lg backdrop-blur-md",
              toast.exiting ? "animate-toast-out" : "animate-toast-in",
              toast.variant === "success"
                ? "border-success/30 bg-bg-surface/95 text-success"
                : toast.variant === "error"
                  ? "border-danger/30 bg-bg-surface/95 text-danger"
                  : "border-border-default bg-bg-surface/95 text-text-primary",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{toast.message}</span>
            </span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-sm p-0.5 text-text-muted transition-colors duration-150 hover:text-text-secondary"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

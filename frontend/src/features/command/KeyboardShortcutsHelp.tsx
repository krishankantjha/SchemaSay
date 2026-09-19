import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useCommandPalette } from "@/features/command/CommandPaletteContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { Kbd } from "@/components/ui/Kbd";
import { formatShortcut, modKeyLabel } from "@/lib/keyboard";
import { cn } from "@/lib/utils";

const SHORTCUT_GROUPS: { title: string; items: { keys: string; description: string }[] }[] = [
  {
    title: "Global",
    items: [
      { keys: "Mod+K", description: "Open command palette" },
      { keys: "?", description: "Show keyboard shortcuts" },
      { keys: "Esc", description: "Close dialogs and palettes" },
    ],
  },
  {
    title: "Navigation",
    items: [
      { keys: "G then A", description: "Go to Ask" },
      { keys: "G then S", description: "Go to SQL editor" },
      { keys: "G then C", description: "Go to Schema explorer" },
      { keys: "G then M", description: "Go to Metrics" },
      { keys: "G then G", description: "Go to Govern" },
      { keys: "G then U", description: "Go to Audit log" },
    ],
  },
  {
    title: "Ask workbench",
    items: [
      { keys: "Enter", description: "Submit question" },
      { keys: "Shift+Enter", description: "New line in question" },
    ],
  },
  {
    title: "SQL editor",
    items: [
      { keys: "Mod+Enter", description: "Run query" },
      { keys: "Tab", description: "Indent (2 spaces)" },
    ],
  },
];

export function KeyboardShortcutsHelp() {
  const { shortcutsOpen, setShortcutsOpen } = useCommandPalette();
  const dialogRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(shortcutsOpen);
  useFocusTrap(dialogRef, shortcutsOpen);

  useEffect(() => {
    if (!shortcutsOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShortcutsOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcutsOpen, setShortcutsOpen]);

  if (!shortcutsOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 motion-safe:animate-overlay-in">
      <button
        type="button"
        className="absolute inset-0 bg-bg-overlay/60 backdrop-blur-sm"
        aria-label="Close shortcuts"
        onClick={() => setShortcutsOpen(false)}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className={cn(
          "relative z-10 w-full max-w-md animate-dialog-in rounded-xl border border-border-default bg-bg-surface shadow-2xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 id="shortcuts-title" className="text-sm font-semibold text-text-primary">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={() => setShortcutsOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-text-muted pressable hover:bg-bg-elevated hover:text-text-secondary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto overscroll-contain p-4 touch-pan-y">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.keys} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-text-secondary">{item.description}</span>
                    <Kbd className="shrink-0 px-2 py-1 text-[11px]">{formatShortcut(item.keys)}</Kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="mt-4 text-xs text-text-muted">
            {modKeyLabel()} = {modKeyLabel() === "⌘" ? "Command" : "Control"} key on your keyboard.
          </p>
        </div>
      </div>
    </div>
  );
}

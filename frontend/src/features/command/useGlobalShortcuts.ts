import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCommandPalette } from "@/features/command/CommandPaletteContext";
import { isEditableTarget } from "@/lib/keyboard";

const NAV_SEQUENCE: Record<string, string> = {
  a: "/ask",
  s: "/sql",
  c: "/schema",
  m: "/metrics",
  g: "/govern",
  u: "/audit",
};

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const { open, setOpen, shortcutsOpen, setShortcutsOpen } = useCommandPalette();
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearGTimer() {
      if (gTimer.current) {
        clearTimeout(gTimer.current);
        gTimer.current = null;
      }
      pendingG.current = false;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (open || shortcutsOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
          setShortcutsOpen(false);
        }
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      const editable = isEditableTarget(e.target);

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        return;
      }

      if (e.key === "?" && !editable && !mod && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (editable) return;

      if (e.key.toLowerCase() === "g" && !mod && !e.altKey) {
        pendingG.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(clearGTimer, 1000);
        return;
      }

      if (pendingG.current && !mod && !e.altKey) {
        const dest = NAV_SEQUENCE[e.key.toLowerCase()];
        clearGTimer();
        if (dest) {
          e.preventDefault();
          navigate(dest);
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearGTimer();
    };
  }, [navigate, open, shortcutsOpen, setOpen, setShortcutsOpen]);
}

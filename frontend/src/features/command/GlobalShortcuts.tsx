import { CommandPalette } from "@/features/command/CommandPalette";
import { KeyboardShortcutsHelp } from "@/features/command/KeyboardShortcutsHelp";
import { useGlobalShortcuts } from "@/features/command/useGlobalShortcuts";

/** Mount inside CommandPaletteProvider to wire global keyboard shortcuts */
export function GlobalShortcuts() {
  useGlobalShortcuts();
  return (
    <>
      <CommandPalette />
      <KeyboardShortcutsHelp />
    </>
  );
}

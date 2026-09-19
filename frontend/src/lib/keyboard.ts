/** Returns true when the event target is an editable field */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

export function modKeyLabel(): string {
  return isMac() ? "⌘" : "Ctrl";
}

export function formatShortcut(keys: string): string {
  const mod = modKeyLabel();
  return keys.replace("Mod", mod).replace("Shift", "⇧").replace("Alt", isMac() ? "⌥" : "Alt");
}

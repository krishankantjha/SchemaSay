const STORAGE_KEY = "schemasay_recent_actions";
const MAX_ITEMS = 20;

export type RecentActionType = "question" | "sql" | "navigation";

export type RecentAction = {
  id: string;
  type: RecentActionType;
  label: string;
  payload?: string;
  connectionId?: number;
  timestamp: number;
};

function load(): RecentAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: RecentAction[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export function getRecentActions(limit = 8): RecentAction[] {
  return load().slice(0, limit);
}

export function addRecentAction(
  action: Omit<RecentAction, "id" | "timestamp">,
): void {
  const items = load();
  const id = `${action.type}:${action.label}:${action.payload ?? ""}`;
  const filtered = items.filter((item) => item.id !== id);
  filtered.unshift({
    ...action,
    id,
    timestamp: Date.now(),
  });
  save(filtered);
}

export function clearRecentActions(): void {
  localStorage.removeItem(STORAGE_KEY);
}

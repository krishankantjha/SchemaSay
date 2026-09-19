const STORAGE_KEY = "schemasay_saved_queries";
const MAX_ITEMS = 40;

export const SAVED_QUERIES_CHANGE_EVENT = "schemasay-saved-queries-change";

export type SavedQueryType = "question" | "sql";

export type SavedQuery = {
  id: string;
  type: SavedQueryType;
  label: string;
  payload: string;
  connectionId?: number;
  createdAt: number;
};

function notify() {
  window.dispatchEvent(new Event(SAVED_QUERIES_CHANGE_EVENT));
}

function load(): SavedQuery[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedQuery[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: SavedQuery[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  notify();
}

function makeId(type: SavedQueryType, payload: string): string {
  return `${type}:${payload.trim()}`;
}

export function getSavedQueries(filter?: SavedQueryType, limit = 20): SavedQuery[] {
  const items = load();
  const filtered = filter ? items.filter((item) => item.type === filter) : items;
  return filtered.slice(0, limit);
}

export function isQuerySaved(type: SavedQueryType, payload: string): boolean {
  const id = makeId(type, payload);
  return load().some((item) => item.id === id);
}

export function saveQuery(input: Omit<SavedQuery, "id" | "createdAt">): SavedQuery {
  const id = makeId(input.type, input.payload);
  const items = load().filter((item) => item.id !== id);
  const next: SavedQuery = {
    ...input,
    id,
    payload: input.payload.trim(),
    createdAt: Date.now(),
  };
  items.unshift(next);
  save(items);
  return next;
}

export function removeSavedQuery(id: string): void {
  save(load().filter((item) => item.id !== id));
}

export function toggleSavedQuery(input: Omit<SavedQuery, "id" | "createdAt">): boolean {
  const id = makeId(input.type, input.payload);
  if (load().some((item) => item.id === id)) {
    removeSavedQuery(id);
    return false;
  }
  saveQuery(input);
  return true;
}

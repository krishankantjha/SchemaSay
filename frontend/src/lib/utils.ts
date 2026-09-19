/** Merge class names, filtering falsy values. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

const STORAGE_KEY = "schemasay_active_connection_id";

export function getStoredConnectionId(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setStoredConnectionId(id: number | null): void {
  if (id === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, String(id));
  }
}

export function formatDbType(dbType: string): string {
  const map: Record<string, string> = {
    postgresql: "PostgreSQL",
    mysql: "MySQL",
    mssql: "SQL Server",
    sqlite: "SQLite",
    file_upload: "File upload",
  };
  return map[dbType] ?? dbType;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRelativeTime(isoOrMs: string | number): string {
  const then = typeof isoOrMs === "number" ? isoOrMs : new Date(isoOrMs).getTime();
  if (!Number.isFinite(then)) return "";
  const delta = Date.now() - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "just now";
  if (delta < hour) return `${Math.floor(delta / minute)}m ago`;
  if (delta < day) return `${Math.floor(delta / hour)}h ago`;
  if (delta < 7 * day) return `${Math.floor(delta / day)}d ago`;
  return new Date(then).toLocaleDateString();
}

export function resolutionSourceLabel(source: string | null | undefined): string {
  const map: Record<string, string> = {
    semantic_metric: "Predefined metric",
    learning_example: "Similar past query",
    llm: "AI-assisted",
    heuristic: "Schema match",
    raw_sql: "Manual SQL",
  };
  return source ? (map[source] ?? source) : "Unknown";
}

/** User-facing routing label for Trust panel and audit summaries. */
export function routingDecisionLabel(decision: string | null | undefined): string {
  const map: Record<string, string> = {
    heuristic_execute: "Direct schema match",
    heuristic_validate: "Schema match with validation",
    llm: "AI-assisted",
    fallback: "Schema rules fallback",
  };
  return decision ? (map[decision] ?? decision.replace(/_/g, " ")) : "";
}

export function llmProviderLabel(provider: string | null | undefined): string {
  const map: Record<string, string> = {
    openai: "OpenAI",
    gemini: "Gemini",
  };
  if (!provider) return "";
  return map[provider] ?? provider;
}

/** Turn raw API / SQLAlchemy errors into short, user-facing messages. */
export function humanizeApiError(raw: string, context: "sync" | "query" = "query"): string {
  if (raw.includes("no column named") || raw.includes("no such column")) {
    return context === "sync"
      ? "SchemaSay's internal database is out of date. Restart the backend after running migrations, then try Sync again."
      : "The app database needs a migration. Contact your admin or restart the backend after updating.";
  }
  if (raw.includes("Failed to connect and introspect")) {
    const inner = raw.replace(/^Failed to connect and introspect database schema:\s*/i, "");
    if (inner.includes("unable to open database file") || inner.includes("no such file")) {
      return "Could not find the database file. Check the file path in Connections and try again.";
    }
    if (inner.includes("OperationalError")) {
      const match = inner.match(/\)\s*([^[\]]+?)(?:\s*\[|$)/);
      if (match?.[1]) return match[1].trim();
    }
  }
  if (raw.length > 280) {
    const firstLine = raw.split("\n")[0];
    return firstLine.length > 280 ? `${firstLine.slice(0, 277)}…` : firstLine;
  }
  return raw;
}

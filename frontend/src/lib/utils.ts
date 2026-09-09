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

export function resolutionSourceLabel(source: string | null | undefined): string {
  const map: Record<string, string> = {
    semantic_metric: "Semantic metric",
    learning_example: "Learning example",
    llm: "LLM",
    heuristic: "Heuristic",
    raw_sql: "Raw SQL",
  };
  return source ? (map[source] ?? source) : "Unknown";
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

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Database, Loader2, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { schemaApi } from "@/lib/api/endpoints";
import { useConnection } from "@/features/connections/ConnectionContext";
import { formatDbType, cn } from "@/lib/utils";

export function ConnectionSelect() {
  const { connections, activeConnection, activeConnectionId, setActiveConnectionId, isLoading } =
    useConnection();

  const { data: schemaTree } = useQuery({
    queryKey: ["schema-tree", activeConnectionId],
    queryFn: () => schemaApi.tree(activeConnectionId!),
    enabled: Boolean(activeConnectionId),
  });

  const tableCount = schemaTree?.tables.length ?? 0;

  if (isLoading) {
    return (
      <span
        className="nav-utility inline-flex min-w-[var(--control-height)] border-transparent bg-transparent px-2.5"
        aria-live="polite"
      >
        <Loader2 className="icon-sm motion-safe:animate-spin text-accent" strokeWidth={2} aria-hidden />
        <span className="sr-only sm:not-sr-only sm:inline">Loading…</span>
      </span>
    );
  }

  if (!connections.length) {
    return (
      <Link
        to="/connections?welcome=1"
        className={cn(
          "nav-utility max-w-[8.5rem] border-dashed px-2.5 no-underline sm:max-w-none sm:px-3",
          "text-accent hover:border-accent/40 hover:bg-accent-muted/30 hover:text-accent",
        )}
      >
        <Plus className="icon-sm shrink-0" strokeWidth={2} aria-hidden />
        <span className="truncate">Add connection</span>
      </Link>
    );
  }

  return (
    <div className="relative min-w-0 max-w-[7.5rem] sm:max-w-[13.75rem] sm:min-w-[10.5rem]">
      <select
        value={activeConnectionId ?? ""}
        onChange={(e) => setActiveConnectionId(Number(e.target.value))}
        aria-label="Select database connection"
        title={
          activeConnection
            ? `${activeConnection.name} · ${formatDbType(activeConnection.db_type)} · Connected${tableCount ? ` · ${tableCount} tables` : ""}`
            : undefined
        }
        className={cn(
          "nav-utility control-base h-[var(--control-height)] w-full appearance-none truncate pl-8 pr-7",
          "cursor-pointer border-border-subtle bg-bg-elevated",
        )}
      >
        {connections.map((conn) => (
          <option key={conn.id} value={conn.id}>
            {conn.name} · {formatDbType(conn.db_type)}
          </option>
        ))}
      </select>
      <Database
        className="pointer-events-none absolute left-2.5 top-1/2 icon-sm -translate-y-1/2 text-accent"
        strokeWidth={2}
        aria-hidden
      />
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 icon-sm -translate-y-1/2 text-text-muted"
        strokeWidth={2}
        aria-hidden
      />
    </div>
  );
}

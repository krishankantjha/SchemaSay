import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Database } from "lucide-react";
import { Link } from "react-router-dom";
import { schemaApi } from "@/lib/api/endpoints";
import { useConnection } from "@/features/connections/ConnectionContext";
import { formatDbType } from "@/lib/utils";

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
    return <span className="hidden text-xs text-text-muted sm:inline">Loading…</span>;
  }

  if (!connections.length) {
    return (
      <Link
        to="/connections?welcome=1"
        className="flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-border-default px-3 text-xs text-text-secondary no-underline hover:border-accent hover:text-accent"
      >
        <Database className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Add connection</span>
      </Link>
    );
  }

  return (
    <div className="relative hidden min-w-[160px] max-w-[200px] sm:block">
      <select
        value={activeConnectionId ?? ""}
        onChange={(e) => setActiveConnectionId(Number(e.target.value))}
        aria-label="Select database connection"
        title={
          activeConnection
            ? `${activeConnection.name} · ${formatDbType(activeConnection.db_type)} · Connected${tableCount ? ` · ${tableCount} tables` : ""}`
            : undefined
        }
        className="h-9 w-full appearance-none truncate rounded-lg border border-border-default bg-bg-elevated pl-8 pr-7 text-xs text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-accent/15"
      >
        {connections.map((conn) => (
          <option key={conn.id} value={conn.id}>
            {conn.name} · {formatDbType(conn.db_type)}
          </option>
        ))}
      </select>
      <Database className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-accent" />
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
    </div>
  );
}

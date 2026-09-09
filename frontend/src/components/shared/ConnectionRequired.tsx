import { Link } from "react-router-dom";
import { Database } from "lucide-react";
import { useConnection } from "@/features/connections/ConnectionContext";
import { Button } from "@/components/ui/Button";

type ConnectionRequiredProps = {
  children: React.ReactNode;
  title?: string;
};

export function ConnectionRequired({ children, title = "Connect a database" }: ConnectionRequiredProps) {
  const { activeConnectionId, isLoading } = useConnection();

  if (isLoading) {
    return <p className="text-sm text-text-muted">Loading connections…</p>;
  }

  if (!activeConnectionId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <Database className="mb-3 h-10 w-10 text-accent" />
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        <p className="mt-2 max-w-md text-sm text-text-secondary">
          Select or create a connection first, then sync your schema.
        </p>
        <Link to="/connections" className="mt-4">
          <Button>Go to Connections</Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

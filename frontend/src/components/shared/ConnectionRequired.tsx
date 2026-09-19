import { Link } from "react-router-dom";
import { Database } from "lucide-react";
import { useConnection } from "@/features/connections/ConnectionContext";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageShell } from "@/components/ui/PageShell";
import { SkeletonLines } from "@/components/ui/Skeleton";

type ConnectionRequiredProps = {
  children: React.ReactNode;
  title?: string;
};

export function ConnectionRequired({ children, title = "Connect a database" }: ConnectionRequiredProps) {
  const { activeConnectionId, isLoading } = useConnection();

  if (isLoading) {
    return (
      <PageShell>
        <div className="py-6" role="status" aria-label="Loading connections">
          <SkeletonLines lines={3} />
        </div>
      </PageShell>
    );
  }

  if (!activeConnectionId) {
    return (
      <PageShell>
        <EmptyState
          icon={Database}
          title={title}
          description="Select or create a connection first, then sync your schema."
          action={
            <Link to="/connections" className="no-underline">
              <Button>Go to Connections</Button>
            </Link>
          }
        />
      </PageShell>
    );
  }

  return <>{children}</>;
}

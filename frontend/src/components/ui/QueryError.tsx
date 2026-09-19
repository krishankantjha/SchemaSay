import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type QueryErrorProps = {
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
};

export function QueryError({
  message = "Could not load data. Check your connection and try again.",
  onRetry,
  retrying = false,
  className,
}: QueryErrorProps) {
  return (
    <Alert variant="danger" title="Failed to load" className={className}>
      <p>{message}</p>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={onRetry}
          loading={retrying}
        >
          Retry
        </Button>
      ) : null}
    </Alert>
  );
}

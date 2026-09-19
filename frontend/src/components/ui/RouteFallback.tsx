import { Skeleton } from "@/components/ui/Skeleton";

export function RouteFallback() {
  return (
    <div className="space-y-4 px-1 py-2" role="status" aria-label="Loading page">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

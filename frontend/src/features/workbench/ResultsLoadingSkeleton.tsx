import { Skeleton } from "@/components/ui/Skeleton";

export function ResultsLoadingSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Preparing results">
      <div className="rounded-[var(--radius-md)] border border-brand/20 bg-[var(--color-brand-muted)] px-4 py-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-4/5" />
        <Skeleton className="mt-2 h-3 w-2/3" />
      </div>

      <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface p-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="mt-3 h-16 w-full" />
      </div>

      <div className="rounded-[var(--radius-md)] border border-border-subtle">
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/5" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

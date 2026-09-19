import { Clock } from "lucide-react";
import { getRecentActions, type RecentAction } from "@/lib/recent-actions";
import { Button } from "@/components/ui/Button";

type RecentQueriesProps = {
  onSelect: (question: string) => void;
  filter?: "question" | "sql";
  limit?: number;
  className?: string;
};

export function RecentQueries({
  onSelect,
  filter = "question",
  limit = 4,
  className,
}: RecentQueriesProps) {
  const items = getRecentActions(limit * 2).filter(
    (item): item is RecentAction & { payload: string } =>
      item.type === filter && Boolean(item.payload),
  ).slice(0, limit);

  if (!items.length) return null;

  return (
    <div className={className}>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        <Clock className="h-3 w-3" aria-hidden />
        Recent
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="secondary"
            size="sm"
            className="chip-interactive max-w-full truncate rounded-full"
            onClick={() => onSelect(item.payload!)}
            title={item.label}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

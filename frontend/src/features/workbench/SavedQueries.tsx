import { useEffect, useState } from "react";
import { Bookmark, BookmarkX } from "lucide-react";
import {
  getSavedQueries,
  removeSavedQuery,
  SAVED_QUERIES_CHANGE_EVENT,
  type SavedQueryType,
} from "@/lib/saved-queries";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";

type SavedQueriesProps = {
  onSelect: (payload: string) => void;
  filter?: SavedQueryType;
  limit?: number;
  className?: string;
};

export function SavedQueries({
  onSelect,
  filter = "question",
  limit = 4,
  className,
}: SavedQueriesProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener(SAVED_QUERIES_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(SAVED_QUERIES_CHANGE_EVENT, onChange);
  }, []);

  void tick;
  const items = getSavedQueries(filter, limit);

  if (!items.length) return null;

  return (
    <div className={className}>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        <Bookmark className="h-3 w-3" aria-hidden />
        Saved
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item.id} className="inline-flex max-w-full items-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="chip-interactive max-w-full truncate rounded-full"
              onClick={() => onSelect(item.payload)}
              title={item.label}
            >
              {item.label}
            </Button>
            <Tooltip content="Remove saved query">
              <button
                type="button"
                className="pressable ml-1 rounded-full p-1 text-text-muted hover:border hover:border-border-subtle hover:bg-bg-elevated hover:text-text-secondary"
                aria-label={`Remove ${item.label}`}
                onClick={() => removeSavedQuery(item.id)}
              >
                <BookmarkX className="h-3.5 w-3.5" aria-hidden />
              </button>
            </Tooltip>
          </span>
        ))}
      </div>
    </div>
  );
}

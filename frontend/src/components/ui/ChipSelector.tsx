import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils";

type ChipSelectorProps = {
  label: string;
  description?: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
};

export function ChipSelector({
  label,
  description,
  options,
  selected,
  onChange,
  placeholder = "Search to add…",
}: ChipSelectorProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return options.filter(
      (opt) => !selected.includes(opt) && (!q || opt.toLowerCase().includes(q)),
    );
  }, [options, selected, search]);

  function add(value: string) {
    onChange([...selected, value]);
    setSearch("");
  }

  function remove(value: string) {
    onChange(selected.filter((v) => v !== value));
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-0 text-text-primary">{label}</Label>
        {description ? <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{description}</p> : null}
      </div>

      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-[var(--color-danger-muted)] px-2 py-1 text-xs font-medium text-danger"
            >
              {item}
              <button
                type="button"
                onClick={() => remove(item)}
                className="rounded-sm p-0.5 transition-colors hover:bg-danger/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted">None blocked</p>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          aria-label={`Search ${label.toLowerCase()}`}
        />
      </div>

      {search.trim() && filtered.length ? (
        <ul className="max-h-36 overflow-y-auto rounded-lg border border-border-subtle bg-bg-elevated p-1 shadow-sm">
          {filtered.slice(0, 20).map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onClick={() => add(opt)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs",
                  "text-text-secondary transition-colors",
                  "hover:bg-bg-surface hover:text-text-primary",
                  "focus-ring",
                )}
              >
                <span className="font-mono">{opt}</span>
                <Badge variant="default">Add</Badge>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

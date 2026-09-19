import { useMemo, type ChangeEvent, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SqlEditorProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  value: string;
  minLines?: number;
  toolbar?: ReactNode;
  lineCount?: number;
};

export function SqlEditor({
  value,
  minLines = 12,
  onChange,
  onKeyDown,
  toolbar,
  lineCount,
  ...props
}: SqlEditorProps) {
  const lines = useMemo(() => {
    const count = Math.max(value.split("\n").length, minLines);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [value, minLines]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = `${value.slice(0, start)}  ${value.slice(end)}`;
      onChange?.({ target: { value: next } } as ChangeEvent<HTMLTextAreaElement>);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
    onKeyDown?.(e);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-bg-elevated shadow-sm">
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-bg-surface px-3 py-2">
          {toolbar}
          {lineCount != null ? (
            <span className="text-[10px] tabular-nums text-text-muted">{lineCount} lines</span>
          ) : null}
        </div>
      ) : null}
      <div className="flex">
        <div
          aria-hidden
          className="select-none border-r border-border-subtle bg-bg-surface/80 px-3 py-3 font-mono text-xs leading-6 text-text-muted"
        >
          {lines.map((n) => (
            <div key={n} className="text-right">
              {n}
            </div>
          ))}
        </div>
        <textarea
          {...props}
          value={value}
          spellCheck={false}
          aria-label="SQL query editor"
          onChange={onChange}
          onKeyDown={handleKeyDown}
          className={cn(
            "min-h-[200px] w-full flex-1 resize-none bg-transparent px-4 py-3 sm:min-h-[240px] sm:resize-y",
            "font-mono text-sm leading-6 text-text-primary",
            "placeholder:text-text-muted focus:outline-none lg:min-h-[300px]",
          )}
        />
      </div>
    </div>
  );
}

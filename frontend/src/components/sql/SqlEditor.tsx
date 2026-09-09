import { useMemo, type ChangeEvent, type KeyboardEvent, type TextareaHTMLAttributes } from "react";

type SqlEditorProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  value: string;
  minLines?: number;
};

export function SqlEditor({ value, minLines = 12, onChange, onKeyDown, ...props }: SqlEditorProps) {
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
    <div className="overflow-hidden rounded-xl border border-border-default bg-bg-elevated shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex">
        <div
          aria-hidden
          className="select-none border-r border-border-subtle bg-bg-surface px-3 py-3 font-mono text-xs leading-6 text-text-muted"
        >
          {lines.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        <textarea
          {...props}
          value={value}
          spellCheck={false}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          className="min-h-[240px] w-full flex-1 resize-y bg-transparent px-4 py-3 font-mono text-sm leading-6 text-text-primary placeholder:text-text-muted focus:outline-none lg:min-h-[320px]"
        />
      </div>
    </div>
  );
}

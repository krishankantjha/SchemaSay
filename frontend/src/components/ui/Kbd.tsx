import { cn } from "@/lib/utils";

type KbdProps = {
  children: React.ReactNode;
  className?: string;
};

export function Kbd({ children, className }: KbdProps) {
  return <kbd className={cn("kbd-chip", className)}>{children}</kbd>;
}

type ShortcutHintProps = {
  keys: string[];
  label?: string;
  className?: string;
};

export function ShortcutHint({ keys, label, className }: ShortcutHintProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] text-text-muted", className)}>
      <span className="inline-flex items-center gap-1">
        {keys.map((key, i) => (
          <span key={`${key}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 ? <span aria-hidden>+</span> : null}
            <Kbd>{key}</Kbd>
          </span>
        ))}
      </span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}

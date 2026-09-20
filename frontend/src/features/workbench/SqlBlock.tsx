import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, Copy, SquareArrowOutUpRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { highlightSql } from "@/lib/sql-highlight";
import { cn } from "@/lib/utils";

type SqlBlockProps = {
  sql: string;
  defaultCollapsed?: boolean;
  /** When true, collapsed state shows only action buttons — no SQL preview line. */
  disclosure?: boolean;
};

export function SqlBlock({ sql, defaultCollapsed = false, disclosure = false }: SqlBlockProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const lineCount = sql.split("\n").length;

  useEffect(() => {
    setCollapsed(defaultCollapsed);
  }, [sql, defaultCollapsed]);

  async function copy() {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    window.setTimeout(() => setCopied(false),  2000);
  }

  if (disclosure && collapsed) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setCollapsed(false)}>
          Show SQL
        </Button>
        <Link
          to="/sql"
          state={{ sql }}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-[var(--radius-md)] px-2 text-xs text-text-secondary no-underline hover:text-text-primary"
        >
          <SquareArrowOutUpRight className="h-3.5 w-3.5" aria-hidden />
          Open in SQL editor
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="flex min-h-[36px] items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary transition-colors duration-150 hover:text-text-primary"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
          Generated SQL
          <span className="font-normal normal-case tracking-normal text-text-muted">
            {lineCount} line{lineCount === 1 ? "" : "s"}
          </span>
        </button>
        <div className="flex items-center gap-1">
          <Link
            to="/sql"
            state={{ sql }}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-[var(--radius-md)] px-2 text-xs text-text-secondary no-underline hover:text-text-primary"
          >
            <SquareArrowOutUpRight className="h-3.5 w-3.5" aria-hidden />
            Editor
          </Link>
          <Button variant="ghost" size="sm" onClick={() => void copy()} aria-label="Copy SQL">
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      {!collapsed ? (
        <pre className={cn("sql-block max-h-56 overflow-auto rounded-none border-0 animate-reveal")}>
          <code dangerouslySetInnerHTML={{ __html: highlightSql(sql) }} />
        </pre>
      ) : disclosure ? null : (
        <p className="truncate px-3 py-2 font-mono text-[11px] text-text-muted">{sql.replace(/\s+/g, " ")}</p>
      )}
    </div>
  );
}

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

const KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "HAVING", "JOIN", "LEFT", "RIGHT",
  "INNER", "OUTER", "ON", "AS", "AND", "OR", "NOT", "IN", "LIMIT", "OFFSET", "DISTINCT",
  "SUM", "COUNT", "AVG", "MIN", "MAX", "CASE", "WHEN", "THEN", "ELSE", "END",
]);

function highlightSql(sql: string): string {
  const tokens = sql.split(/(\s+|[(),.*;=<>!]+)/);
  return tokens
    .map((token) => {
      const upper = token.toUpperCase();
      if (KEYWORDS.has(upper)) return `<span class="kw">${token}</span>`;
      if (/^'.*'$/.test(token) || /^".*"$/.test(token)) return `<span class="str">${token}</span>`;
      if (/^\d+(\.\d+)?$/.test(token)) return `<span class="fn">${token}</span>`;
      return token;
    })
    .join("");
}

type SqlBlockProps = {
  sql: string;
};

export function SqlBlock({ sql }: SqlBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          Generated SQL
        </span>
        <Button variant="ghost" size="sm" onClick={() => void copy()}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="sql-block max-h-48 overflow-auto">
        <code dangerouslySetInnerHTML={{ __html: highlightSql(sql) }} />
      </pre>
    </div>
  );
}

import { Lightbulb, ScrollText, Sparkles, Table2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api/endpoints";
import { useConnection } from "@/features/connections/ConnectionContext";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import type { SchemaTableNode } from "@/lib/api/types";
import { buildStarterQuestions } from "@/lib/starter-questions";
import { RecentQueries } from "@/features/workbench/RecentQueries";
import { SavedQueries } from "@/features/workbench/SavedQueries";

type AskEmptyHeroProps = {
  tableCount?: number;
  tables?: SchemaTableNode[];
  onTryExample: (question: string) => void;
  onSelectRecent: (question: string) => void;
};

export function AskEmptyHero({
  tableCount,
  tables = [],
  onTryExample,
  onSelectRecent,
}: AskEmptyHeroProps) {
  const starterQuestions = buildStarterQuestions(tables);
  return (
    <div className="mb-3 animate-reveal">
      <h2 className="type-display text-lg">Ask anything about your data</h2>
      <p className="type-body mt-0.5 max-w-xl leading-normal">
        Ask in plain English — SchemaSay generates governed SQL, validates it, and returns results
        with a trust score. Works offline with the built-in heuristic engine; add an API key only
        when you want help on harder questions.
        {tableCount != null && tableCount > 0
          ? ` ${tableCount} table${tableCount === 1 ? "" : "s"} in the sidebar.`
          : null}
      </p>
      <p className="mt-2 text-xs text-text-muted">
        Tip: define a few{" "}
        <Link to="/metrics" className="font-medium text-accent">
          semantic metrics
        </Link>{" "}
        for instant KPI answers without full NL→SQL.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Tip icon={Table2} title="Browse schema">
          Drag columns from the sidebar or click + to insert.
        </Tip>
        <Tip icon={Sparkles} title="Plain English">
          Business questions mapped to the right tables and metrics.
        </Tip>
        <Tip icon={Lightbulb} title="Trust signals">
          SQL, validation checks, and confidence in Query Trust.
        </Tip>
      </div>

      <RecentQueries className="mt-3" onSelect={onSelectRecent} limit={6} />
      <SavedQueries className="mt-3" onSelect={onSelectRecent} />
      <QueryHistoryStrip onSelect={onSelectRecent} />

      <div className="mt-4">
        <p className="type-meta mb-1.5">Try asking</p>
        <div className="flex flex-wrap gap-2">
          {starterQuestions.map((ex) => (
            <Button
              key={ex}
              type="button"
              variant="secondary"
              size="sm"
              className="chip-interactive h-auto max-w-full whitespace-normal rounded-full px-3 py-1.5 text-left text-xs leading-snug"
              onClick={() => onTryExample(ex)}
            >
              <Sparkles className="icon-sm shrink-0" strokeWidth={2} aria-hidden />
              {ex}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function QueryHistoryStrip({ onSelect }: { onSelect: (question: string) => void }) {
  const { activeConnectionId } = useConnection();
  const { data: logs = [] } = useQuery({
    queryKey: ["audit-recent", activeConnectionId],
    queryFn: () => auditApi.list({ limit: 4, connection_id: activeConnectionId ?? undefined }),
    enabled: Boolean(activeConnectionId),
    staleTime: 30_000,
  });

  if (!logs.length) return null;

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          <ScrollText className="h-3 w-3" aria-hidden />
          History
        </p>
        <Link to="/audit" className="text-[11px] font-medium text-accent no-underline hover:text-accent-hover">
          View audit log
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {logs.map((log) => (
          <Tooltip key={log.id} content={`${log.status} · ${new Date(log.created_at).toLocaleString()}`}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="chip-interactive max-w-full truncate rounded-full border border-border-subtle bg-bg-elevated/40"
              onClick={() => onSelect(log.question)}
            >
              {log.question}
            </Button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

function Tip({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Table2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border-subtle/80 bg-bg-elevated/20 px-2.5 py-2">
      <div className="mb-0.5 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-accent/80" strokeWidth={2} aria-hidden />
        <p className="text-xs font-medium text-text-primary">{title}</p>
      </div>
      <p className="text-[11px] leading-snug text-text-muted">{children}</p>
    </div>
  );
}

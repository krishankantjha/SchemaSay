import { useEffect, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/app/ToastContext";
import {
  Bookmark,
  Clock,
  Database,
  LineChart,
  MessageSquare,
  Moon,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Shield,
  Sun,
  Terminal,
  X,
} from "lucide-react";
import { useTheme } from "@/app/ThemeContext";
import { useConnection } from "@/features/connections/ConnectionContext";
import { useCommandPalette } from "@/features/command/CommandPaletteContext";
import { NAV_ITEMS } from "@/components/layout/navConfig";
import { auditApi, schemaApi } from "@/lib/api/endpoints";
import { getRecentActions } from "@/lib/recent-actions";
import { getSavedQueries } from "@/lib/saved-queries";
import { Kbd } from "@/components/ui/Kbd";
import { modKeyLabel } from "@/lib/keyboard";

export function CommandPalette() {
  const { open, setOpen, setShortcutsOpen } = useCommandPalette();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { activeConnectionId, connections } = useConnection();
  const queryClient = useQueryClient();
  const { push: toast } = useToast();
  const [search, setSearch] = useState("");
  const [recentVersion, setRecentVersion] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);
  useFocusTrap(dialogRef, open);

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["audit-recent", activeConnectionId],
    queryFn: () => auditApi.list({ limit: 5, connection_id: activeConnectionId ?? undefined }),
    enabled: open && Boolean(activeConnectionId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    setRecentVersion((v) => v + 1);
  }, [open]);

  const recentLocal = getRecentActions(6);
  const savedQueries = getSavedQueries(undefined, 6);
  void recentVersion;

  function run(action: () => void) {
    action();
    setOpen(false);
  }

  async function syncSchema(profile = false) {
    if (!activeConnectionId) return;
    try {
      await schemaApi.sync(activeConnectionId, profile);
      await queryClient.invalidateQueries({ queryKey: ["schema-tree", activeConnectionId] });
      toast("Schema synced — tables are ready to explore", "success");
    } catch {
      toast("Sync failed", "error");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] motion-safe:animate-overlay-in">
      <button
        type="button"
        className="absolute inset-0 bg-bg-overlay/60 backdrop-blur-sm"
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-lg px-4"
      >
      <Command
        className="animate-dialog-in overflow-hidden rounded-xl border border-border-default bg-bg-surface shadow-2xl"
        label="Command palette"
        shouldFilter
      >
        <div className="flex items-center gap-2 border-b border-border-subtle px-3">
          <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Search commands, pages, recent queries…"
            className="h-12 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <Kbd className="hidden sm:inline-flex">{modKeyLabel()}K</Kbd>
        </div>

        <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-text-muted">
            No results found.
          </Command.Empty>

          <Command.Group heading="Navigation" className="cmd-group">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <Command.Item
                key={to}
                value={`go ${label} ${to}`}
                onSelect={() => run(() => navigate(to))}
                className="cmd-item"
              >
                <Icon className="h-4 w-4 text-text-muted" aria-hidden />
                <span>{label}</span>
              </Command.Item>
            ))}
            <Command.Item
              value="connections manage database"
              onSelect={() => run(() => navigate("/connections"))}
              className="cmd-item"
            >
              <Database className="h-4 w-4 text-text-muted" aria-hidden />
              <span>Connections</span>
            </Command.Item>
          </Command.Group>

          {recentLocal.length > 0 ? (
            <Command.Group heading="Recent" className="cmd-group">
              {recentLocal.map((item) => (
                <Command.Item
                  key={item.id}
                  value={`recent ${item.label} ${item.payload ?? ""}`}
                  onSelect={() =>
                    run(() => {
                      if (item.type === "question") {
                        navigate("/ask", { state: { question: item.payload } });
                      } else if (item.type === "sql") {
                        navigate("/sql", { state: { sql: item.payload } });
                      } else if (item.payload) {
                        navigate(item.payload);
                      }
                    })
                  }
                  className="cmd-item"
                >
                  <Clock className="h-4 w-4 text-text-muted" aria-hidden />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto text-[10px] uppercase text-text-muted">{item.type}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}

          {savedQueries.length > 0 ? (
            <Command.Group heading="Saved" className="cmd-group">
              {savedQueries.map((item) => (
                <Command.Item
                  key={item.id}
                  value={`saved ${item.label} ${item.payload}`}
                  onSelect={() =>
                    run(() => {
                      if (item.type === "question") {
                        navigate("/ask", { state: { question: item.payload } });
                      } else {
                        navigate("/sql", { state: { sql: item.payload } });
                      }
                    })
                  }
                  className="cmd-item"
                >
                  <Bookmark className="h-4 w-4 text-text-muted" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}

          {auditLogs.length > 0 ? (
            <Command.Group heading="Query history" className="cmd-group">
              {auditLogs.map((log) => (
                <Command.Item
                  key={log.id}
                  value={`audit ${log.question} ${log.sql_query}`}
                  onSelect={() =>
                    run(() => navigate("/ask", { state: { question: log.question } }))
                  }
                  className="cmd-item"
                >
                  <MessageSquare className="h-4 w-4 text-text-muted" aria-hidden />
                  <span className="truncate">{log.question}</span>
                </Command.Item>
              ))}
              <Command.Item
                value="view all audit history"
                onSelect={() => run(() => navigate("/audit"))}
                className="cmd-item"
              >
                <ScrollText className="h-4 w-4 text-text-muted" aria-hidden />
                <span>View full audit log</span>
              </Command.Item>
            </Command.Group>
          ) : null}

          <Command.Group heading="Actions" className="cmd-group">
            <Command.Item
              value="new connection add database"
              onSelect={() => run(() => navigate("/connections?welcome=1"))}
              className="cmd-item"
            >
              <Plus className="h-4 w-4 text-text-muted" aria-hidden />
              <span>Add connection</span>
            </Command.Item>
            {activeConnectionId ? (
              <>
                <Command.Item
                  value="sync schema refresh"
                  onSelect={() => run(() => void syncSchema(false))}
                  className="cmd-item"
                >
                  <RefreshCw className="h-4 w-4 text-text-muted" aria-hidden />
                  <span>Sync schema</span>
                </Command.Item>
                <Command.Item
                  value="ask question new query"
                  onSelect={() => run(() => navigate("/ask"))}
                  className="cmd-item"
                >
                  <MessageSquare className="h-4 w-4 text-text-muted" aria-hidden />
                  <span>Ask a question</span>
                </Command.Item>
                <Command.Item
                  value="run sql editor"
                  onSelect={() => run(() => navigate("/sql"))}
                  className="cmd-item"
                >
                  <Terminal className="h-4 w-4 text-text-muted" aria-hidden />
                  <span>Open SQL editor</span>
                </Command.Item>
                <Command.Item
                  value="explore schema tables"
                  onSelect={() => run(() => navigate("/schema"))}
                  className="cmd-item"
                >
                  <Database className="h-4 w-4 text-text-muted" aria-hidden />
                  <span>Explore schema</span>
                </Command.Item>
                <Command.Item
                  value="metrics kpis"
                  onSelect={() => run(() => navigate("/metrics"))}
                  className="cmd-item"
                >
                  <LineChart className="h-4 w-4 text-text-muted" aria-hidden />
                  <span>View metrics</span>
                </Command.Item>
                <Command.Item
                  value="govern policy"
                  onSelect={() => run(() => navigate("/govern"))}
                  className="cmd-item"
                >
                  <Shield className="h-4 w-4 text-text-muted" aria-hidden />
                  <span>Governance settings</span>
                </Command.Item>
              </>
            ) : connections.length === 0 ? (
              <Command.Item
                value="connect database first"
                onSelect={() => run(() => navigate("/connections?welcome=1"))}
                className="cmd-item"
              >
                <Database className="h-4 w-4 text-text-muted" aria-hidden />
                <span>Connect a database first</span>
              </Command.Item>
            ) : null}
            <Command.Item
              value="toggle theme dark light"
              onSelect={() => run(() => toggleTheme())}
              className="cmd-item"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-text-muted" aria-hidden />
              ) : (
                <Moon className="h-4 w-4 text-text-muted" aria-hidden />
              )}
              <span>Toggle {theme === "dark" ? "light" : "dark"} mode</span>
            </Command.Item>
            <Command.Item
              value="keyboard shortcuts help"
              onSelect={() =>
                run(() => {
                  setShortcutsOpen(true);
                })
              }
              className="cmd-item"
            >
              <span className="flex h-4 w-4 items-center justify-center text-[10px] font-bold text-text-muted">
                ?
              </span>
              <span>Keyboard shortcuts</span>
            </Command.Item>
          </Command.Group>
        </Command.List>

        <div className="flex items-center justify-between border-t border-border-subtle px-3 py-2 text-[10px] text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑↓</Kbd>
            <span>navigate</span>
            <Kbd>Enter</Kbd>
            <span>select</span>
            <Kbd>Esc</Kbd>
            <span>close</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-bg-elevated hover:text-text-secondary"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </Command>
      </div>
    </div>
  );
}

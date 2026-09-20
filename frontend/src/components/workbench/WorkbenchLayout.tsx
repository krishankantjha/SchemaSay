import { useEffect, useState, type ReactNode } from "react";
import { Database, ShieldCheck } from "lucide-react";
import {
  SchemaMobileDrawer,
  SchemaMobileToggle,
} from "@/components/workbench/SchemaMobileDrawer";
import {
  TrustMobileDrawer,
  TrustMobileToggle,
} from "@/components/workbench/TrustMobileDrawer";
import type { SchemaTableNode, QueryExplanation } from "@/lib/api/types";
import { SchemaTreeSidebar } from "@/features/workbench/SchemaTreeSidebar";
import { QueryTrustPanel } from "@/features/workbench/QueryTrustPanel";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MEDIA } from "@/lib/breakpoints";
import { cn } from "@/lib/utils";

type SchemaProps = {
  tables: SchemaTableNode[];
  isLoading: boolean;
  loadFailed?: boolean;
  syncError?: string | null;
  onSync: (profile: boolean) => void;
  isSyncing: boolean;
  lastSyncedAt?: number | null;
  syncSuccessAt?: number | null;
  connectionName?: string;
  onInsertColumn?: (ref: string) => void;
  onInsertTable?: (name: string) => void;
};

type TrustProps = {
  explanation: QueryExplanation | null;
  correlationId?: string | null;
  error?: string | null;
  sql?: string | null;
  running?: boolean;
};

export type TrustPanelControls = {
  open: () => void;
};

type WorkbenchLayoutProps = {
  children: ReactNode;
  schema: SchemaProps;
  trust: TrustProps;
  defaultSchemaCollapsed?: boolean;
  defaultTrustCollapsed?: boolean;
  onTrustControlsReady?: (controls: TrustPanelControls) => void;
};

export function WorkbenchLayout({
  children,
  schema,
  trust,
  defaultSchemaCollapsed = false,
  defaultTrustCollapsed = false,
  onTrustControlsReady,
}: WorkbenchLayoutProps) {
  const isLg = useMediaQuery(MEDIA.lg);
  const isXl = useMediaQuery(MEDIA.xl);
  const [schemaDrawerOpen, setSchemaDrawerOpen] = useState(false);
  const [trustDrawerOpen, setTrustDrawerOpen] = useState(false);
  const [schemaCollapsed, setSchemaCollapsed] = useState(defaultSchemaCollapsed);
  const [trustCollapsed, setTrustCollapsed] = useState(defaultTrustCollapsed);

  useEffect(() => {
    onTrustControlsReady?.({
      open: () => {
        if (isXl) {
          setTrustCollapsed(false);
        } else {
          setTrustDrawerOpen(true);
        }
      },
    });
  }, [isXl, onTrustControlsReady]);

  const showSchemaSidebar = isLg && !schemaCollapsed;
  const showTrustSidebar = isXl && !trustCollapsed;

  function closeSchemaDrawer() {
    setSchemaDrawerOpen(false);
  }

  function closeTrustDrawer() {
    setTrustDrawerOpen(false);
  }

  return (
    <div
      className={cn(
        "workbench-shell relative flex min-h-0 flex-1 flex-col overflow-hidden",
        "border-y border-border-subtle sm:mx-[var(--space-layout-x)] sm:rounded-[var(--radius-lg)] sm:border",
      )}
    >
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {showSchemaSidebar ? (
          <div
            className="workbench-panel-side hidden min-h-0 w-[var(--workbench-side-width)] shrink-0 overflow-hidden border-r lg:flex lg:flex-col xl:w-[var(--workbench-side-width-lg)]"
          >
            <SchemaTreeSidebar
              {...schema}
              onInsertColumn={(ref) => {
                schema.onInsertColumn?.(ref);
                closeSchemaDrawer();
              }}
              onInsertTable={(name) => {
                schema.onInsertTable?.(name);
                closeSchemaDrawer();
              }}
              onCollapse={() => setSchemaCollapsed(true)}
            />
          </div>
        ) : null}

        <div className="workbench-panel-center relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {isLg && schemaCollapsed ? (
            <button
              type="button"
              onClick={() => setSchemaCollapsed(false)}
              className="workbench-edge-tab workbench-edge-tab-left"
              aria-label="Show schema panel"
            >
              <Database className="icon-sm text-accent" strokeWidth={2} aria-hidden />
              Schema
            </button>
          ) : null}

          {isXl && trustCollapsed ? (
            <button
              type="button"
              onClick={() => setTrustCollapsed(false)}
              className="workbench-edge-tab workbench-edge-tab-right"
              aria-label="Show query trust panel"
            >
              Trust
              <ShieldCheck className="icon-sm text-accent" strokeWidth={2} aria-hidden />
            </button>
          ) : null}

          {children}
        </div>

        {showTrustSidebar ? (
          <div className="workbench-panel-side flex min-h-0 w-[var(--workbench-trust-width)] shrink-0 flex-col overflow-hidden border-l">
            <QueryTrustPanel {...trust} onCollapse={() => setTrustCollapsed(true)} />
          </div>
        ) : null}
      </div>

      <SchemaMobileDrawer
        open={schemaDrawerOpen}
        onClose={closeSchemaDrawer}
        {...schema}
        onInsertColumn={(ref) => {
          schema.onInsertColumn?.(ref);
          closeSchemaDrawer();
        }}
        onInsertTable={(name) => {
          schema.onInsertTable?.(name);
          closeSchemaDrawer();
        }}
      />

      <TrustMobileDrawer
        open={trustDrawerOpen}
        onClose={closeTrustDrawer}
        {...trust}
      />

      {!isLg ? (
        <SchemaMobileToggle
          onClick={() => setSchemaDrawerOpen(true)}
          tableCount={schema.tables.length}
        />
      ) : null}

      {!isXl ? (
        <TrustMobileToggle onClick={() => setTrustDrawerOpen(true)} />
      ) : null}
    </div>
  );
}

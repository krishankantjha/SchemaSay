import { Database } from "lucide-react";
import { useToast } from "@/app/ToastContext";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfidenceRing } from "@/components/ui/ConfidenceRing";
import { Kbd, ShortcutHint } from "@/components/ui/Kbd";
import { Tooltip } from "@/components/ui/Tooltip";
import { PageListSkeleton, Skeleton, SkeletonLines } from "@/components/ui/Skeleton";
import { modKeyLabel } from "@/lib/keyboard";

export function ThemeShowcasePage() {
  const { push: toast } = useToast();

  return (
    <PageShell width="wide">
      <PageHeader
        title="Theme showcase"
        description="Phase 1 design system — cool navy surfaces, restrained purple/teal palette, 4-level typography."
      />

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Typography hierarchy</CardTitle>
            <CardDescription>Four semantic levels — display, heading, body, meta.</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            <div>
              <p className="type-meta mb-1">Level 1 — Display</p>
              <p className="type-display">Page title and hero headings</p>
            </div>
            <div>
              <p className="type-meta mb-1">Level 2 — Heading</p>
              <p className="type-heading">Section and card titles</p>
            </div>
            <div>
              <p className="type-meta mb-1">Level 3 — Body</p>
              <p className="type-body">Content, labels, and descriptions for reading</p>
            </div>
            <div>
              <p className="type-meta mb-1">Level 4 — Meta</p>
              <p className="type-meta">Captions, overlines, table headers</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Surfaces</CardTitle>
            <CardDescription>Cool dark navy stack with subtle borders.</CardDescription>
          </CardHeader>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-10 flex-1 rounded-[var(--radius-md)] border border-border-subtle bg-bg-base shadow-sm" />
              <span className="type-meta normal-case tracking-normal">base</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 flex-1 rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface shadow-sm" />
              <span className="type-meta normal-case tracking-normal">surface</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 flex-1 rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated shadow-sm" />
              <span className="type-meta normal-case tracking-normal">elevated</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accent roles</CardTitle>
            <CardDescription>Teal for actions; purple for AI/branding only.</CardDescription>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-accent/30 bg-accent-muted px-2.5 py-1.5 text-xs font-medium text-accent">
              <span className="h-2 w-2 rounded-full bg-accent" /> Teal — actions
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-brand/30 bg-brand-muted px-2.5 py-1.5 text-xs font-medium text-brand">
              <span className="h-2 w-2 rounded-full bg-brand" /> Purple — AI
            </span>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
            <CardDescription>Hover, focus ring, and 1px press.</CardDescription>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="accent">Semantic metric</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="danger">Blocked</Badge>
            <Badge variant="pii">PII</Badge>
            <Badge variant="info">Info</Badge>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Form controls</CardTitle>
            <CardDescription>Unified height, focus ring, and error states.</CardDescription>
          </CardHeader>
          <div className="max-w-sm space-y-3">
            <div>
              <Label htmlFor="demo-input">Ask a question</Label>
              <Input id="demo-input" placeholder="Total revenue by region" />
            </div>
            <div>
              <Label htmlFor="demo-error">With error</Label>
              <Input id="demo-error" error="Please enter a question" defaultValue="bad" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SQL block</CardTitle>
            <CardDescription>Monospace syntax colors from tokens.</CardDescription>
          </CardHeader>
          <pre className="sql-block">
            <code>
              <span className="kw">SELECT</span> region, <span className="fn">SUM</span>(total_amount){"\n"}
              <span className="kw">FROM</span> orders{"\n"}
              <span className="kw">WHERE</span> created_at &gt;= <span className="str">'2024-01-01'</span>
              <span className="cmt"> -- governed query</span>
            </code>
          </pre>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <Alert variant="info">Schema sync recommended after schema changes.</Alert>
            <Alert variant="success">Connection test succeeded.</Alert>
            <Alert variant="warning">High confidence threshold is enabled.</Alert>
            <Alert variant="danger">Query blocked by governance policy.</Alert>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>States</CardTitle>
          </CardHeader>
          <div className="space-y-6">
            <LoadingState message="Loading schema…" size="sm" />
            <EmptyState
              icon={Database}
              title="No connection"
              description="Add a database connection to get started."
              compact
              action={<Button size="sm">Add connection</Button>}
            />
            <ConfidenceRing value={87} />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Skeleton shimmer</CardTitle>
            <CardDescription>Soft sweep, not a pulse or gradient wash.</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            <SkeletonLines lines={3} />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 flex-1" />
            </div>
            <PageListSkeleton rows={1} />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Toasts & shortcuts</CardTitle>
            <CardDescription>Enter/exit on toasts; kbd chips for hints.</CardDescription>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => toast("Query completed", "success")}>
              Success toast
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast("Sync failed", "error")}>
              Error toast
            </Button>
            <Tooltip content="Informational status, not an error">
              <Button size="sm" variant="ghost" onClick={() => toast("Schema loading…", "info")}>
                Info toast
              </Button>
            </Tooltip>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 type-body">
            <ShortcutHint keys={[modKeyLabel(), "K"]} label="command palette" />
            <ShortcutHint keys={["?"]} label="shortcuts" />
            <span className="inline-flex items-center gap-1">
              <Kbd>Esc</Kbd>
              <span>close</span>
            </span>
          </div>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Chart palette</CardTitle>
          </CardHeader>
          <div className="flex h-10 overflow-hidden rounded-[var(--radius-md)] shadow-sm">
            <div className="flex-1 bg-[var(--color-chart-1)]" />
            <div className="flex-1 bg-[var(--color-chart-2)]" />
            <div className="flex-1 bg-[var(--color-chart-3)]" />
            <div className="flex-1 bg-[var(--color-chart-4)]" />
          </div>
        </Card>
      </section>
    </PageShell>
  );
}

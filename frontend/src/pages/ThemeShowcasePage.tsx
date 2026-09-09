import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ConfidenceRing } from "@/components/ui/ConfidenceRing";

export function ThemeShowcasePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Theme showcase</h1>
        <p className="mt-1 text-sm text-text-secondary">
          SchemaSay design tokens — dark base, teal accent, soothing contrast.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Surfaces</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            <div className="h-10 rounded-md bg-bg-base border border-border-subtle" title="bg-base" />
            <div className="h-10 rounded-md bg-bg-surface border border-border-subtle" title="bg-surface" />
            <div className="h-10 rounded-md bg-bg-elevated border border-border-subtle" title="bg-elevated" />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
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
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confidence</CardTitle>
          </CardHeader>
          <ConfidenceRing value={87} />
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Form controls</CardTitle>
            <CardDescription>Inputs use elevated surface + focus ring.</CardDescription>
          </CardHeader>
          <div className="max-w-sm space-y-3">
            <div>
              <Label htmlFor="demo-input">Ask a question</Label>
              <Input id="demo-input" placeholder="Total revenue by region" />
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

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Chart palette</CardTitle>
          </CardHeader>
          <div className="flex h-10 overflow-hidden rounded-md">
            <div className="flex-1 bg-[var(--color-chart-1)]" />
            <div className="flex-1 bg-[var(--color-chart-2)]" />
            <div className="flex-1 bg-[var(--color-chart-3)]" />
            <div className="flex-1 bg-[var(--color-chart-4)]" />
          </div>
        </Card>
      </section>
    </div>
  );
}

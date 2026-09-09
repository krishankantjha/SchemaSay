import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <p className="text-sm text-text-muted">Coming in Phase 1.</p>
    </Card>
  );
}

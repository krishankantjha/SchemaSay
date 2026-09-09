export function OrDivider({ label = "Or continue with" }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-border-subtle" />
      <span className="text-xs text-text-muted">{label}</span>
      <div className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  FileSearch,
  Lock,
  MessageSquare,
  Shield,
  Sparkles,
} from "lucide-react";
import { ConfidenceRing } from "@/components/ui/ConfidenceRing";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const DEMO_QUESTION = "Revenue by region this quarter?";

const FLOW_STEPS = [
  { icon: MessageSquare, label: "Ask" },
  { icon: Database, label: "Schema" },
  { icon: Sparkles, label: "Generate" },
  { icon: Shield, label: "Validate" },
  { icon: FileSearch, label: "Explain" },
];

const TRUST_SIGNALS = [
  { label: "Schema match", ok: true },
  { label: "3 tables identified", ok: true },
  { label: "Read-only", ok: true },
  { label: "Query validated", ok: true },
];

export function QueryTrustDemo() {
  const [typedQuestion, setTypedQuestion] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [showSql, setShowSql] = useState(false);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reducedMotion) {
      setTypedQuestion(DEMO_QUESTION);
      setShowSql(true);
      setActiveStep(FLOW_STEPS.length - 1);
      return;
    }

    let qIndex = 0;
    const typeInterval = setInterval(() => {
      qIndex += 1;
      setTypedQuestion(DEMO_QUESTION.slice(0, qIndex));
      if (qIndex >= DEMO_QUESTION.length) {
        clearInterval(typeInterval);
        setTimeout(() => setShowSql(true), 400);
      }
    }, 45);

    const stepInterval = setInterval(() => {
      setActiveStep((s) => (s + 1) % FLOW_STEPS.length);
    }, 2200);

    return () => {
      clearInterval(typeInterval);
      clearInterval(stepInterval);
    };
  }, [reducedMotion]);

  return (
    <div className="relative w-full max-w-md">
      <p className="auth-section-label">Demo preview</p>

      <div className="mb-[var(--space-3)] flex flex-wrap items-center gap-[var(--space-1)]">
        {FLOW_STEPS.map(({ icon: Icon, label }, i) => (
          <div key={label} className="flex items-center gap-[var(--space-1)]">
            <span
              className="auth-flow-chip"
              data-active={i <= activeStep ? "true" : "false"}
            >
              <Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              {label}
            </span>
            {i < FLOW_STEPS.length - 1 ? (
              <span className="text-[10px] text-text-muted" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="auth-demo-panel">
        <p className="mb-[var(--space-2)] text-xs text-text-muted">You asked</p>
        <p className="min-h-[1.25rem] text-sm font-medium leading-snug text-text-primary">
          &ldquo;{typedQuestion}
          {!reducedMotion && typedQuestion.length < DEMO_QUESTION.length ? (
            <span className="animate-pulse text-accent">|</span>
          ) : null}
          &rdquo;
        </p>

        {showSql ? (
          <div className="mt-[var(--space-3)] animate-fade-up">
            <div className="mb-[var(--space-2)] flex flex-wrap items-center gap-[var(--space-2)]">
              <Badge variant="accent">orders</Badge>
              <Badge variant="default">regions</Badge>
              <Badge variant="default">products</Badge>
              <Badge variant="warning" className="gap-1">
                <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
                READ ONLY
              </Badge>
            </div>
            <pre className="sql-block compact">
              <code>
                <span className="kw">SELECT</span> region, <span className="fn">SUM</span>(total_amount)
                {"\n"}
                <span className="kw">FROM</span> orders
                {"\n"}
                <span className="kw">WHERE</span> quarter = <span className="str">'Q3'</span>
              </code>
            </pre>

            <div className="auth-trust-section">
              <p className="auth-section-label mb-0">Query Trust</p>
              <div className="auth-trust-grid">
                <ConfidenceRing value={94} size={52} />
                <ul className="auth-trust-checklist">
                  {TRUST_SIGNALS.map(({ label, ok }) => (
                    <li key={label}>
                      <CheckCircle2
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          ok ? "text-success" : "text-text-muted",
                        )}
                        strokeWidth={2}
                        aria-hidden
                      />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

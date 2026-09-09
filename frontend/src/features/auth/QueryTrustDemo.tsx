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
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
        Demo preview
      </p>

      {/* Flow steps */}
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {FLOW_STEPS.map(({ icon: Icon, label }, i) => (
          <div key={label} className="flex items-center gap-1">
            <span
              className={[
                "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                i <= activeStep
                  ? "bg-accent-muted text-accent"
                  : "bg-bg-elevated text-text-muted",
              ].join(" ")}
            >
              <Icon className="h-3 w-3" />
              {label}
            </span>
            {i < FLOW_STEPS.length - 1 ? (
              <span className="text-text-muted" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border-subtle bg-bg-elevated/70 p-4 backdrop-blur-sm">
        <p className="mb-1.5 text-[11px] text-text-muted">You asked</p>
        <p className="min-h-[1.25rem] text-sm font-medium text-text-primary">
          &ldquo;{typedQuestion}
          {!reducedMotion && typedQuestion.length < DEMO_QUESTION.length ? (
            <span className="animate-pulse text-accent">|</span>
          ) : null}
          &rdquo;
        </p>

        {showSql ? (
          <div className="mt-3 animate-fade-up">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="accent">orders</Badge>
              <Badge variant="default">regions</Badge>
              <Badge variant="default">products</Badge>
              <Badge variant="warning" className="gap-1">
                <Lock className="h-2.5 w-2.5" /> READ ONLY
              </Badge>
            </div>
            <pre className="sql-block !p-3 !text-[11px]">
              <code>
                <span className="kw">SELECT</span> region, <span className="fn">SUM</span>(total_amount)
                {"\n"}
                <span className="kw">FROM</span> orders
                {"\n"}
                <span className="kw">WHERE</span> quarter = <span className="str">'Q3'</span>
              </code>
            </pre>
          </div>
        ) : null}
      </div>

      {/* Query Trust */}
      {showSql ? (
        <div className="mt-3 animate-fade-up rounded-xl border border-border-subtle bg-bg-surface/90 p-3.5 backdrop-blur-sm">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Query Trust
          </p>
          <div className="flex items-start gap-3">
            <ConfidenceRing value={94} size={48} />
            <ul className="flex-1 space-y-1">
              {TRUST_SIGNALS.map(({ label, ok }) => (
                <li
                  key={label}
                  className="flex items-center gap-1.5 text-[11px] text-text-secondary"
                >
                  <CheckCircle2
                    className={`h-3 w-3 shrink-0 ${ok ? "text-success" : "text-text-muted"}`}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

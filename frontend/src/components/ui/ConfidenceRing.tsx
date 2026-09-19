import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type ConfidenceRingProps = {
  value: number;
  size?: number;
};

export function ConfidenceRing({ value, size = 88 }: ConfidenceRingProps) {
  const reduced = usePrefersReducedMotion();
  const compact = size <= 64;
  const stroke = compact ? 4 : 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const targetOffset = circumference - (clamped / 100) * circumference;

  const [offset, setOffset] = useState(reduced ? targetOffset : circumference);
  const [display, setDisplay] = useState(reduced ? Math.round(clamped) : 0);

  useEffect(() => {
    if (reduced) {
      setOffset(targetOffset);
      setDisplay(Math.round(clamped));
      return;
    }

    setOffset(circumference);
    setDisplay(0);

    const start = performance.now();
    const duration = 420;
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setOffset(circumference - eased * (circumference - targetOffset));
      setDisplay(Math.round(eased * clamped));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clamped, circumference, reduced, targetOffset]);

  const color =
    clamped >= 71 ? "var(--color-success)" : clamped >= 41 ? "var(--color-warning)" : "var(--color-danger)";

  const ring = (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={`${Math.round(clamped)} percent confidence`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border-subtle)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: reduced ? undefined : "stroke var(--duration-normal) var(--ease-default)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={
            compact
              ? "text-sm font-semibold tabular-nums leading-none text-text-primary"
              : "text-lg font-semibold tabular-nums leading-none text-text-primary"
          }
        >
          {display}
        </span>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="flex w-[3.5rem] shrink-0 flex-col items-center">
        {ring}
        <span className="text-meta mt-1 normal-case leading-none">
          confidence
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-center">
      {ring}
      <span className="text-meta mt-1 normal-case leading-none">
        confidence
      </span>
    </div>
  );
}

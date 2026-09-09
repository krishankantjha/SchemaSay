type ConfidenceRingProps = {
  value: number;
  size?: number;
};

export function ConfidenceRing({ value, size = 88 }: ConfidenceRingProps) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const color =
    value >= 71 ? "var(--color-success)" : value >= 41 ? "var(--color-warning)" : "var(--color-danger)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
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
          style={{ transition: "stroke-dashoffset 0.4s var(--ease-default)" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-semibold tabular-nums text-text-primary">{value}</div>
        <div className="text-[10px] uppercase tracking-wide text-text-muted">confidence</div>
      </div>
    </div>
  );
}

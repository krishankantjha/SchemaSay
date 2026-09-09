import { LayoutDashboard } from "lucide-react";

type SchemaSayLogoProps = {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
};

const sizeMap = {
  sm: { icon: "h-4 w-4", name: "text-sm", tagline: "text-[11px]" },
  md: { icon: "h-5 w-5", name: "text-sm", tagline: "text-xs" },
  lg: { icon: "h-6 w-6", name: "text-base", tagline: "text-sm" },
};

export function SchemaSayLogo({
  size = "md",
  showTagline = false,
  className = "",
}: SchemaSayLogoProps) {
  const s = sizeMap[size];

  return (
    <div className={["flex items-center gap-2.5", className].join(" ")}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated/80">
        <LayoutDashboard className={`${s.icon} text-accent`} aria-hidden />
      </div>
      <div>
        <span className={`block font-semibold tracking-tight text-text-primary ${s.name}`}>
          SchemaSay
        </span>
        {showTagline ? (
          <span className={`block text-text-secondary ${s.tagline}`}>
            Ask your data in plain English
          </span>
        ) : null}
      </div>
    </div>
  );
}

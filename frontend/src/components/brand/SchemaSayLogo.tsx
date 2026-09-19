import darkLogoUrl from "../../../assets/dark_logo.png";
import lightLogoUrl from "../../../assets/light_logo.png";
import { useTheme } from "@/app/ThemeContext";
import { cn } from "@/lib/utils";

type SchemaSayLogoProps = {
  size?: "sm" | "md" | "lg";
  /** @deprecated Logo asset includes full wordmark; kept for call-site compatibility */
  showTagline?: boolean;
  className?: string;
};

/** dark_logo.png / light_logo.png intrinsic dimensions */
const LOGO_INTRINSIC = { width: 1983, height: 793 } as const;
const LOGO_ASPECT = LOGO_INTRINSIC.width / LOGO_INTRINSIC.height;

/**
 * Display heights tuned per surface (+4.5% over base):
 * - sm (36px): TopNav + auth mobile header — fits 64px nav bar
 * - md (38px): default / medium contexts
 * - lg (54px): auth visual panel hero branding
 */
const sizePx = {
  sm: 36,
  md: 38,
  lg: 54,
} as const;

export function SchemaSayLogo({
  size = "md",
  className,
}: SchemaSayLogoProps) {
  const { theme } = useTheme();
  const height = sizePx[size];
  const width = Math.round(height * LOGO_ASPECT);
  const logoUrl = theme === "dark" ? darkLogoUrl : lightLogoUrl;

  return (
    <div className={cn("w-fit max-w-none shrink-0 self-start", className)}>
      <img
        src={logoUrl}
        alt="SchemaSay"
        width={width}
        height={height}
        draggable={false}
        decoding="async"
        className="brand-logo block max-w-none select-none object-contain object-left"
        style={{ width, height }}
      />
    </div>
  );
}

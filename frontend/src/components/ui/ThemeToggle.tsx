import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/ThemeContext";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Switch to dark theme" : "Switch to light theme"}
      className={[
        "inline-flex h-7 w-7 items-center justify-center rounded-md",
        "text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-secondary",
        className,
      ].join(" ")}
    >
      {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
    </button>
  );
}

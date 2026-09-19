import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/ThemeContext";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Switch to dark theme" : "Switch to light theme"}
      className={cn("icon-btn pressable", className)}
    >
      <span className="relative h-4 w-4">
        <Sun
          className={cn(
            "absolute inset-0 h-4 w-4 transition-opacity duration-200 ease-out",
            isLight ? "opacity-0" : "opacity-100",
          )}
          aria-hidden
        />
        <Moon
          className={cn(
            "absolute inset-0 h-4 w-4 transition-opacity duration-200 ease-out",
            isLight ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        />
      </span>
    </button>
  );
}

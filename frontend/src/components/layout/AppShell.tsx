import { Outlet, useLocation } from "react-router-dom";
import { TopNav } from "./TopNav";
import { SkipLink } from "@/components/ui/SkipLink";
import { GlobalShortcuts } from "@/features/command/GlobalShortcuts";
import { OnboardingBanner, SchemaStatusBar } from "@/features/onboarding/OnboardingBanner";
import { cn } from "@/lib/utils";

const WORKBENCH_PATHS = ["/ask", "/sql"];

export function AppShell() {
  const location = useLocation();
  const hideOnboarding = location.pathname === "/connections";
  const isWorkbench = WORKBENCH_PATHS.includes(location.pathname);

  return (
    <div
      className={cn(
        "flex flex-col bg-bg-base",
        isWorkbench ? "h-dvh max-h-dvh overflow-hidden" : "min-h-screen",
      )}
    >
      <SkipLink />
      <GlobalShortcuts />
      <TopNav />
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "mx-auto flex w-full max-w-[1600px] flex-1 flex-col",
          isWorkbench
            ? "min-h-0 overflow-hidden px-0 py-[var(--space-layout-y)]"
            : "px-[var(--space-layout-x)] py-[var(--space-page)]",
        )}
      >
        {!hideOnboarding ? (
          <div className={cn("space-y-3", isWorkbench && "shrink-0 px-[var(--space-layout-x)]")}>
            <OnboardingBanner />
            <SchemaStatusBar />
          </div>
        ) : null}
        <div className={cn(isWorkbench && "flex min-h-0 flex-1 flex-col")}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

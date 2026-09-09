import { Outlet, useLocation } from "react-router-dom";
import { TopNav } from "./TopNav";
import { OnboardingBanner, SchemaStatusBar } from "@/features/onboarding/OnboardingBanner";

const WORKBENCH_PATHS = ["/ask", "/sql"];

export function AppShell() {
  const location = useLocation();
  const hideOnboarding = location.pathname === "/connections";
  const isWorkbench = WORKBENCH_PATHS.includes(location.pathname);

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <TopNav />
      <main
        className={[
          "mx-auto flex w-full max-w-[1600px] flex-1 flex-col",
          isWorkbench ? "min-h-0 px-0 py-3 sm:py-4" : "px-4 py-6 sm:px-6 sm:py-7",
        ].join(" ")}
      >
        {!hideOnboarding ? (
          <div className={isWorkbench ? "shrink-0 px-4 sm:px-6" : undefined}>
            <OnboardingBanner />
            <SchemaStatusBar />
          </div>
        ) : null}
        <div className={isWorkbench ? "flex min-h-0 flex-1 flex-col" : undefined}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

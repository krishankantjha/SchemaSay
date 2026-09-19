import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RouteFallback } from "@/components/ui/RouteFallback";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { OAuthCallbackPage } from "@/features/auth/OAuthCallbackPage";
import { ProtectedRoute, PublicOnlyRoute } from "@/features/auth/ProtectedRoute";

const AskPage = lazy(() =>
  import("@/features/workbench/AskPage").then((m) => ({ default: m.AskPage })),
);
const SqlPage = lazy(() => import("@/features/sql/SqlPage").then((m) => ({ default: m.SqlPage })));
const SchemaPage = lazy(() =>
  import("@/features/schema/SchemaPage").then((m) => ({ default: m.SchemaPage })),
);
const MetricsPage = lazy(() =>
  import("@/features/metrics/MetricsPage").then((m) => ({ default: m.MetricsPage })),
);
const GovernPage = lazy(() =>
  import("@/features/govern/GovernPage").then((m) => ({ default: m.GovernPage })),
);
const AuditPage = lazy(() =>
  import("@/features/audit/AuditPage").then((m) => ({ default: m.AuditPage })),
);
const ConnectionsPage = lazy(() =>
  import("@/features/connections/ConnectionsPage").then((m) => ({ default: m.ConnectionsPage })),
);
const ThemeShowcasePage = lazy(() =>
  import("@/pages/ThemeShowcasePage").then((m) => ({ default: m.ThemeShowcasePage })),
);

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/ask" replace />} />
            <Route
              path="/ask"
              element={
                <Lazy>
                  <AskPage />
                </Lazy>
              }
            />
            <Route
              path="/sql"
              element={
                <Lazy>
                  <SqlPage />
                </Lazy>
              }
            />
            <Route
              path="/schema"
              element={
                <Lazy>
                  <SchemaPage />
                </Lazy>
              }
            />
            <Route
              path="/metrics"
              element={
                <Lazy>
                  <MetricsPage />
                </Lazy>
              }
            />
            <Route
              path="/govern"
              element={
                <Lazy>
                  <GovernPage />
                </Lazy>
              }
            />
            <Route
              path="/audit"
              element={
                <Lazy>
                  <AuditPage />
                </Lazy>
              }
            />
            <Route
              path="/connections"
              element={
                <Lazy>
                  <ConnectionsPage />
                </Lazy>
              }
            />
            {import.meta.env.DEV ? (
              <Route
                path="/dev/theme"
                element={
                  <Lazy>
                    <ThemeShowcasePage />
                  </Lazy>
                }
              />
            ) : null}
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/ask" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

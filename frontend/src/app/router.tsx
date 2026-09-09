import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { OAuthCallbackPage } from "@/features/auth/OAuthCallbackPage";
import { ProtectedRoute, PublicOnlyRoute } from "@/features/auth/ProtectedRoute";
import { ConnectionsPage } from "@/features/connections/ConnectionsPage";
import { AskPage } from "@/features/workbench/AskPage";
import { SqlPage } from "@/features/sql/SqlPage";
import { SchemaPage } from "@/features/schema/SchemaPage";
import { MetricsPage } from "@/features/metrics/MetricsPage";
import { GovernPage } from "@/features/govern/GovernPage";
import { AuditPage } from "@/features/audit/AuditPage";
import { ThemeShowcasePage } from "@/pages/ThemeShowcasePage";

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
            <Route path="/ask" element={<AskPage />} />
            <Route path="/sql" element={<SqlPage />} />
            <Route path="/schema" element={<SchemaPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
            <Route path="/govern" element={<GovernPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/dev/theme" element={<ThemeShowcasePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/ask" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

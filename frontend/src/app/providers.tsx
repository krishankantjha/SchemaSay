import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/app/ThemeContext";
import { ToastProvider, ToastViewport } from "@/app/ToastContext";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AuthProvider } from "@/features/auth/AuthContext";
import { CommandPaletteProvider } from "@/features/command/CommandPaletteContext";
import { ConnectionProvider } from "@/features/connections/ConnectionContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ConnectionProvider>
            <CommandPaletteProvider>
              <ToastProvider>
                <ErrorBoundary>{children}</ErrorBoundary>
                <ToastViewport />
              </ToastProvider>
            </CommandPaletteProvider>
          </ConnectionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

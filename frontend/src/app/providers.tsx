import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/app/ThemeContext";
import { ToastProvider, ToastViewport } from "@/app/ToastContext";
import { AuthProvider } from "@/features/auth/AuthContext";
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
            <ToastProvider>
              {children}
              <ToastViewport />
            </ToastProvider>
          </ConnectionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

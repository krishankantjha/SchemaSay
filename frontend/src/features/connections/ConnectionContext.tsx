import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { connectionsApi } from "@/lib/api/endpoints";
import type { Connection } from "@/lib/api/types";
import { getStoredConnectionId, setStoredConnectionId } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";

type ConnectionContextValue = {
  connections: Connection[];
  activeConnection: Connection | null;
  activeConnectionId: number | null;
  isLoading: boolean;
  setActiveConnectionId: (id: number | null) => void;
  refreshConnections: () => Promise<void>;
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [activeConnectionId, setActiveConnectionIdState] = useState<number | null>(
    getStoredConnectionId,
  );

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: connectionsApi.list,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!connections.length) return;
    if (activeConnectionId && connections.some((c) => c.id === activeConnectionId)) return;
    const first = connections[0]?.id ?? null;
    setActiveConnectionIdState(first);
    setStoredConnectionId(first);
  }, [connections, activeConnectionId]);

  const setActiveConnectionId = useCallback((id: number | null) => {
    setActiveConnectionIdState(id);
    setStoredConnectionId(id);
  }, []);

  const refreshConnections = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["connections"] });
  }, [queryClient]);

  const activeConnection = useMemo(
    () => connections.find((c) => c.id === activeConnectionId) ?? null,
    [connections, activeConnectionId],
  );

  const value = useMemo(
    () => ({
      connections,
      activeConnection,
      activeConnectionId,
      isLoading,
      setActiveConnectionId,
      refreshConnections,
    }),
    [
      connections,
      activeConnection,
      activeConnectionId,
      isLoading,
      setActiveConnectionId,
      refreshConnections,
    ],
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error("useConnection must be used within ConnectionProvider");
  }
  return ctx;
}

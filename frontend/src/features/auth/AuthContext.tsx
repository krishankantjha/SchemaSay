import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "@/lib/api/endpoints";
import {
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  setTokenRefreshHandler,
} from "@/lib/api/client";
import type { User } from "@/lib/api/types";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  completeOAuthLogin: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function applyTokens(access: string, refresh: string) {
  setAccessToken(access);
  setRefreshToken(refresh);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const stored = getRefreshToken();
    if (!stored) return null;

    try {
      const tokens = await authApi.refresh(stored);
      applyTokens(tokens.access_token, tokens.refresh_token);
      return tokens.access_token;
    } catch {
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    setTokenRefreshHandler(refreshSession);
    return () => setTokenRefreshHandler(null);
  }, [refreshSession]);

  useEffect(() => {
    async function bootstrap() {
      const stored = getRefreshToken();
      if (!stored) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await refreshSession();
        if (token) {
          const profile = await authApi.me();
          setUser(profile);
        }
      } catch {
        setAccessToken(null);
        setRefreshToken(null);
      } finally {
        setIsLoading(false);
      }
    }

    void bootstrap();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login({ email, password });
    applyTokens(tokens.access_token, tokens.refresh_token);
    const profile = await authApi.me();
    setUser(profile);
  }, []);

  const register = useCallback(async (email: string, password: string, fullName?: string) => {
    await authApi.register({ email, password, full_name: fullName });
    await login(email, password);
  }, [login]);

  const completeOAuthLogin = useCallback(async (accessToken: string, refreshToken: string) => {
    applyTokens(accessToken, refreshToken);
    const profile = await authApi.me();
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getRefreshToken()) {
        await authApi.logout();
      }
    } catch {
      // Clear local session even if logout request fails
    } finally {
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      completeOAuthLogin,
      logout,
    }),
    [user, isLoading, login, register, completeOAuthLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

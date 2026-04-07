"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { User, LoginRequest, RegisterRequest } from "@/app/types";
import { authService } from "@/app/lib/api/auth";
import { clearTokens, getAccessToken } from "@/app/lib/api/client";

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Authenticated user, or null when unauthenticated */
  user: User | null;
  /** True while the initial session check is running */
  loading: boolean;
  /** True while a login/register/logout call is in-flight */
  submitting: boolean;
  /** Login with email + password */
  login: (credentials: LoginRequest) => Promise<User>;
  /** Register a new account */
  register: (data: RegisterRequest) => Promise<User>;
  /** Clear session */
  logout: () => Promise<void>;
  /** Re-fetch current user from backend and update context state */
  refreshUser: () => Promise<User | null>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  /** On mount: restore session from stored token */
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    authService
      .getMe()
      .then(setUser)
      .catch(() => {
        clearTokens();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    setSubmitting(true);
    try {
      const { user } = await authService.login(credentials);
      setUser(user);
      return user;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    setSubmitting(true);
    try {
      const { user } = await authService.register(data);
      setUser(user);
      return user;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setSubmitting(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setSubmitting(false);
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      return null;
    }

    try {
      const refreshed = await authService.getMe();
      setUser(refreshed);
      return refreshed;
    } catch {
      clearTokens();
      setUser(null);
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        submitting,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { looksLikePhoneNumber, normalizePhoneNumber } from "@/lib/utils/phone";
import type { AuthSession, CustomerProfile } from "@/types/storefront";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionContextValue {
  session: AuthSession | null;
  status: SessionStatus;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<AuthSession>;
  register: (payload: RegisterPayload) => Promise<AuthSession>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
  updateCustomerProfile: (profile: CustomerProfile) => void;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const STORAGE_KEY = "storefront.session.v1";

const readStoredSession = (): AuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as AuthSession;
  } catch (error) {
    console.warn("[session] Failed to parse stored session", error);
    return null;
  }
};

const persistSession = (session: AuthSession | null) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn("[session] Failed to persist session", error);
  }
};

export const StorefrontSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const isBootstrapped = useRef(false);

  useEffect(() => {
    if (isBootstrapped.current) return;
    const stored = readStoredSession();
    if (stored) {
      setSession(stored);
      setStatus("authenticated");
    } else {
      setStatus("unauthenticated");
    }
    isBootstrapped.current = true;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const handleAuthSuccess = useCallback((nextSession: AuthSession) => {
    setSession(nextSession);
    setStatus("authenticated");
    persistSession(nextSession);
    setError(null);
    return nextSession;
  }, []);

  const handleAuthError = useCallback((cause: unknown) => {
    let message = "Unable to authenticate. Please try again.";
    if (isApiError(cause)) {
      message = cause.payload?.message ?? cause.message ?? message;
    } else if (cause instanceof Error) {
      message = cause.message;
    }
    setError(message);
    setStatus((current) => (current === "loading" ? "unauthenticated" : current));
    throw cause;
  }, []);

  const login = useCallback(
    async (identifier: string, password: string) => {
      try {
        const trimmedIdentifier = identifier.trim();
        let payloadIdentifier = trimmedIdentifier;
        if (looksLikePhoneNumber(trimmedIdentifier)) {
          const normalized = normalizePhoneNumber(trimmedIdentifier);
          if (!normalized) {
            throw new Error("Please enter a valid phone number.");
          }
          payloadIdentifier = normalized;
        }
        const sessionResponse = await StorefrontApi.login(payloadIdentifier, password);
        return handleAuthSuccess(sessionResponse);
      } catch (cause) {
        handleAuthError(cause);
        throw cause;
      }
    },
    [handleAuthError, handleAuthSuccess]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      try {
        const normalizedPhone = payload.phone
          ? normalizePhoneNumber(payload.phone)
          : undefined;
        if (payload.phone && !normalizedPhone) {
          throw new Error("Please enter a valid phone number.");
        }
        const sessionResponse = await StorefrontApi.register({
          email: payload.email.trim(),
          password: payload.password,
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          phone: normalizedPhone
        });
        return handleAuthSuccess(sessionResponse);
      } catch (cause) {
        handleAuthError(cause);
        throw cause;
      }
    },
    [handleAuthError, handleAuthSuccess]
  );

  const logout = useCallback(() => {
    persistSession(null);
    setSession(null);
    setStatus("unauthenticated");
    setError(null);
  }, []);

  const updateCustomerProfile = useCallback((profile: CustomerProfile) => {
    setSession((current) => {
      if (!current) {
        return current;
      }
      const nextSession: AuthSession = {
        ...current,
        customer: profile
      };
      persistSession(nextSession);
      return nextSession;
    });
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      status,
      isAuthenticated: status === "authenticated" && !!session,
      login,
      register,
      logout,
      error,
      clearError,
      updateCustomerProfile
    }),
    [session, status, login, register, logout, error, clearError, updateCustomerProfile]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a StorefrontSessionProvider");
  }
  return context;
};

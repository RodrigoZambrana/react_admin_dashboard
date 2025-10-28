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
import { env } from "@/lib/env";
import { looksLikePhoneNumber, normalizePhoneNumber } from "@/lib/utils/phone";
import type { AuthSession, CustomerProfile } from "@/types/storefront";
import { useToast } from "@/contexts/ToastContext";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type GoogleAuthDebugEvent = {
  id: string;
  timestamp: number;
  label: string;
  details?: string;
};

interface SessionContextValue {
  session: AuthSession | null;
  status: SessionStatus;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<AuthSession>;
  register: (payload: RegisterPayload) => Promise<AuthSession>;
  loginWithGoogle: (options?: { returnPath?: string }) => Promise<{ session: AuthSession; returnPath: string | null }>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  updateCustomerProfile: (profile: CustomerProfile) => void;
  updateWishlistSummary: (summary: { count: number; productIds: number[] }) => void;
  googleAuthDebug: {
    events: GoogleAuthDebugEvent[];
    isEnabled: boolean;
    clear: () => void;
  };
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

const normalizeWishlistProductIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<number>();
  const ids: number[] = [];
  value.forEach((entry) => {
    const numeric = typeof entry === "number" ? entry : Number(entry);
    if (!Number.isFinite(numeric)) {
      return;
    }
    const parsed = Math.trunc(numeric);
    if (parsed > 0 && !seen.has(parsed)) {
      seen.add(parsed);
      ids.push(parsed);
    }
  });
  return ids;
};

const normalizeCustomerProfile = (profile: CustomerProfile): CustomerProfile => {
  const wishlistProductIds = normalizeWishlistProductIds(profile?.wishlistProductIds);
  const wishlistCount =
    typeof profile?.wishlistCount === "number" && Number.isFinite(profile.wishlistCount)
      ? Math.max(0, Math.trunc(profile.wishlistCount))
      : wishlistProductIds.length;

  return {
    ...profile,
    wishlistProductIds,
    wishlistCount
  };
};

const normalizeAuthSession = (session: AuthSession): AuthSession => ({
  ...session,
  customer: normalizeCustomerProfile(session.customer)
});

const readStoredSession = (): AuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthSession;
    return normalizeAuthSession(parsed);
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
      const normalized = normalizeAuthSession(session);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn("[session] Failed to persist session", error);
  }
};

const GOOGLE_AUTH_MESSAGE_TYPE = "storefront:google-auth";

type GoogleAuthSuccessMessage = {
  type: typeof GOOGLE_AUTH_MESSAGE_TYPE;
  status: "success";
  session: AuthSession;
  returnPath?: string | null;
};

type GoogleAuthErrorMessage = {
  type: typeof GOOGLE_AUTH_MESSAGE_TYPE;
  status: "error";
  errorCode?: string;
  message?: string;
  details?: string | null;
  returnPath?: string | null;
};

type GoogleAuthMessage = GoogleAuthSuccessMessage | GoogleAuthErrorMessage;

const GOOGLE_AUTH_DEBUG_EVENT_LIMIT = 50;

const maskTokenForDebug = (value: string | null | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length <= 8) {
    return trimmed;
  }
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
};

const maskEmailForDebug = (value: string | null | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const [local, domain] = value.split("@");
  if (!domain) {
    return value;
  }
  if (!local) {
    return `*@${domain}`;
  }
  if (local.length <= 2) {
    return `${local[0] ?? ""}*@${domain}`;
  }
  return `${local.slice(0, 2)}…@${domain}`;
};

const formatGoogleAuthDebugDetails = (details: unknown): string | undefined => {
  if (details === undefined || details === null) {
    return undefined;
  }
  if (details instanceof Error) {
    if (details.stack) {
      return `${details.name}: ${details.message}
${details.stack}`;
    }
    return `${details.name}: ${details.message}`;
  }
  if (typeof details === "string") {
    return details;
  }
  if (typeof details === "object") {
    try {
      return JSON.stringify(details, null, 2);
    } catch (error) {
      return `[unserializable-details]: ${String(error)}`;
    }
  }
  return String(details);
};

const isGoogleAuthMessage = (value: unknown): value is GoogleAuthMessage => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  if (payload.type !== GOOGLE_AUTH_MESSAGE_TYPE) {
    return false;
  }
  if (payload.status === "success") {
    return typeof payload.session === "object" && payload.session !== null;
  }
  if (payload.status === "error") {
    return true;
  }
  return false;
};

export const StorefrontSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const isBootstrapped = useRef(false);
  const toast = useToast();
  const [googleAuthDebugEvents, setGoogleAuthDebugEvents] = useState<GoogleAuthDebugEvent[]>([]);
  const googleAuthDebugEnabled = env.googleAuthDebugEnabled;

  const clearGoogleAuthDebug = useCallback(() => {
    setGoogleAuthDebugEvents([]);
  }, []);

  const logGoogleAuthDebug = useCallback(
    (label: string, details?: unknown) => {
      if (!googleAuthDebugEnabled) {
        return;
      }
      const event: GoogleAuthDebugEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        label,
        details: formatGoogleAuthDebugDetails(details)
      };
      setGoogleAuthDebugEvents((current) => {
        const next = [...current, event];
        if (next.length > GOOGLE_AUTH_DEBUG_EVENT_LIMIT) {
          return next.slice(next.length - GOOGLE_AUTH_DEBUG_EVENT_LIMIT);
        }
        return next;
      });
    },
    [googleAuthDebugEnabled]
  );

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

  const handleAuthSuccess = useCallback(
    (nextSession: AuthSession, origin: "login" | "register" = "login") => {
      const normalizedSession = normalizeAuthSession(nextSession);
      setSession(normalizedSession);
      setStatus("authenticated");
      persistSession(normalizedSession);
      setError(null);

      const customerName = [normalizedSession.customer.firstName, normalizedSession.customer.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      toast.success({
        title: origin === "register" ? "Cuenta creada" : "Sesión iniciada",
        description:
          origin === "register"
            ? customerName
              ? `¡Bienvenido/a ${customerName}! Tu cuenta ya está activa.`
              : "Tu cuenta fue creada y ya puedes comenzar a comprar."
            : customerName
              ? `Hola ${customerName}, nos alegra verte de vuelta.`
              : "Iniciaste sesión correctamente."
      });

      return normalizedSession;
    },
    [toast]
  );

  const handleAuthError = useCallback(
    (cause: unknown, origin: "login" | "register" = "login") => {
      let message = "Unable to authenticate. Please try again.";
      if (isApiError(cause)) {
        message = cause.payload?.message ?? cause.message ?? message;
      } else if (cause instanceof Error) {
        message = cause.message;
      }
      setError(message);
      setStatus((current) => (current === "loading" ? "unauthenticated" : current));
      toast.error({
        title: origin === "register" ? "No pudimos crear tu cuenta" : "No pudimos iniciar sesión",
        description: message
      });
      throw cause;
    },
    [toast]
  );

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
        return handleAuthSuccess(sessionResponse, "login");
      } catch (cause) {
        handleAuthError(cause, "login");
        throw cause;
      }
    },
    [handleAuthError, handleAuthSuccess]
  );

  const loginWithGoogle = useCallback(
    async (options?: { returnPath?: string }) => {
      if (typeof window === "undefined") {
        throw new Error("Google authentication is only available in the browser.");
      }

      clearError();
      setStatus("loading");
      logGoogleAuthDebug("loginWithGoogle:initialize", {
        returnPath: options?.returnPath ?? null
      });

      let startResponse: { url: string; state: string; expiresAt: string };
      try {
        startResponse = await StorefrontApi.startGoogleLogin(options?.returnPath);
        logGoogleAuthDebug("loginWithGoogle:startGoogleLogin:success", {
          state: maskTokenForDebug(startResponse.state),
          expiresAt: startResponse.expiresAt
        });
      } catch (cause) {
        logGoogleAuthDebug("loginWithGoogle:startGoogleLogin:error", cause);
        handleAuthError(cause, "login");
        throw cause;
      }

      const width = 480;
      const height = 640;
      const screenX = window.screenX ?? window.screenLeft ?? 0;
      const screenY = window.screenY ?? window.screenTop ?? 0;
      const outerWidth = window.outerWidth ?? window.innerWidth ?? 1280;
      const outerHeight = window.outerHeight ?? window.innerHeight ?? 720;
      const left = Math.max(0, screenX + (outerWidth - width) / 2);
      const top = Math.max(0, screenY + (outerHeight - height) / 2);

      const popup = window.open(
        startResponse.url,
        "storefront-google-auth",
        `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        logGoogleAuthDebug("loginWithGoogle:popup:blocked", {
          reason: "window.open returned null"
        });
        const popupError = new Error(
          "No pudimos abrir la ventana de Google. Habilita las ventanas emergentes e inténtalo nuevamente."
        );
        try {
          handleAuthError(popupError, "login");
        } catch (cause) {
          throw cause;
        }
        throw popupError;
      }

      logGoogleAuthDebug("loginWithGoogle:popup:opened", {
        url: startResponse.url,
        dimensions: { width, height, left, top }
      });

      try {
        popup.focus();
      } catch (error) {
        console.warn("[session] Unable to focus Google auth popup due to window policy", error);
        logGoogleAuthDebug("loginWithGoogle:popup:focus-error", error);
      }

      const trustedOrigins = new Set<string>();
      try {
        const apiOrigin = new URL(env.publicApiBaseUrl).origin;
        trustedOrigins.add(apiOrigin);
      } catch (error) {
        console.warn("[session] Invalid API base URL for Google auth origin", error);
        logGoogleAuthDebug("loginWithGoogle:invalid-api-origin", error);
      }
      trustedOrigins.add(window.location.origin);

      logGoogleAuthDebug("loginWithGoogle:awaitingMessage", {
        trustedOrigins: Array.from(trustedOrigins)
      });

      return new Promise<{ session: AuthSession; returnPath: string | null }>((resolve, reject) => {
        let completed = false;
        let fallbackTimer: number | undefined;

        const clearFallbackTimer = () => {
          if (fallbackTimer) {
            window.clearTimeout(fallbackTimer);
            fallbackTimer = undefined;
          }
        };

        const cleanup = (reason: string) => {
          logGoogleAuthDebug("loginWithGoogle:cleanup", { reason });
          completed = true;
          window.removeEventListener("message", handleMessage);
          clearFallbackTimer();
          try {
            popup.close();
          } catch (error) {
            console.warn("[session] Unable to close Google auth popup", error);
            logGoogleAuthDebug("loginWithGoogle:popup:close-error", error);
          }
        };

        const fail = (error: Error, reason: string) => {
          logGoogleAuthDebug("loginWithGoogle:failed", { reason, message: error.message });
          cleanup(reason);
          try {
            handleAuthError(error, "login");
          } catch (cause) {
            reject(cause as Error);
            return;
          }
          reject(error);
        };

        const startFallbackTimer = () => {
          const timeoutMs = 2 * 60 * 1000;
          logGoogleAuthDebug("loginWithGoogle:fallbackTimer:start", { timeoutMs });
          clearFallbackTimer();
          fallbackTimer = window.setTimeout(() => {
            if (completed) {
              return;
            }
            logGoogleAuthDebug("loginWithGoogle:fallbackTimer:expired", { timeoutMs });
            fail(
              new Error(
                "La autenticación con Google tardó demasiado. Es posible que hayas cerrado la ventana. Inténtalo nuevamente."
              ),
              "timeout"
            );
          }, timeoutMs);
        };

        const handleMessage = (event: MessageEvent) => {
          if (!trustedOrigins.has(event.origin)) {
            logGoogleAuthDebug("loginWithGoogle:message:ignored-origin", { origin: event.origin });
            return;
          }
          const data = event.data;
          if (!isGoogleAuthMessage(data)) {
            logGoogleAuthDebug("loginWithGoogle:message:unknown", {
              origin: event.origin,
              receivedType: typeof data
            });
            return;
          }

          logGoogleAuthDebug("loginWithGoogle:message:received", {
            origin: event.origin,
            status: data.status
          });

          if (data.status === "success") {
            const returnPath =
              typeof data.returnPath === "string" && data.returnPath.trim()
                ? data.returnPath.trim()
                : null;

            logGoogleAuthDebug("loginWithGoogle:message:success", {
              origin: event.origin,
              expiresAt: data.session.expiresAt,
              accessTokenPreview: maskTokenForDebug(data.session.accessToken),
              hasRefreshToken: Boolean(data.session.refreshToken),
              customerId: data.session.customer.id,
              customerEmail: maskEmailForDebug(data.session.customer.email),
              returnPath
            });

            cleanup("success");
            try {
              const normalized = handleAuthSuccess(data.session, "login");
              resolve({
                session: normalized,
                returnPath
              });
            } catch (cause) {
              reject(cause as Error);
            }
          } else {
            const message =
              (typeof data.message === "string" && data.message.trim()) ||
              "Unable to sign in with Google. Please try again.";

            logGoogleAuthDebug("loginWithGoogle:message:error", {
              origin: event.origin,
              message: data.message,
              errorCode: data.errorCode
            });

            fail(new Error(message), "message:error");
          }
        };

        window.addEventListener("message", handleMessage);
        startFallbackTimer();
      });
    },
    [clearError, handleAuthError, handleAuthSuccess, logGoogleAuthDebug]
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
        return handleAuthSuccess(sessionResponse, "register");
      } catch (cause) {
        handleAuthError(cause, "register");
        throw cause;
      }
    },
    [handleAuthError, handleAuthSuccess]
  );

  const logout = useCallback(async () => {
    persistSession(null);
    setSession(null);
    setStatus("unauthenticated");
    setError(null);
    try {
      await StorefrontApi.logout();
    } catch (error) {
      console.warn("[session] Failed to revoke storefront session", error);
    }
    toast.info({
      title: "Sesión cerrada",
      description: "Cerraste sesión correctamente."
    });
  }, [toast]);

  const updateCustomerProfile = useCallback((profile: CustomerProfile) => {
    const normalizedProfile = normalizeCustomerProfile(profile);
    setSession((current) => {
      if (!current) {
        return current;
      }
      const nextSession: AuthSession = {
        ...current,
        customer: normalizedProfile
      };
      const normalizedSession = normalizeAuthSession(nextSession);
      persistSession(normalizedSession);
      return normalizedSession;
    });
  }, []);

  const updateWishlistSummary = useCallback((summary: { count: number; productIds: number[] }) => {
    setSession((current) => {
      if (!current) {
        return current;
      }
      const normalizedIds = normalizeWishlistProductIds(summary.productIds);
      const wishlistCount =
        typeof summary.count === "number" && Number.isFinite(summary.count)
          ? Math.max(0, Math.trunc(summary.count))
          : normalizedIds.length;
      const nextSession: AuthSession = {
        ...current,
        customer: {
          ...current.customer,
          wishlistCount,
          wishlistProductIds: normalizedIds
        }
      };
      const normalizedSession = normalizeAuthSession(nextSession);
      persistSession(normalizedSession);
      return normalizedSession;
    });
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      status,
      isAuthenticated: status === "authenticated" && !!session,
      login,
      register,
      loginWithGoogle,
      logout,
      error,
      clearError,
      updateCustomerProfile,
      updateWishlistSummary,
      googleAuthDebug: {
        isEnabled: googleAuthDebugEnabled,
        events: googleAuthDebugEvents,
        clear: clearGoogleAuthDebug
      }
    }),
    [
      session,
      status,
      login,
      register,
      loginWithGoogle,
      logout,
      error,
      clearError,
      updateCustomerProfile,
      updateWishlistSummary,
      googleAuthDebugEnabled,
      googleAuthDebugEvents,
      clearGoogleAuthDebug
    ]
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

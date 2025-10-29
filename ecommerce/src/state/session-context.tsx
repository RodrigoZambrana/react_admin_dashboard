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
const GOOGLE_STATE_STORAGE_KEY = "storefront.google.oauth.state";

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
    window.sessionStorage.removeItem(GOOGLE_STATE_STORAGE_KEY);
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
  state?: string | null;
};

type GoogleAuthErrorMessage = {
  type: typeof GOOGLE_AUTH_MESSAGE_TYPE;
  status: "error";
  errorCode?: string;
  message?: string;
  details?: string | null;
  returnPath?: string | null;
  state?: string | null;
};

type GoogleAuthMessage = GoogleAuthSuccessMessage | GoogleAuthErrorMessage;

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

      const requestedReturnPath =
        typeof options?.returnPath === "string" && options.returnPath.trim().startsWith("/")
          ? options.returnPath.trim()
          : null;

      let startResponse: { url: string; state: string; expiresAt: string };
      try {
        startResponse = await StorefrontApi.startGoogleLogin(requestedReturnPath ?? undefined);
      } catch (cause) {
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

      try {
        window.sessionStorage.setItem(GOOGLE_STATE_STORAGE_KEY, startResponse.state);
      } catch (error) {
        console.warn("[session] Unable to persist Google OAuth state", error);
      }

      const popup = window.open(
        startResponse.url,
        "storefront-google-auth",
        `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,resizable=yes,scrollbars=yes`
      );

      if (!popup) {
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

      const trustedOrigins = new Set<string>();
      if (typeof env.publicSiteOrigin === "string" && env.publicSiteOrigin.length > 0) {
        trustedOrigins.add(env.publicSiteOrigin);
      }
      try {
        trustedOrigins.add(new URL(env.publicApiBaseUrl).origin);
      } catch (error) {
        console.warn("[session] Invalid API base URL for Google auth origin", error);
      }
      trustedOrigins.add(window.location.origin);

      return new Promise<{ session: AuthSession; returnPath: string | null }>((resolve, reject) => {
        let completed = false;
        let fallbackTimer: number | undefined;
        let detachPopupUnloadListener: (() => void) | null = null;
        let completionInFlight = false;
        let sessionPollTimer: number | undefined;
        let sessionPollInFlight = false;
        let sessionPollAttempts = 0;
        const maxSessionPollAttempts = 20;
        const sessionPollIntervalMs = 1500;

        const clearFallbackTimer = () => {
          if (fallbackTimer) {
            window.clearTimeout(fallbackTimer);
            fallbackTimer = undefined;
          }
        };

        const clearSessionPoll = () => {
          if (sessionPollTimer) {
            window.clearInterval(sessionPollTimer);
            sessionPollTimer = undefined;
          }
          sessionPollInFlight = false;
        };

        const cleanup = () => {
          completed = true;
          window.removeEventListener("message", handleMessage);
          clearFallbackTimer();
          clearSessionPoll();
          if (detachPopupUnloadListener) {
            try {
              detachPopupUnloadListener();
            } catch (error) {
              console.warn("[session] Unable to detach Google auth popup listener", error);
            }
            detachPopupUnloadListener = null;
          }
          try {
            window.sessionStorage.removeItem(GOOGLE_STATE_STORAGE_KEY);
          } catch (error) {
            console.warn("[session] Unable to clear Google OAuth state", error);
          }
          try {
            popup.close();
          } catch (error) {
            console.warn("[session] Unable to close Google auth popup", error);
            try {
              popup.opener?.postMessage({ type: "storefront:force-close-google" }, "*");
            } catch (postMessageError) {
              console.warn("[session] Fallback postMessage to close popup failed", postMessageError);
            }
          }
        };

        const fail = (error: Error) => {
          cleanup();
          try {
            handleAuthError(error, "login");
          } catch (cause) {
            reject(cause as Error);
            return;
          }
          reject(error);
        };

        const finishWithSession = async (initialSession?: AuthSession | null, returnPath?: string | null) => {
          if (completionInFlight) {
            return;
          }
          completionInFlight = true;
          try {
            let sessionPayload =
              initialSession ??
              (await StorefrontApi.getCurrentSession().catch((error) => {
                throw error instanceof Error
                  ? error
                  : new Error("No pudimos recuperar tu sesión desde el servidor.");
              }));

            if (sessionPayload?.refreshToken) {
              try {
                sessionPayload = await StorefrontApi.refreshSession(sessionPayload.refreshToken);
              } catch (refreshError) {
                console.warn("[session] Unable to refresh storefront session after Google login", refreshError);
              }
            }

            cleanup();
            const normalized = handleAuthSuccess(sessionPayload, "login");
            const targetReturnPath =
              typeof returnPath === "string" && returnPath.trim()
                ? returnPath.trim()
                : requestedReturnPath;

            resolve({
              session: normalized,
              returnPath: targetReturnPath ?? null
            });
          } catch (error) {
            fail(
              error instanceof Error ? error : new Error("No pudimos completar el inicio de sesión con Google.")
            );
          }
        };

        const startFallbackTimer = () => {
          const timeoutMs = 2 * 60 * 1000;
          clearFallbackTimer();
          fallbackTimer = window.setTimeout(() => {
            if (completed) {
              return;
            }
            fail(
              new Error(
                "La autenticación con Google tardó demasiado. Cierra la ventana e inténtalo nuevamente."
              )
            );
          }, timeoutMs);
        };

        const attachPopupUnloadListener = () => {
          if (!popup || typeof popup.addEventListener !== "function") {
            return;
          }
          const handlePopupUnload = () => {
            if (completed) {
              return;
            }
            fail(new Error("Se cerró la ventana de Google antes de finalizar el acceso."));
          };
          popup.addEventListener("beforeunload", handlePopupUnload);
          detachPopupUnloadListener = () => {
            popup.removeEventListener("beforeunload", handlePopupUnload);
          };
        };

        const startSessionPoll = () => {
          if (sessionPollTimer) {
            return;
          }
          sessionPollTimer = window.setInterval(async () => {
            if (completed || completionInFlight) {
              clearSessionPoll();
              return;
            }
            if (sessionPollInFlight) {
              return;
            }
            sessionPollInFlight = true;
            sessionPollAttempts += 1;
            try {
              const session = await StorefrontApi.getCurrentSession();
              await finishWithSession(session, requestedReturnPath);
            } catch (error) {
              if (isApiError(error)) {
                if (error.status !== 401) {
                  console.warn("[session] Google auth session poll failed", {
                    status: error.status,
                    message: error.message
                  });
                }
              } else {
                console.warn("[session] Google auth session poll encountered error", error);
              }
            } finally {
              sessionPollInFlight = false;
              if (sessionPollAttempts >= maxSessionPollAttempts && !completionInFlight) {
                clearSessionPoll();
              }
            }
          }, sessionPollIntervalMs);
        };

        const handleMessage = (event: MessageEvent) => {
          let receivedOrigin = event.origin;
          if (!receivedOrigin || receivedOrigin === "null") {
            receivedOrigin = window.location.origin;
          }
          if (trustedOrigins.size > 0 && receivedOrigin && !trustedOrigins.has(receivedOrigin)) {
            console.warn("[session] Ignoring Google auth message from unexpected origin", {
              receivedOrigin,
              trustedOrigins: Array.from(trustedOrigins)
            });
            return;
          }
          const data = event.data;
          if (!isGoogleAuthMessage(data)) {
            return;
          }
          console.log("Google auth message received", data);
          let expectedState: string | null = null;
          try {
            expectedState = window.sessionStorage.getItem(GOOGLE_STATE_STORAGE_KEY);
          } catch (error) {
            console.warn("[session] Unable to read Google OAuth state", error);
          }
          if (expectedState && data.state && data.state !== expectedState) {
            console.warn("[session] Ignoring Google auth message due to state mismatch");
            return;
          }

          if (data.status === "success") {
            const initialSession =
              data.session && typeof data.session === "object" ? (data.session as AuthSession) : null;
            const messageReturnPath =
              typeof data.returnPath === "string" && data.returnPath.trim() ? data.returnPath.trim() : null;
            void finishWithSession(initialSession, messageReturnPath ?? requestedReturnPath);
          } else {
            const message =
              (typeof data.message === "string" && data.message.trim()) ||
              "Unable to sign in with Google. Please try again.";
            fail(new Error(message));
          }
        };

        window.addEventListener("message", handleMessage);
        attachPopupUnloadListener();
        startSessionPoll();
        startFallbackTimer();
      });
    },
    [clearError, handleAuthError, handleAuthSuccess]
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
      updateWishlistSummary
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
      updateWishlistSummary
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

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
import {
  GOOGLE_AUTH_STORAGE_KEY,
  GoogleAuthMessage,
  isGoogleAuthMessage,
  parseGoogleAuthStorageValue
} from "@/state/google-auth-channel";

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

      let startResponse: { url: string; state: string; expiresAt: string };
      try {
        startResponse = await StorefrontApi.startGoogleLogin(options?.returnPath);
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
        window.localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
      } catch (error) {
        console.warn("[session] Failed to clear stale Google auth payload", error);
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
      const addTrustedOrigin = (value: string | null | undefined, context: string) => {
        if (!value) {
          return;
        }
        try {
          trustedOrigins.add(new URL(value).origin);
        } catch (error) {
          console.warn(`[session] Invalid ${context} URL for Google auth origin`, error);
        }
      };

      addTrustedOrigin(env.publicApiBaseUrl, "API base");
      addTrustedOrigin(env.apiBaseUrl, "server API base");
      addTrustedOrigin(startResponse.url, "Google auth start");
      trustedOrigins.add(window.location.origin);

      return new Promise<{ session: AuthSession; returnPath: string | null }>((resolve, reject) => {
        let completed = false;
        let detachPopupCloseListener: (() => void) | null = null;
        let detachStorageListener: (() => void) | null = null;
        let fallbackTimer: number | undefined;
        let popupClosePoll: number | undefined;

        const clearFallbackTimer = () => {
          if (fallbackTimer) {
            window.clearTimeout(fallbackTimer);
            fallbackTimer = undefined;
          }
        };

        const removePopupCloseListener = () => {
          if (popupClosePoll !== undefined) {
            window.clearInterval(popupClosePoll);
            popupClosePoll = undefined;
          }

          detachPopupCloseListener = null;
        };

        const removeStorageListener = () => {
          if (detachStorageListener) {
            detachStorageListener();
            detachStorageListener = null;
          }
        };

        const deliverResult = (data: GoogleAuthMessage) => {
          if (completed) {
            return;
          }

          if (data.status === "success") {
            cleanup();
            try {
              const normalized = handleAuthSuccess(data.session, "login");
              resolve({
                session: normalized,
                returnPath:
                  typeof data.returnPath === "string" && data.returnPath.trim()
                    ? data.returnPath.trim()
                    : null
              });
            } catch (cause) {
              reject(cause as Error);
            }
            return;
          }

          const message =
            (typeof data.message === "string" && data.message.trim()) ||
            "Unable to sign in with Google. Please try again.";
          fail(new Error(message));
        };

        const cleanup = () => {
          completed = true;
          window.removeEventListener("message", handleMessage);
          window.removeEventListener("storage", handleStorage);
          clearFallbackTimer();
          removePopupCloseListener();
          removeStorageListener();
          try {
            popup.close();
          } catch (error) {
            console.warn("[session] Unable to close Google auth popup", error);
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

        const handlePopupManualClose = () => {
          if (completed) {
            return;
          }

          const stored = consumeStoredResult();
          if (stored) {
            deliverResult(stored);
            return;
          }

          fail(new Error("Se cerró la ventana de Google antes de finalizar el acceso."));
        };

        const attachPopupCloseListener = () => {
          if (!popup) {
            return;
          }

          let manualClosePollingDisabled = false;

          const canInspectPopup = () => {
            if (!popup) {
              return false;
            }

            if (manualClosePollingDisabled) {
              return false;
            }

            try {
              // Attempt to access the property once to determine whether the browser will allow it.
              void popup.closed;
              return true;
            } catch (error) {
              manualClosePollingDisabled = true;
              return false;
            }
          };

          const checkPopupClosed = () => {
            if (!popup) {
              removePopupCloseListener();
              return;
            }

            if (manualClosePollingDisabled) {
              removePopupCloseListener();
              return;
            }

            let isClosed = false;
            try {
              isClosed = popup.closed;
            } catch (error) {
              manualClosePollingDisabled = true;
            }

            if (manualClosePollingDisabled) {
              removePopupCloseListener();
              return;
            }

            if (isClosed) {
              removePopupCloseListener();
              handlePopupManualClose();
            }
          };

          if (!canInspectPopup()) {
            return;
          }

          popupClosePoll = window.setInterval(checkPopupClosed, 500);
          detachPopupCloseListener = removePopupCloseListener;

          // Run an initial check in case the popup was already closed.
          checkPopupClosed();
        };

        const consumeStoredResult = (): GoogleAuthMessage | null => {
          try {
            const raw = window.localStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);
            if (!raw) {
              return null;
            }

            const parsed = parseGoogleAuthStorageValue(raw);
            if (!parsed || parsed.state !== startResponse.state) {
              return null;
            }

            window.localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
            return parsed;
          } catch (error) {
            console.warn("[session] Failed to read Google auth result from storage", error);
            return null;
          }
        };

        const handleStorage = (event: StorageEvent) => {
          if (event.key !== GOOGLE_AUTH_STORAGE_KEY || !event.newValue) {
            return;
          }

          const parsed = parseGoogleAuthStorageValue(event.newValue);
          if (!parsed || parsed.state !== startResponse.state) {
            return;
          }

          try {
            window.localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
          } catch (error) {
            console.warn("[session] Failed to clear Google auth storage key", error);
          }

          deliverResult(parsed);
        };

        const attachStorageListener = () => {
          window.addEventListener("storage", handleStorage);
          detachStorageListener = () => window.removeEventListener("storage", handleStorage);
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

        const handleMessage = (event: MessageEvent) => {
          if (!trustedOrigins.has(event.origin)) {
            return;
          }
          const rawData = event.data;
          const data =
            typeof rawData === "string"
              ? (() => {
                  try {
                    return JSON.parse(rawData) as unknown;
                  } catch (error) {
                    console.warn("[session] Failed to parse Google auth message", error);
                    return null;
                  }
                })()
              : rawData;
          if (!isGoogleAuthMessage(data)) {
            return;
          }
          if (data.state !== startResponse.state) {
            return;
          }

          deliverResult(data);
        };

        window.addEventListener("message", handleMessage);
        attachStorageListener();
        attachPopupCloseListener();
        startFallbackTimer();

        const immediateResult = consumeStoredResult();
        if (immediateResult) {
          deliverResult(immediateResult);
        }
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

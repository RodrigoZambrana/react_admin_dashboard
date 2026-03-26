"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ConversationsApi } from "@/lib/api/conversations";
import type {
  WebchatControlMode,
  WebchatSession,
  WebchatTranscriptMessage,
  WebchatScope,
} from "@/types/conversations";
import { useSession } from "@/state/session-context";

type WebchatMessage = WebchatTranscriptMessage & {
  pending?: boolean;
};

type WebchatContextValue = {
  isOpen: boolean;
  isReady: boolean;
  isHydrating: boolean;
  isSending: boolean;
  isSyncing: boolean;
  messages: WebchatMessage[];
  error: string | null;
  session: WebchatSession | null;
  controlMode: WebchatControlMode;
  needsHuman: boolean;
  taskSummary: string | null;
  lastSyncedAt: string | null;
  open: () => void;
  close: () => void;
  sendMessage: (text: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const STORAGE_KEY = "storefront.webchat.session.v1";
const WebchatContext = createContext<WebchatContextValue | undefined>(undefined);

const generateGuestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `guest-${Date.now()}`;

const makeMessage = (
  role: WebchatMessage["role"],
  text: string,
  pending = false,
): WebchatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  kind: "text",
  text,
  createdAt: new Date().toISOString(),
  pending,
});

const mapTranscriptMessage = (
  message: WebchatTranscriptMessage,
): WebchatMessage => ({
  id: message.id,
  role: message.role,
  kind: message.kind ?? "text",
  text: message.text,
  createdAt: message.createdAt,
  attachments: message.attachments,
  pending: false,
});

const resolveDesiredScope = (authenticated: boolean): WebchatScope =>
  authenticated ? "customer_authenticated" : "customer_public";

const isStoredSessionCompatible = (
  stored: WebchatSession,
  desiredScope: WebchatScope,
  customerEmail?: string | null,
) => {
  if (stored.scope !== desiredScope) {
    return false;
  }
  if (desiredScope === "customer_authenticated" && customerEmail) {
    return stored.participant.email === customerEmail;
  }
  return true;
};

const resolveCustomerDisplayName = (
  customer?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null,
) => {
  const value = [customer?.firstName, customer?.lastName]
    .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    .join(" ")
    .trim();

  return value || null;
};

export function WebchatProvider({ children }: { children: React.ReactNode }) {
  const { session: authSession, status: authStatus } = useSession();
  const customer = authSession?.customer;
  const desiredScope = resolveDesiredScope(Boolean(customer));
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<WebchatSession | null>(null);
  const [messages, setMessages] = useState<WebchatMessage[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const guestIdRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);

  const persistSession = useCallback((nextSession: WebchatSession | null) => {
    if (typeof window === "undefined") {
      return;
    }
    if (!nextSession) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
  }, []);

  const applySessionSnapshot = useCallback(
    (nextSession: WebchatSession) => {
      guestIdRef.current = nextSession.participant.guestId;
      setSession(nextSession);
      setMessages(nextSession.messages.map(mapTranscriptMessage));
      setLastSyncedAt(new Date().toISOString());
      persistSession(nextSession);
      return nextSession;
    },
    [persistSession],
  );

  useEffect(() => {
    if (typeof window === "undefined" || authStatus === "loading") {
      return;
    }

    let cancelled = false;
    const restoreSession = async () => {
      setIsHydrating(true);
      setIsReady(false);
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        if (!cancelled) {
          setSession(null);
          setMessages([]);
          setLastSyncedAt(null);
          setIsReady(true);
          setIsHydrating(false);
        }
        return;
      }
      try {
        const parsed = JSON.parse(stored) as WebchatSession;
        if (
          !isStoredSessionCompatible(
            parsed,
            desiredScope,
            customer?.email ?? null,
          )
        ) {
          throw new Error("webchat.sessionScopeMismatch");
        }

        guestIdRef.current = parsed.participant.guestId;
        const hydrated = await ConversationsApi.getWebchatSession({
          conversationId: parsed.conversationId,
          guestId: parsed.participant.guestId,
        });

        if (
          !isStoredSessionCompatible(
            hydrated,
            desiredScope,
            customer?.email ?? null,
          )
        ) {
          throw new Error("webchat.hydratedSessionScopeMismatch");
        }

        if (!cancelled) {
          applySessionSnapshot(hydrated);
        }
      } catch (loadError) {
        console.warn("[webchat] Unable to restore session", loadError);
        window.localStorage.removeItem(STORAGE_KEY);
        if (!cancelled) {
          setSession(null);
          setMessages([]);
          setLastSyncedAt(null);
        }
      } finally {
        if (!cancelled) {
          setIsReady(true);
          setIsHydrating(false);
        }
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [applySessionSnapshot, authStatus, customer?.email, desiredScope]);

  const syncSession = useCallback(
    async (
      activeSession?: WebchatSession | null,
      options?: {
        silent?: boolean;
      },
    ) => {
      const targetSession = activeSession ?? session;
      if (!targetSession || syncInFlightRef.current) {
        return null;
      }

      syncInFlightRef.current = true;
      if (!options?.silent) {
        setIsSyncing(true);
      }

      try {
        const hydrated = await ConversationsApi.syncWebchatSession({
          conversationId: targetSession.conversationId,
          guestId: targetSession.participant.guestId,
          scope: targetSession.scope,
        });

        if (
          !isStoredSessionCompatible(
            hydrated,
            desiredScope,
            customer?.email ?? null,
          )
        ) {
          throw new Error("webchat.syncSessionScopeMismatch");
        }

        return applySessionSnapshot(hydrated);
      } catch (syncError) {
        console.warn("[webchat] Unable to sync session", syncError);
        if (!options?.silent) {
          setError("No fue posible actualizar la conversación.");
        }
        return null;
      } finally {
        syncInFlightRef.current = false;
        if (!options?.silent) {
          setIsSyncing(false);
        }
      }
    },
    [applySessionSnapshot, customer?.email, desiredScope, session],
  );

  const ensureSession = useCallback(async () => {
    if (
      session &&
      isStoredSessionCompatible(
        session,
        desiredScope,
        customer?.email ?? null,
      )
    ) {
      return session;
    }

    const guestId = guestIdRef.current || generateGuestId();
    guestIdRef.current = guestId;

    const nextSession = await ConversationsApi.createWebchatSession({
      tenantKey: "urucortinas",
      guestId,
      name: resolveCustomerDisplayName(customer),
      email: customer?.email || null,
      authenticated: Boolean(customer),
      locale: customer?.preferredLocale || "es-UY",
      page: typeof window !== "undefined" ? window.location.pathname : "/",
    });

    return applySessionSnapshot(nextSession);
  }, [
    applySessionSnapshot,
    customer,
    desiredScope,
    session,
  ]);

  const open = useCallback(() => {
    setIsOpen(true);
    setError(null);
    if (authStatus === "loading") {
      return;
    }
    if (!session) {
      void ensureSession().catch((openError) => {
        console.error(openError);
        setError("No fue posible iniciar la conversación.");
      });
      return;
    }
    void syncSession(session, { silent: true });
  }, [authStatus, ensureSession, session, syncSession]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      setIsSending(true);
      setError(null);
      const customerMessage = makeMessage("customer", trimmed, true);
      setMessages((current) => [...current, customerMessage]);

      try {
        const activeSession = await ensureSession();
        const result = await ConversationsApi.sendWebchatMessage({
          tenantKey: activeSession.tenantKey,
          conversationId: activeSession.conversationId,
          guestId: activeSession.participant.guestId,
          userId: activeSession.participant.guestId,
          scope: activeSession.scope,
          text: trimmed,
          metadata: {
            page:
              typeof window !== "undefined"
                ? window.location.pathname
                : activeSession.context.page,
          },
        });

        const syncedSession = await syncSession(activeSession, { silent: true });
        if (!syncedSession) {
          const agentText = result.ai?.text?.trim();
          setMessages((current) => {
            const withoutPending = current.map((message) =>
              message.id === customerMessage.id
                ? {
                    ...message,
                    pending: false,
                  }
                : message,
            );
            return agentText
              ? [...withoutPending, makeMessage("agent", agentText)]
              : withoutPending;
          });
          setError("El mensaje se envió, pero no pudimos sincronizar la conversación.");
        }
      } catch (sendError) {
        console.error(sendError);
        setMessages((current) =>
          current.filter((message) => message.id !== customerMessage.id),
        );
        setError("No fue posible enviar el mensaje.");
      } finally {
        setIsSending(false);
      }
    },
    [ensureSession, syncSession],
  );

  useEffect(() => {
    if (!isOpen || !session || authStatus === "loading") {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (syncInFlightRef.current || isSending) {
        return;
      }
      void syncSession(session, { silent: true });
    }, 7000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authStatus, isOpen, isSending, session, syncSession]);

  const value = useMemo<WebchatContextValue>(
    () => ({
      isOpen,
      isReady: isReady && authStatus !== "loading",
      isHydrating,
      isSending,
      isSyncing,
      messages,
      error,
      session,
      controlMode: session?.controlMode ?? "ai",
      needsHuman: Boolean(session?.needsHuman),
      taskSummary: session?.aiState?.memory?.taskSummary ?? null,
      lastSyncedAt,
      open,
      close,
      sendMessage,
      refresh: async () => {
        await syncSession();
      },
    }),
    [
      authStatus,
      close,
      error,
      isHydrating,
      isOpen,
      isReady,
      isSending,
      isSyncing,
      lastSyncedAt,
      messages,
      open,
      sendMessage,
      session,
      syncSession,
    ],
  );

  return <WebchatContext.Provider value={value}>{children}</WebchatContext.Provider>;
}

export function useWebchat() {
  const context = useContext(WebchatContext);
  if (!context) {
    throw new Error("useWebchat must be used within a WebchatProvider");
  }
  return context;
}

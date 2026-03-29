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
  WebchatMessageAttachment,
  WebchatSession,
  WebchatTranscriptMessage,
  WebchatScope,
} from "@/types/conversations";
import { useSession } from "@/state/session-context";
import { useI18n } from "@/state/i18n-context";
import { useCurrency } from "@/state/currency-context";

type WebchatMessage = WebchatTranscriptMessage & {
  pending?: boolean;
};

type WebchatSendInput =
  | string
  | {
      text?: string;
      attachments?: WebchatMessageAttachment[];
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
  canRestartConversation: boolean;
  open: () => void;
  close: () => void;
  sendMessage: (input: WebchatSendInput) => Promise<void>;
  refresh: () => Promise<void>;
  restartConversation: () => Promise<void>;
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
  attachments: WebchatMessageAttachment[] = [],
  messageElements: WebchatMessage["messageElements"] = [],
  messageContextOrigin: WebchatMessage["messageContextOrigin"] = [],
): WebchatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  kind: "text",
  text,
  createdAt: new Date().toISOString(),
  attachments,
  messageElements,
  messageContextOrigin,
  pending,
});

const mapTranscriptMessage = (
  message: WebchatTranscriptMessage,
): WebchatMessage => ({
  id: message.id,
  role: message.role,
  kind: message.kind ?? "text",
  authorKind: message.authorKind,
  messageKind: message.messageKind,
  text: message.text,
  createdAt: message.createdAt,
  quotedMessage: message.quotedMessage,
  reactions: message.reactions,
  editedAt: message.editedAt,
  deleted: message.deleted,
  deletedAt: message.deletedAt,
  messageElements: message.messageElements,
  messageContextOrigin: message.messageContextOrigin,
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
  const { locale } = useI18n();
  const { currency } = useCurrency();
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
  const sessionRevisionRef = useRef(0);

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
    (
      nextSession: WebchatSession,
      options?: {
        expectedRevision?: number;
      },
    ) => {
      if (
        typeof options?.expectedRevision === "number" &&
        options.expectedRevision !== sessionRevisionRef.current
      ) {
        return null;
      }
      guestIdRef.current = nextSession.participant.guestId;
      setSession(nextSession);
      setMessages(nextSession.messages.map(mapTranscriptMessage));
      setLastSyncedAt(new Date().toISOString());
      persistSession(nextSession);
      return nextSession;
    },
    [persistSession],
  );

  const clearSessionSnapshot = useCallback(
    (options?: {
      nextGuestId?: string | null;
    }) => {
      guestIdRef.current = options?.nextGuestId ?? null;
      setSession(null);
      setMessages([]);
      setLastSyncedAt(null);
      persistSession(null);
    },
    [persistSession],
  );

  useEffect(() => {
    if (typeof window === "undefined" || authStatus === "loading") {
      return;
    }

    let cancelled = false;
    const restoreSession = async () => {
      const revision = sessionRevisionRef.current;
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

        if (!cancelled && revision === sessionRevisionRef.current) {
          applySessionSnapshot(hydrated, { expectedRevision: revision });
        }
      } catch (loadError) {
        console.warn("[webchat] Unable to restore session", loadError);
        window.localStorage.removeItem(STORAGE_KEY);
        if (!cancelled) {
          clearSessionSnapshot();
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
  }, [applySessionSnapshot, authStatus, clearSessionSnapshot, customer?.email, desiredScope]);

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
      const revision = sessionRevisionRef.current;

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

        if (revision !== sessionRevisionRef.current) {
          return null;
        }

        return applySessionSnapshot(hydrated, { expectedRevision: revision });
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

    const revision = sessionRevisionRef.current;
    const guestId = guestIdRef.current || generateGuestId();
    guestIdRef.current = guestId;

    const nextSession = await ConversationsApi.createWebchatSession({
      tenantKey: "urucortinas",
      guestId,
      name: resolveCustomerDisplayName(customer),
      email: customer?.email || null,
      authenticated: Boolean(customer),
      locale: customer?.preferredLocale || locale || "es-UY",
      currency,
      page: typeof window !== "undefined" ? window.location.pathname : "/",
    });

    const applied = applySessionSnapshot(nextSession, {
      expectedRevision: revision,
    });
    if (!applied) {
      throw new Error("webchat.sessionStale");
    }
    return applied;
  }, [
    applySessionSnapshot,
    currency,
    customer,
    desiredScope,
    locale,
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

  const restartConversation = useCallback(async () => {
    if (desiredScope !== "customer_public") {
      return;
    }

    sessionRevisionRef.current += 1;
    const revision = sessionRevisionRef.current;
    const nextGuestId = generateGuestId();
    clearSessionSnapshot({ nextGuestId });
    setError(null);
    setIsSyncing(true);

    try {
      const nextSession = await ConversationsApi.createWebchatSession({
        tenantKey: "urucortinas",
        guestId: nextGuestId,
        name: resolveCustomerDisplayName(customer),
        email: customer?.email || null,
        authenticated: false,
        locale: customer?.preferredLocale || locale || "es-UY",
        currency,
        page: typeof window !== "undefined" ? window.location.pathname : "/",
      });

      applySessionSnapshot(nextSession, {
        expectedRevision: revision,
      });
    } catch (restartError) {
      console.error(restartError);
      if (revision === sessionRevisionRef.current) {
        setError("No fue posible iniciar un chat nuevo.");
      }
    } finally {
      if (revision === sessionRevisionRef.current) {
        setIsSyncing(false);
      }
    }
  }, [applySessionSnapshot, clearSessionSnapshot, currency, customer, desiredScope, locale]);

  const sendMessage = useCallback(
    async (input: WebchatSendInput) => {
      const text = typeof input === "string" ? input : input.text ?? "";
      const attachments =
        typeof input === "string"
          ? []
          : Array.isArray(input.attachments)
            ? input.attachments.filter((attachment) => Boolean(attachment))
            : [];
      const trimmed = text.trim();
      if (!trimmed && attachments.length === 0) {
        return;
      }

      setIsSending(true);
      setError(null);
      const customerMessage = makeMessage("customer", trimmed, true, attachments);
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
          locale: activeSession.participant.locale || locale || "es-UY",
          currency: activeSession.participant.currency || currency,
          attachments,
          metadata: {
            page:
              typeof window !== "undefined"
                ? window.location.pathname
                : activeSession.context.page,
            locale: activeSession.participant.locale || locale || "es-UY",
            currency: activeSession.participant.currency || currency,
          },
        });

        const syncedSession = await syncSession(activeSession, { silent: true });
        const agentText =
          result.ai?.finalUserText?.trim() || result.ai?.text?.trim() || "";
        const agentAuditPayload =
          result.ai && typeof result.ai === "object" && result.ai.auditPayload
            ? (result.ai.auditPayload as Record<string, unknown>)
            : null;
        const agentMessageElements = Array.isArray(agentAuditPayload?.messageElements)
          ? (agentAuditPayload.messageElements as WebchatMessage["messageElements"])
          : [];
        const agentMessageContextOrigin = Array.isArray(agentAuditPayload?.messageContextOrigin)
          ? (agentAuditPayload.messageContextOrigin as WebchatMessage["messageContextOrigin"])
          : [];
        if (!syncedSession) {
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
              ? [
                  ...withoutPending,
                  makeMessage(
                    "agent",
                    agentText,
                    false,
                    [],
                    agentMessageElements,
                    agentMessageContextOrigin,
                  ),
                ]
              : withoutPending;
          });
          setError("El mensaje se envió, pero no pudimos sincronizar la conversación.");
          return;
        }

        const lastSyncedMessage =
          Array.isArray(syncedSession.messages) && syncedSession.messages.length > 0
            ? syncedSession.messages[syncedSession.messages.length - 1]
            : null;
        const hasAgentReplyInTranscript = lastSyncedMessage?.role === "agent";
        if (!hasAgentReplyInTranscript && agentText) {
          setMessages([
            ...syncedSession.messages.map(mapTranscriptMessage),
            makeMessage(
              "agent",
              agentText,
              false,
              [],
              agentMessageElements,
              agentMessageContextOrigin,
            ),
          ]);
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
    [currency, ensureSession, locale, syncSession],
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
      canRestartConversation: desiredScope === "customer_public",
      open,
      close,
      sendMessage,
      refresh: async () => {
        await syncSession();
      },
      restartConversation,
    }),
    [
      authStatus,
      desiredScope,
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
      restartConversation,
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

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
import type { WebchatSession } from "@/types/conversations";
import { useSession } from "@/state/session-context";

type WebchatMessage = {
  id: string;
  role: "customer" | "agent";
  text: string;
  createdAt: string;
};

type WebchatContextValue = {
  isOpen: boolean;
  isReady: boolean;
  isSending: boolean;
  messages: WebchatMessage[];
  error: string | null;
  session: WebchatSession | null;
  open: () => void;
  close: () => void;
  sendMessage: (text: string) => Promise<void>;
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
): WebchatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  createdAt: new Date().toISOString(),
});

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
  const { session: authSession } = useSession();
  const customer = authSession?.customer;
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<WebchatSession | null>(null);
  const [messages, setMessages] = useState<WebchatMessage[]>([]);
  const guestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WebchatSession;
        setSession(parsed);
        guestIdRef.current = parsed.participant.guestId;
      }
    } catch (loadError) {
      console.warn("[webchat] Unable to restore session", loadError);
    } finally {
      setIsReady(true);
    }
  }, []);

  const ensureSession = useCallback(async () => {
    if (session) {
      return session;
    }

    const guestId = guestIdRef.current || generateGuestId();
    guestIdRef.current = guestId;

    const nextSession = await ConversationsApi.createWebchatSession({
      tenantKey: "urucortinas",
      guestId,
      name: resolveCustomerDisplayName(customer),
      email: customer?.email || null,
      locale: customer?.preferredLocale || "es-UY",
      page: typeof window !== "undefined" ? window.location.pathname : "/",
    });

    setSession(nextSession);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    }
    return nextSession;
  }, [
    customer,
    session,
  ]);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

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
      const customerMessage = makeMessage("customer", trimmed);
      setMessages((current) => [...current, customerMessage]);

      try {
        const activeSession = await ensureSession();
        const result = await ConversationsApi.sendWebchatMessage({
          tenantKey: activeSession.tenantKey,
          conversationId: activeSession.conversationId,
          guestId: activeSession.participant.guestId,
          userId: activeSession.participant.guestId,
          text: trimmed,
          metadata: {
            page:
              typeof window !== "undefined" ? window.location.pathname : activeSession.context.page,
          },
        });

        const agentText = result.ai?.text?.trim();
        if (agentText) {
          setMessages((current) => [...current, makeMessage("agent", agentText)]);
        }
      } catch (sendError) {
        console.error(sendError);
        setError("No fue posible enviar el mensaje.");
      } finally {
        setIsSending(false);
      }
    },
    [ensureSession],
  );

  const value = useMemo<WebchatContextValue>(
    () => ({
      isOpen,
      isReady,
      isSending,
      messages,
      error,
      session,
      open,
      close,
      sendMessage,
    }),
    [close, error, isOpen, isReady, isSending, messages, open, sendMessage, session],
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

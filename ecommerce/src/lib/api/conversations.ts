"use client";

import { env } from "@/lib/env";
import type {
  WebchatMessageAttachment,
  WebchatSendMessageResult,
  WebchatSession,
  WebchatScope,
} from "@/types/conversations";

const conversationsBaseUrl = env.publicAiPlatformUrl;

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || "No fue posible completar la operación");
  }
  return payload as T;
};

const normalizeWebchatSession = (session: WebchatSession): WebchatSession => ({
  ...session,
  messages: Array.isArray(session.messages) ? session.messages : [],
  needsHuman: Boolean(session.needsHuman),
});

export const ConversationsApi = {
  async createWebchatSession(payload: {
    tenantKey?: string;
    guestId?: string;
    name?: string | null;
    email?: string | null;
    locale?: string;
    currency?: string;
    page?: string | null;
    authenticated?: boolean;
  }): Promise<WebchatSession> {
    const response = await fetch(`${conversationsBaseUrl}/chat/public/webchat/session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return normalizeWebchatSession(await parseResponse<WebchatSession>(response));
  },

  async sendWebchatMessage(payload: {
    tenantKey?: string;
    conversationId: string;
    guestId: string;
    userId?: string;
    scope?: "customer_public" | "customer_authenticated";
    text?: string;
    locale?: string;
    currency?: string;
    attachments?: WebchatMessageAttachment[];
    authenticated?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<WebchatSendMessageResult> {
    const response = await fetch(`${conversationsBaseUrl}/chat/public/webchat/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return parseResponse<WebchatSendMessageResult>(response);
  },

  async getWebchatSession(payload: {
    conversationId: string;
    guestId?: string;
  }): Promise<WebchatSession> {
    const url = new URL(
      `${conversationsBaseUrl}/chat/public/webchat/session/${payload.conversationId}`,
    );
    if (payload.guestId) {
      url.searchParams.set("guestId", payload.guestId);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
    });

    return normalizeWebchatSession(await parseResponse<WebchatSession>(response));
  },

  async syncWebchatSession(payload: {
    conversationId: string;
    guestId?: string;
    scope?: WebchatScope;
  }): Promise<WebchatSession> {
    return this.getWebchatSession(payload);
  },
};

"use client";

import { env } from "@/lib/env";
import type {
  WebchatSendMessageResult,
  WebchatSession,
} from "@/types/conversations";

const conversationsBaseUrl = env.publicApiBaseUrl.replace(/\/storefront$/, "");

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || "No fue posible completar la operación");
  }
  return payload as T;
};

export const ConversationsApi = {
  async createWebchatSession(payload: {
    tenantKey?: string;
    guestId?: string;
    name?: string | null;
    email?: string | null;
    locale?: string;
    page?: string | null;
  }): Promise<WebchatSession> {
    const response = await fetch(`${conversationsBaseUrl}/conversations/webchat/session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return parseResponse<WebchatSession>(response);
  },

  async sendWebchatMessage(payload: {
    tenantKey?: string;
    conversationId: string;
    guestId: string;
    userId?: string;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<WebchatSendMessageResult> {
    const response = await fetch(`${conversationsBaseUrl}/conversations/webchat/dispatch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return parseResponse<WebchatSendMessageResult>(response);
  },
};

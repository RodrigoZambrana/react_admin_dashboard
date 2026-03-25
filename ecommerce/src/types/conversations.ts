export type WebchatSession = {
  sessionId: string;
  conversationId: string;
  tenantKey: string;
  scope: "customer_public";
  channel: "webchat";
  controlMode: "ai";
  participant: {
    guestId: string;
    name: string | null;
    email: string | null;
    locale: string;
  };
  context: {
    page: string | null;
  };
  messages?: WebchatTranscriptMessage[];
};

export type WebchatTranscriptMessage = {
  id: string;
  role: "customer" | "agent";
  text: string;
  createdAt: string;
};

export type WebchatAiResponse = {
  conversationId: string;
  scope: string;
  provider: string;
  model: string;
  text: string;
  toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
};

export type WebchatSendMessageResult = {
  ok: boolean;
  status: string;
  normalized: {
    channel: string;
    scope: string;
    tenantKey: string;
    userId: string;
    conversationId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
  };
  ai: WebchatAiResponse | null;
};

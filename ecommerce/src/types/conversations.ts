export type WebchatScope = "customer_public" | "customer_authenticated";
export type WebchatRole = "customer_public" | "customer_authenticated";
export type WebchatControlMode = "ai" | "human" | "hybrid";

export type WebchatSession = {
  sessionId: string;
  conversationId: string;
  tenantKey: string;
  scope: WebchatScope;
  role?: WebchatRole;
  channel: "webchat";
  controlMode: WebchatControlMode;
  needsHuman: boolean;
  participant: {
    guestId: string;
    name: string | null;
    email: string | null;
    locale: string;
  };
  context: {
    page: string | null;
  };
  aiState?: WebchatAiState | null;
  messages: WebchatTranscriptMessage[];
};

export type WebchatTranscriptMessage = {
  id: string;
  role: "customer" | "agent";
  kind?: string | null;
  text: string;
  createdAt: string;
  attachments?: Array<{
    assetType?: string | null;
    fileName?: string | null;
    contentType?: string | null;
    textContent?: string | null;
  }>;
};

export type WebchatMessageAttachment = {
  assetType?: string;
  fileName?: string;
  contentType?: string;
  content?: string;
  textContent?: string;
  metadata?: Record<string, unknown>;
};

export type WebchatAiResponse = {
  conversationId: string;
  scope: string;
  role?: string;
  provider: string;
  model: string;
  text: string;
  toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
};

export type WebchatAiState = {
  needsHuman: boolean;
  grounded: boolean;
  role?: string | null;
  fallbackReason?: string | null;
  sourceCount: number;
  sources: Array<{
    id?: string | null;
    title?: string | null;
    scope?: string | null;
    sourceType?: string | null;
    score?: number | null;
  }>;
  memory?: {
    taskId?: string | null;
    intentKey?: string | null;
    taskSummary?: string | null;
    resetApplied?: boolean;
    resetCount?: number;
    lastResetAt?: string | null;
    historyTurnCount?: number;
    currentTask?: {
      intentKey?: string | null;
      status?: string | null;
      lastUpdate?: string | null;
      entities?: Array<{
        type?: string | null;
        value?: string | null;
      }>;
    } | null;
  } | null;
  audit?: {
    role?: string | null;
    intentKey?: string | null;
    blockedTools: string[];
    executedTools: string[];
    fallbackActivated: boolean;
    taskChanged: boolean;
    createdAt?: string | null;
  } | null;
  updatedAt?: string | null;
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
    attachments?: WebchatMessageAttachment[];
    metadata?: Record<string, unknown>;
  };
  ai: WebchatAiResponse | null;
};

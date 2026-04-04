import type { AsyncConversationTurnStatus } from '@prisma/client';

export type AsyncPresenceState =
  | 'idle'
  | 'queued'
  | 'processing'
  | 'awaiting_reply'
  | 'completed'
  | 'superseded'
  | 'failed';

export type AsyncChatTurnView = {
  id: string;
  conversationId: string;
  status: AsyncPresenceState;
  internalStatus: AsyncConversationTurnStatus;
  traceId: string;
  locale: string | null;
  acceptedAt: string;
  firstInputAt: string;
  lastInputAt: string;
  processingStartedAt: string | null;
  processingCompletedAt: string | null;
  flushAt: string;
  replyDueAt: string | null;
  projectedAt: string | null;
  supersededAt: string | null;
  stabilizationDelayMs: number;
  replyDelayMs: number;
  inputCount: number;
  semanticInput: string;
  assistantMessageId: string | null;
  supersededByTurnId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultSummary: Record<string, unknown> | null;
  inputs: Array<{
    id: string;
    sequence: number;
    content: string;
    locale: string | null;
    receivedAt: string;
  }>;
};

export type AsyncChatSessionView = {
  conversation: {
    id: string;
    language: string | null;
    channel: string;
    createdAt: string;
    updatedAt: string;
  };
  presence: {
    state: AsyncPresenceState;
    awaitingReply: boolean;
    turnId: string | null;
    acceptedAt: string | null;
    flushAt: string | null;
    replyDueAt: string | null;
    typingActive: boolean;
    typingExpiresAt: string | null;
  };
  activeTurn: AsyncChatTurnView | null;
  latestCompletedTurn: AsyncChatTurnView | null;
  turns: AsyncChatTurnView[];
  messages: Array<{
    id: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    content: string;
    createdAt: string;
    metadata?: Record<string, unknown> | null;
  }>;
};

export type AsyncChatAcceptedResponse = {
  conversationId: string;
  turn: AsyncChatTurnView;
  presence: AsyncChatSessionView['presence'];
};

export type AsyncChatTypingResponse = {
  conversationId: string;
  typingActive: boolean;
  typingExpiresAt: string | null;
  presence: AsyncChatSessionView['presence'];
};

export type AsyncChatConversationSummary = {
  conversationId: string;
  language: string | null;
  channel: string;
  createdAt: string;
  updatedAt: string;
  presence: AsyncPresenceState;
  awaitingReply: boolean;
  typingActive: boolean;
  activeTurnId: string | null;
  latestPreview: string | null;
  latestMessageRole: 'USER' | 'ASSISTANT' | 'SYSTEM' | null;
  latestTimestamp: string | null;
};

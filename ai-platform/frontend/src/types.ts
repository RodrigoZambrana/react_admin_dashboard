export type ManagedResourceStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type DocumentIngestionStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type DocumentOriginKind = 'TEXT' | 'UPLOAD';

export type ConversationSummary = {
  id: string;
  language: string | null;
  channel?: string;
  createdAt?: string;
  updatedAt?: string;
  messages?: Array<{
    id: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    content: string;
  }>;
};

export type ConversationMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type ChatLog = {
  id: string;
  traceId: string;
  stage: string;
  status: string;
  createdAt: string;
  payload: Record<string, unknown>;
  conversationId?: string | null;
};

export type PromptVersion = {
  id: string;
  key: string;
  version: number;
  status: ManagedResourceStatus;
  template: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  createdBy?: string | null;
};

export type TemporalLocaleResource = {
  locale: string;
  datePhrases: string[];
  timeJoiners: string[];
};

export type TemporalLocaleVersion = {
  id: string;
  locale: string;
  version: number;
  status: ManagedResourceStatus;
  resource: TemporalLocaleResource;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  createdBy?: string | null;
};

export type AiRuntimeResource = {
  provider: string;
  model: string;
  timeoutMs: number;
  credentials: {
    strategy: 'none' | 'env';
    envKey?: string | null;
  };
  providerOptions: Record<string, unknown>;
};

export type LearningRuntimeResource = {
  enabled: boolean;
  observedStages: string[];
  minConfidence: number;
  maxBodyLength: number;
  maxSummaryLength: number;
  persistEmbeddings: boolean;
};

export type AsyncIntakeRuntimeResource = {
  stabilization: {
    defaultDelayMs: number;
    maxWindowMs: number;
    fragmentContinuationDelayMs: number;
    trailingThoughtDelayMs: number;
    shortMessageDelayMs: number;
    mediumIncompleteDelayMs: number;
    longCompletedDelayMs: number;
    shortMessageLengthThreshold: number;
    mediumMessageLengthThreshold: number;
    longCompletedLengthThreshold: number;
  };
  replyProjection: {
    minDelayMs: number;
    maxDelayMs: number;
    charDelayMs: number;
  };
  lexicons: Record<
    string,
    {
      leadingTokens: string[];
      trailingTokens: string[];
      slotPatterns: string[];
    }
  >;
};

export type CriticalConfigVersion = {
  id: string;
  key: 'ai_runtime' | 'learning' | 'async_intake';
  version: number;
  status: ManagedResourceStatus;
  value: AiRuntimeResource | LearningRuntimeResource | AsyncIntakeRuntimeResource;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  createdBy?: string | null;
};

export type AiRuntimeDiagnostics = {
  provider: string;
  model: string | null;
  timeoutMs: number | null;
  source:
    | {
        type: 'managed';
        key: 'ai_runtime';
        version: number | null;
      }
    | {
        type: 'bootstrap';
        reason: 'env_openai_exploratory_default' | 'env_provider_override';
      }
    | {
        type: 'fallback';
        reason: 'missing_managed_resource';
      };
  status: 'ready' | 'invalid' | 'fallback';
  canUseRuntime: boolean;
  exploratoryReady: boolean;
  providerRegistered: boolean;
  supportedProviders: string[];
  credentials: {
    strategy: 'none' | 'env';
    envKey: string | null;
    resolved: boolean;
  };
  issues: Array<{
    code: string;
    severity: 'error' | 'warning';
    message: string;
  }>;
};

export type KnowledgeMetadataResource = {
  enabledStages: string[];
  metadataAllowList: string[];
  stagePolicies: Record<
    string,
    {
      enabled: boolean;
      minConfidence: number;
      defaultTags: string[];
    }
  >;
};

export type KnowledgeMetadataVersion = {
  id: string;
  key: 'default';
  version: number;
  status: ManagedResourceStatus;
  resource: KnowledgeMetadataResource;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  createdBy?: string | null;
};

export type ResponseFallbackCatalog = {
  locale: string;
  templates: Record<string, string>;
  actionLabels: Record<string, string>;
  defaults: Record<string, string>;
};

export type ResponseFallbackVersion = {
  id: string;
  locale: string;
  version: number;
  status: ManagedResourceStatus;
  resource: ResponseFallbackCatalog;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  createdBy?: string | null;
};

export type KnowledgeEntry = {
  id: string;
  sourceLogId?: string | null;
  category: 'GENERAL' | 'FAQ' | 'PRODUCT' | 'BOOKING' | 'QUOTE' | 'POLICY';
  title: string;
  body: string;
  summary: string;
  tags: string[];
  confidence: number;
  embeddingId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type DocumentChunk = {
  id: string;
  documentId: string;
  sequence: number;
  content: string;
  searchText: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type DocumentRecord = {
  id: string;
  title: string;
  status: ManagedResourceStatus;
  ingestionStatus: DocumentIngestionStatus;
  originKind: DocumentOriginKind;
  sourceName?: string | null;
  mimeType?: string | null;
  language?: string | null;
  sourceText: string;
  summary?: string | null;
  chunkCount: number;
  lastIngestedAt?: string | null;
  lastError?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  chunks: DocumentChunk[];
};

export type ConversationStateSummary = {
  id?: string;
  lane: string;
  lastIntent?: string | null;
  lastApprovedAction?: string | null;
  lastApprovedToolName?: string | null;
  approvedFacts?: Record<string, unknown> | null;
  pendingFacts?: Record<string, unknown> | null;
  missingFields: string[];
  nextUsefulField?: string | null;
  lastApprovedResult?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  updatedAt?: string;
};

export type TraceStageSummary = {
  stage: string;
  status: string;
  createdAt: string;
};

export type TraceSummary = {
  traceId: string;
  conversationId?: string | null;
  firstStageAt: string;
  lastStageAt: string;
  stages: TraceStageSummary[];
  interpretation?: {
    intent?: string | null;
    usedFallback?: boolean | null;
  } | null;
  decision?: {
    domain?: string | null;
    action?: string | null;
    toolName?: string | null;
    missingFields?: string[];
  } | null;
  execution?: {
    ok?: boolean | null;
    toolName?: string | null;
    failure?: Record<string, unknown> | null;
  } | null;
  response?: {
    text?: string | null;
    fallbackReason?: string | null;
  } | null;
};

export type TraceDetail = {
  summary: TraceSummary;
  logs: ChatLog[];
};

export type TestCenterRunSummary = {
  id: string;
  language?: string | null;
  channel: string;
  createdAt: string;
  updatedAt: string;
  latestMessage?: string | null;
  latestRole?: string | null;
  traceCount: number;
};

export type TestCenterRunDetail = {
  conversation: {
    id: string;
    language?: string | null;
    channel: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: ConversationMessage[];
  state: ConversationStateSummary | null;
  traces: TraceSummary[];
  logs: ChatLog[];
};

export type TraceComparison = {
  left: TraceSummary;
  right: TraceSummary;
  comparison: {
    sameStageSequence: boolean;
    sameIntent: boolean;
    sameDecisionAction: boolean;
    sameToolName: boolean;
    sameExecutionOutcome: boolean;
    sameResponse: boolean;
    differingStages: string[];
  };
};

export type ReplayTurnResult = {
  input: string;
  locale?: string | null;
  traceId: string;
  response: string;
  intent: string;
  metadata: {
    conversationId: string;
    traceId: string;
  };
};

export type ReplayResponse = {
  conversationId: string;
  turns: ReplayTurnResult[];
  detail: TestCenterRunDetail;
};

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
  internalStatus:
    | 'STABILIZING'
    | 'PROCESSING'
    | 'AWAITING_REPLY'
    | 'COMPLETED'
    | 'SUPERSEDED'
    | 'FAILED';
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

export type AsyncChatConversationSummary = {
  conversationId: string;
  language: string | null;
  channel: string;
  createdAt: string;
  updatedAt: string;
  presence: AsyncPresenceState;
  awaitingReply: boolean;
  activeTurnId: string | null;
  latestPreview: string | null;
  latestMessageRole: 'USER' | 'ASSISTANT' | 'SYSTEM' | null;
  latestTimestamp: string | null;
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
  };
  activeTurn: AsyncChatTurnView | null;
  latestCompletedTurn: AsyncChatTurnView | null;
  turns: AsyncChatTurnView[];
  messages: ConversationMessage[];
};

export type AsyncChatAcceptedResponse = {
  conversationId: string;
  turn: AsyncChatTurnView;
  presence: AsyncChatSessionView['presence'];
};

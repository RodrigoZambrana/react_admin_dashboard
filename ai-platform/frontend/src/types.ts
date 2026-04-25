export type ManagedResourceStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type DocumentIngestionStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type DocumentOriginKind = 'TEXT' | 'UPLOAD' | 'URL';

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

export type PromptEffectiveView = {
  key: 'interpretation' | 'response';
  promptId: string | null;
  promptVersion: number | null;
  source: 'managed' | 'recommended_default' | 'caller_override';
  localeHint: string | null;
  effectivePolicy: string;
  recommendedPolicy: string;
  differsFromRecommended: boolean;
  managedPromptStatus: ManagedResourceStatus | null;
  managedPromptCreatedAt: string | null;
  managedPromptCreatedBy: string | null;
  safetyLines: string[];
  contractLines: string[];
  assembledSystemPrompt: string;
};

export type RuntimeResourceContextView = {
  tenantId: string;
  defaultTenantId: string | null;
  source: 'default_tenant' | 'header_override';
  matchesDefault: boolean;
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

export type TenantCapabilitiesResource = {
  capabilities: Array<{
    key: 'booking' | 'quote' | 'product_catalog_lookup' | 'support_post_sale';
    enabled: boolean;
    description: string;
    intents: string[];
    tools: string[];
    config?: Record<string, unknown>;
  }>;
};

export type ChannelSecretRef = {
  strategy: 'local' | 'env';
  ref: string;
};

export type ChannelRouteDefaults = {
  inboxKey: string | null;
  queueKey: string | null;
  scope: 'customer_public' | 'customer_authenticated' | 'admin_internal';
};

export type ChannelConnectionStateView = {
  channelKey: string;
  driver: string;
  enabled: boolean;
  connectionState: string;
  health: 'healthy' | 'degraded' | 'offline' | 'unknown';
  summary: string | null;
  observedAt: string;
};

export type MetaChannelSettingsView = {
  config: {
    enabled: boolean;
    messengerEnabled: boolean;
    instagramEnabled: boolean;
    publicBaseUrl: string | null;
    pageId: string | null;
    instagramBusinessAccountId: string | null;
    appId: string | null;
    verifyToken: null;
    appSecret: null;
    pageAccessToken: null;
    messengerPageAccessToken: null;
    instagramAccessToken: null;
  };
  status: {
    driver: string;
    enabled: boolean;
    webhookInboundReady: boolean;
    signatureValidationReady: boolean;
    webhookVerificationReady: boolean;
  };
};

export type WhatsappQrChannelSettingsView = {
  config: {
    enabled: boolean;
    displayName: string;
    address: string | null;
    autoStart: boolean;
    typingIndicatorEnabled: boolean;
    presenceIndicatorEnabled: boolean;
    humanDelayEnabled: boolean;
    minReplyDelayMs: number;
    maxReplyDelayMs: number;
    maxOutboundPerHour: number;
    maxOutboundPerDay: number;
    allowProactiveOutbound: boolean;
  };
  status: {
    enabled: boolean;
    state: string;
    driver: string;
    connectedPhone: string | null;
    lastError: string | null;
  };
};

export type EmailChannelSettingsView = {
  source: 'environment' | 'database';
  updatedAt: string | null;
  imapHost: string;
  imapPort: number;
  imapSecurity: 'SSL_TLS' | 'STARTTLS' | 'NONE';
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: 'SSL_TLS' | 'STARTTLS' | 'NONE';
  username: string;
  fromAddress: string;
  fromName: string | null;
  maxAttachmentSizeMb: number;
  ratePerMinute: number;
  pollIntervalMs: number;
  pollBatchSize: number;
  passwordSet: boolean;
};

export type CriticalConfigVersion = {
  id: string;
  key:
    | 'ai_runtime'
    | 'learning'
    | 'async_intake'
    | 'tenant_capabilities'
    | 'channel_control';
  version: number;
  status: ManagedResourceStatus;
  value:
    | AiRuntimeResource
    | LearningRuntimeResource
    | AsyncIntakeRuntimeResource
    | TenantCapabilitiesResource
    | Record<string, unknown>;
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

export type DocumentKnowledgeProvenance = {
  documentId: string;
  documentTitle: string;
  sourceName?: string | null;
  originKind: DocumentOriginKind;
  chunkSequence: number;
  section?: string;
  page?: number;
  sheet?: string;
  evidenceTextSpan: string;
};

export type DocumentKnowledgeScopedValue = {
  axis: string;
  value: string;
  normalizedValue?: string;
};

export type DocumentKnowledgePropositionScope = {
  axis: string;
  value: string;
  normalizedValue?: string;
  relation?: string;
};

export type DocumentKnowledgeClaimView = {
  axis: string;
  layer: 'factual';
  supportClass: 'explicit_fact' | 'partial_fact' | 'bounded_inference';
  extractionScope?: 'core_universal' | 'domain_profile' | 'tenant_only';
  subject?: DocumentKnowledgeScopedValue;
  appliesTo: DocumentKnowledgeScopedValue[];
  values: string[];
  unspecifiedAxes: string[];
  provenance: DocumentKnowledgeProvenance[];
};

export type DocumentKnowledgeMetadataView = {
  axis: string;
  layer: 'prudence' | 'workflow' | 'guidance';
  supportClass: 'explicit_fact' | 'partial_fact' | 'bounded_inference';
  extractionScope?: 'core_universal' | 'domain_profile' | 'tenant_only';
  subject?: DocumentKnowledgeScopedValue;
  appliesTo: DocumentKnowledgeScopedValue[];
  values: string[];
  unspecifiedAxes: string[];
  provenance: DocumentKnowledgeProvenance[];
};

export type DocumentKnowledgeEntityView = {
  label: string;
  extractionScope?: 'core_universal' | 'domain_profile' | 'tenant_only';
  values: string[];
  provenance: DocumentKnowledgeProvenance[];
};

export type DocumentKnowledgePropositionView = {
  predicate: string;
  facet?: string;
  layer?: 'factual' | 'prudence' | 'workflow' | 'guidance';
  supportClass: 'explicit_fact' | 'partial_fact' | 'bounded_inference';
  evidenceTier: 'typed_claim' | 'normalized_proposition' | 'excerpt_only';
  polarity: 'affirmed' | 'negated' | 'conditional' | 'comparative' | 'unknown';
  confidence: number;
  extractionScope?: 'core_universal' | 'domain_profile' | 'tenant_only';
  subject?: DocumentKnowledgeScopedValue;
  relationScope: DocumentKnowledgePropositionScope[];
  objectValue: string;
  objectNormalizedValue?: string;
  canonicalKey: string;
  patternKey: string;
  promotionState: 'unclassified' | 'candidate' | 'promoted' | 'rejected';
  promotedAxis?: string;
  promotedFacet?: string;
  provenance: DocumentKnowledgeProvenance[];
};

export type DocumentKnowledgePromotionCandidate = {
  patternKey: string;
  predicate: string;
  facet?: string;
  layer?: 'factual' | 'prudence' | 'workflow' | 'guidance';
  profileKey?: string;
  promotionState: 'unclassified' | 'candidate' | 'promoted' | 'rejected';
  promotedAxis?: string;
  promotedFacet?: string;
  occurrenceCount: number;
  documentCount: number;
  averageConfidence: number;
  supportClasses: Array<'explicit_fact' | 'partial_fact' | 'bounded_inference'>;
  polarities: Array<'affirmed' | 'negated' | 'conditional' | 'comparative' | 'unknown'>;
  evidenceTiers: Array<'typed_claim' | 'normalized_proposition' | 'excerpt_only'>;
  subjects: DocumentKnowledgeScopedValue[];
  exampleValues: string[];
  examples: Array<{
    documentId: string;
    documentTitle: string;
    documentUpdatedAt: string;
    evidenceTextSpan: string;
    objectValue: string;
    objectNormalizedValue?: string;
    confidence: number;
    subject?: DocumentKnowledgeScopedValue;
    relationScope: DocumentKnowledgePropositionScope[];
  }>;
};

export type DocumentKnowledgeView = {
  scope: 'active_corpus' | 'document';
  generatedAt: string;
  documents: Array<{
    id: string;
    title: string;
    status: ManagedResourceStatus;
    ingestionStatus: DocumentIngestionStatus;
    language?: string | null;
    sourceName?: string | null;
    updatedAt: string;
  }>;
  counts: {
    documentCount: number;
    chunkCount: number;
    claimCount: number;
    propositionCount: number;
    entityCount: number;
  };
  support: {
    topics: string[];
    supportedAxes: string[];
    unspecifiedAxes: string[];
  };
  extractionProfiles: Array<{
    profileId: string;
    locale: string;
    tenantDerivedApplied: boolean;
    derivedHints: {
      observedSections?: string[];
      observedAxes?: string[];
      observedValuesByAxis?: Record<string, string[]>;
      supportCounts?: {
        explicit?: number;
        partial?: number;
        boundedInference?: number;
      };
    } | null;
    derivedFromDocuments: Array<{
      documentId: string;
      title: string;
      updatedAt: string;
    }>;
    sources: {
      axes: Record<string, 'platform_default' | 'tenant_derived' | 'mixed'>;
      matchingHints: Record<string, 'platform_default' | 'tenant_derived' | 'mixed'>;
      derivedHints: 'platform_default' | 'tenant_derived' | 'mixed';
    };
  }>;
  overviewLines: string[];
  claims: DocumentKnowledgeClaimView[];
  prudenceNotes: DocumentKnowledgeMetadataView[];
  workflowNotes: DocumentKnowledgeMetadataView[];
  guidanceNotes: DocumentKnowledgeMetadataView[];
  propositions: DocumentKnowledgePropositionView[];
  entities: DocumentKnowledgeEntityView[];
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
  evaluation?: TestCenterConversationEvaluation | null;
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
  evaluation?: TestCenterConversationEvaluation | null;
};

export type TestCenterScenario = {
  id: string;
  label: string;
  description: string;
  locale: string;
  sourceKind: 'curated' | 'derived';
  category: 'supported_information' | 'unsupported_information' | 'edge_case';
  tags: string[];
  documentTitle?: string | null;
  documentId?: string | null;
  turns: Array<{
    message: string;
    locale?: string;
  }>;
};

export type TestCenterTurnEvaluation = {
  turnIndex: number;
  traceId?: string | null;
  userMessage: string;
  assistantMessage: string;
  overallScore: number;
  correctnessScore: number;
  coherenceScore: number;
  fluencyScore: number;
  writingQualityScore: number;
  status: 'pass' | 'warn' | 'fail';
  issues: string[];
  matchedSignals: string[];
};

export type TestCenterConversationEvaluation = {
  scenarioId?: string | null;
  scenarioLabel: string;
  scenarioSourceKind: 'curated' | 'derived';
  locale?: string | null;
  overallScore: number;
  correctnessScore: number;
  coherenceScore: number;
  fluencyScore: number;
  writingQualityScore: number;
  status: 'pass' | 'warn' | 'fail';
  summaryLines: string[];
  turns: TestCenterTurnEvaluation[];
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
  scenario?: TestCenterScenario | null;
  evaluation?: TestCenterConversationEvaluation | null;
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
  typingActive: boolean;
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
    typingActive: boolean;
    typingExpiresAt: string | null;
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

export type AsyncChatTypingResponse = {
  conversationId: string;
  typingActive: boolean;
  typingExpiresAt: string | null;
  presence: AsyncChatSessionView['presence'];
};

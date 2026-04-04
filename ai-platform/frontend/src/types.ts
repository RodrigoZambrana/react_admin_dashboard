export type ManagedResourceStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type ConversationSummary = {
  id: string;
  language: string | null;
  updatedAt?: string;
  messages?: Array<{
    id: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    content: string;
  }>;
};

export type ChatLog = {
  id: string;
  traceId: string;
  stage: string;
  status: string;
  createdAt: string;
  payload: Record<string, unknown>;
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

export type CriticalConfigVersion = {
  id: string;
  key: 'ai_runtime' | 'learning';
  version: number;
  status: ManagedResourceStatus;
  value: AiRuntimeResource | LearningRuntimeResource;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  createdBy?: string | null;
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

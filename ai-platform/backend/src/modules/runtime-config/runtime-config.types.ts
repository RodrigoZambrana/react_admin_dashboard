export type AiProvider = 'mock' | 'openai';

export type AiGatewayConfig = {
  provider: AiProvider;
  apiKey: string | null;
  model: string;
  timeoutMs: number;
  source: 'env';
};

export type PromptTemplateConfig = {
  key: 'interpretation' | 'response';
  template: string;
  source: 'code';
};

export type TenantRuntimeConfig = {
  tenantId: string | null;
  source: 'env';
  authMode: 'open';
};

export type SecurityPreparationConfig = {
  apiAuthMode: 'open';
  futureApiAuthMode: 'bearer';
  futureAdminGuard: 'AdminOnlyGuard';
  adminOnlyEndpoints: string[];
  apiKeyStorage: {
    current: 'env';
    future: 'database';
  };
};

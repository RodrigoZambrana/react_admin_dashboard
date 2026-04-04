export type AiProvider = string;

export type ResolvedAiRuntimeCredentials =
  | {
      strategy: 'none';
      envKey: null;
      value: null;
    }
  | {
      strategy: 'env';
      envKey: string | null;
      value: string | null;
    };

export type AiGatewayConfig = {
  provider: AiProvider;
  model: string;
  timeoutMs: number;
  credentials: ResolvedAiRuntimeCredentials;
  providerOptions: Record<string, unknown>;
  source:
    | {
        type: 'managed';
        key: 'ai_runtime';
        version: number | null;
      }
    | {
        type: 'fallback';
        reason: 'missing_managed_resource';
      };
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

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

export type AiRuntimeDiagnosticIssue = {
  code:
    | 'missing_managed_resource'
    | 'provider_not_registered'
    | 'missing_env_key'
    | 'missing_credentials'
    | 'invalid_timeout';
  severity: 'error' | 'warning';
  message: string;
};

export type AiRuntimeDiagnostics = {
  provider: string;
  model: string | null;
  timeoutMs: number | null;
  source: AiGatewayConfig['source'];
  status: 'ready' | 'invalid' | 'fallback';
  canUseRuntime: boolean;
  providerRegistered: boolean;
  supportedProviders: string[];
  credentials: {
    strategy: ResolvedAiRuntimeCredentials['strategy'];
    envKey: string | null;
    resolved: boolean;
  };
  issues: AiRuntimeDiagnosticIssue[];
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

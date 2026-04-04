import type {
  ChatLog,
  ConversationSummary,
  CriticalConfigVersion,
  KnowledgeMetadataVersion,
  PromptVersion,
  ResponseFallbackVersion,
  TemporalLocaleVersion,
} from './types';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4100';
const tenantId = import.meta.env.VITE_TENANT_ID ?? 'demo-tenant';

type JsonBody = Record<string, unknown> | Array<unknown>;
type ApiRequestInit = Omit<RequestInit, 'body'> & {
  body?: BodyInit | JsonBody | null;
};

export async function apiRequest<T>(
  path: string,
  init?: ApiRequestInit,
): Promise<T> {
  const isJsonBody =
    init?.body !== undefined &&
    init.body !== null &&
    typeof init.body !== 'string' &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof URLSearchParams) &&
    !(init.body instanceof Blob) &&
    !(init.body instanceof ArrayBuffer);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Accept: 'application/json',
      'content-type': isJsonBody ? 'application/json' : 'application/json',
      'x-tenant-id': tenantId,
      ...(init?.headers ?? {}),
    },
    ...init,
    body: isJsonBody ? JSON.stringify(init.body) : (init?.body as BodyInit | null),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function listConversations(limit = 8) {
  return apiRequest<ConversationSummary[]>(`/conversations?limit=${limit}`);
}

export async function listLogs(limit = 30) {
  return apiRequest<ChatLog[]>(`/logs?limit=${limit}`);
}

export async function listPromptVersions() {
  return apiRequest<PromptVersion[]>('/admin/runtime-resources/prompts');
}

export async function listActivePrompts() {
  return apiRequest<PromptVersion[]>('/admin/runtime-resources/prompts/active');
}

export async function createPromptVersion(input: {
  key: string;
  template: string;
  createdBy?: string;
  activate?: boolean;
}) {
  return apiRequest<PromptVersion>('/admin/runtime-resources/prompts', {
    method: 'POST',
    body: input,
  });
}

export async function activatePromptVersion(versionId: string, createdBy = 'admin-ui') {
  return apiRequest<PromptVersion>(
    `/admin/runtime-resources/prompts/${versionId}/activate`,
    {
      method: 'POST',
      body: {
        createdBy,
      },
    },
  );
}

export async function listDateTimeLocaleVersions() {
  return apiRequest<TemporalLocaleVersion[]>(
    '/admin/runtime-resources/temporal-locales',
  );
}

export async function listActiveDateTimeLocales() {
  return apiRequest<TemporalLocaleVersion[]>(
    '/admin/runtime-resources/temporal-locales/active',
  );
}

export async function createDateTimeLocaleVersion(input: {
  locale: string;
  resource: TemporalLocaleVersion['resource'];
  createdBy?: string;
  activate?: boolean;
}) {
  return apiRequest<TemporalLocaleVersion>(
    '/admin/runtime-resources/temporal-locales',
    {
      method: 'POST',
      body: input,
    },
  );
}

export async function activateDateTimeLocaleVersion(
  versionId: string,
  createdBy = 'admin-ui',
) {
  return apiRequest<TemporalLocaleVersion>(
    `/admin/runtime-resources/temporal-locales/${versionId}/activate`,
    {
      method: 'POST',
      body: {
        createdBy,
      },
    },
  );
}

export async function listCriticalConfigVersions() {
  return apiRequest<CriticalConfigVersion[]>(
    '/admin/runtime-resources/critical-configs',
  );
}

export async function listActiveCriticalConfigs() {
  return apiRequest<CriticalConfigVersion[]>(
    '/admin/runtime-resources/critical-configs/active',
  );
}

export async function listResponseFallbackVersions() {
  return apiRequest<ResponseFallbackVersion[]>(
    '/admin/runtime-resources/response-fallbacks',
  );
}

export async function listActiveResponseFallbacks() {
  return apiRequest<ResponseFallbackVersion[]>(
    '/admin/runtime-resources/response-fallbacks/active',
  );
}

export async function listKnowledgeMetadataVersions() {
  return apiRequest<KnowledgeMetadataVersion[]>(
    '/admin/runtime-resources/knowledge-metadata',
  );
}

export async function listActiveKnowledgeMetadata() {
  return apiRequest<KnowledgeMetadataVersion[]>(
    '/admin/runtime-resources/knowledge-metadata/active',
  );
}

import { RuntimeConfigService } from '../src/modules/runtime-config/runtime-config.service';

describe('RuntimeConfigService', () => {
  it('resolves AI runtime config from governed managed resources through a provider-agnostic contract', async () => {
    const service = new RuntimeConfigService(
      {
        get: jest.fn((key: string) =>
          key === 'ANTHROPIC_API_KEY' ? 'secret-token' : undefined,
        ),
      } as any,
      {
        getActiveConfig: jest.fn(async () => ({
          version: 4,
          value: {
            provider: 'openai',
            model: 'gpt-4.1-mini',
            timeoutMs: 7000,
            credentials: {
              strategy: 'env',
              envKey: 'ANTHROPIC_API_KEY',
            },
            providerOptions: {
              baseUrl: 'https://provider.internal/v1',
            },
          },
        })),
      } as any,
    );

    await expect(service.getAiGatewayConfig()).resolves.toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      timeoutMs: 7000,
      credentials: {
        strategy: 'env',
        envKey: 'ANTHROPIC_API_KEY',
        value: 'secret-token',
      },
      providerOptions: {
        baseUrl: 'https://provider.internal/v1',
      },
      source: {
        type: 'managed',
        key: 'ai_runtime',
        version: 4,
      },
    });
  });

  it('uses exploratory OpenAI defaults when OPENAI_API_KEY is present and no governed config exists', async () => {
    const service = new RuntimeConfigService(
      {
        get: jest.fn((key: string) =>
          key === 'OPENAI_API_KEY' ? 'real-openai-key' : undefined,
        ),
      } as any,
      {
        getActiveConfig: jest.fn(async () => null),
      } as any,
    );

    await expect(service.getAiGatewayConfig()).resolves.toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      timeoutMs: 7000,
      credentials: {
        strategy: 'env',
        envKey: 'OPENAI_API_KEY',
        value: 'real-openai-key',
      },
      providerOptions: {},
      source: {
        type: 'bootstrap',
        reason: 'env_openai_exploratory_default',
      },
    });
  });

  it('keeps an explicit governed ai_runtime resource above exploratory env defaults', async () => {
    const service = new RuntimeConfigService(
      {
        get: jest.fn((key: string) =>
          key === 'OPENAI_API_KEY' ? 'real-openai-key' : undefined,
        ),
      } as any,
      {
        getActiveConfig: jest.fn(async () => ({
          version: 8,
          value: {
            provider: 'mock',
            model: 'mock-rule-engine',
            timeoutMs: 1000,
            credentials: {
              strategy: 'none',
              envKey: null,
            },
            providerOptions: {},
          },
        })),
      } as any,
    );

    await expect(service.getAiGatewayConfig()).resolves.toEqual({
      provider: 'mock',
      model: 'mock-rule-engine',
      timeoutMs: 1000,
      credentials: {
        strategy: 'none',
        envKey: null,
        value: null,
      },
      providerOptions: {},
      source: {
        type: 'managed',
        key: 'ai_runtime',
        version: 8,
      },
    });
  });

  it('falls back to mock only when no governed config or exploratory OpenAI bootstrap is available', async () => {
    const service = new RuntimeConfigService(
      {
        get: jest.fn(),
      } as any,
      {
        getActiveConfig: jest.fn(async () => null),
      } as any,
    );

    await expect(service.getAiGatewayConfig()).resolves.toEqual({
      provider: 'mock',
      model: 'mock-rule-engine',
      timeoutMs: 1000,
      credentials: {
        strategy: 'none',
        envKey: null,
        value: null,
      },
      providerOptions: {},
      source: {
        type: 'fallback',
        reason: 'missing_managed_resource',
      },
    });
  });
});

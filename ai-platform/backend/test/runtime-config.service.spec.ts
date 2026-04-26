import { RuntimeConfigService } from '../src/modules/runtime-config/runtime-config.service';

describe('RuntimeConfigService', () => {
  it('resolves AI runtime config from governed managed resources through a provider-agnostic contract', async () => {
    const secureConfig = {
      getString: jest.fn(async () => null),
      setString: jest.fn(async () => undefined),
    };
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
      secureConfig as any,
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
    expect(secureConfig.getString).toHaveBeenCalledWith(
      'ai_runtime.openai_api_key',
    );
    expect(secureConfig.setString).toHaveBeenCalledWith(
      'ai_runtime.openai_api_key',
      'secret-token',
    );
  });

  it('uses exploratory OpenAI defaults when OPENAI_API_KEY is present and no governed config exists', async () => {
    const secureConfig = {
      getString: jest.fn(async () => null),
      setString: jest.fn(async () => undefined),
    };
    const service = new RuntimeConfigService(
      {
        get: jest.fn((key: string) =>
          key === 'OPENAI_API_KEY' ? 'real-openai-key' : undefined,
        ),
      } as any,
      {
        getActiveConfig: jest.fn(async () => null),
      } as any,
      secureConfig as any,
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
    expect(secureConfig.getString).toHaveBeenCalledWith(
      'ai_runtime.openai_api_key',
    );
    expect(secureConfig.setString).toHaveBeenCalledWith(
      'ai_runtime.openai_api_key',
      'real-openai-key',
    );
  });

  it('prefers a stored secret over env bootstrap values', async () => {
    const secureConfig = {
      getString: jest.fn(async () => ({ value: 'stored-openai-key' })),
      setString: jest.fn(async () => undefined),
    };
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
            provider: 'openai',
            model: 'gpt-4.1-mini',
            timeoutMs: 7000,
            credentials: {
              strategy: 'env',
              envKey: 'OPENAI_API_KEY',
            },
            providerOptions: {},
          },
        })),
      } as any,
      secureConfig as any,
    );

    await expect(service.getAiGatewayConfig()).resolves.toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      timeoutMs: 7000,
      credentials: {
        strategy: 'env',
        envKey: 'OPENAI_API_KEY',
        value: 'stored-openai-key',
      },
      providerOptions: {},
      source: {
        type: 'managed',
        key: 'ai_runtime',
        version: 8,
      },
    });
    expect(secureConfig.setString).not.toHaveBeenCalled();
  });

  it('returns a bootstrap OpenAI config with unresolved credentials when no key is configured', async () => {
    const secureConfig = {
      getString: jest.fn(async () => null),
      setString: jest.fn(async () => undefined),
    };
    const service = new RuntimeConfigService(
      {
        get: jest.fn(),
      } as any,
      {
        getActiveConfig: jest.fn(async () => null),
      } as any,
      secureConfig as any,
    );

    await expect(service.getAiGatewayConfig()).resolves.toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      timeoutMs: 7000,
      credentials: {
        strategy: 'env',
        envKey: 'OPENAI_API_KEY',
        value: null,
      },
      providerOptions: {},
      source: {
        type: 'bootstrap',
        reason: 'missing_openai_credentials',
      },
    });
    expect(secureConfig.getString).toHaveBeenCalledWith(
      'ai_runtime.openai_api_key',
    );
  });
});

import { AiRuntimeDiagnosticsService } from '../src/modules/runtime-config/ai-runtime-diagnostics.service';

describe('AiRuntimeDiagnosticsService', () => {
  it('reports a ready managed runtime when the provider is registered and credentials resolve', async () => {
    const service = new AiRuntimeDiagnosticsService(
      {
        getAiGatewayConfig: jest.fn(async () => ({
          provider: 'openai',
          model: 'gpt-4.1-mini',
          timeoutMs: 7000,
          credentials: {
            strategy: 'env',
            envKey: 'OPENAI_API_KEY',
            value: 'secret-token',
          },
          providerOptions: {},
          source: {
            type: 'managed',
            key: 'ai_runtime',
            version: 3,
          },
        })),
      } as any,
      {
        listProviderNames: jest.fn(() => ['mock', 'openai']),
        resolve: jest.fn((provider: string) =>
          provider === 'openai' ? { providerName: 'openai' } : null,
        ),
      } as any,
    );

    await expect(service.getDiagnostics()).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        canUseRuntime: true,
        exploratoryReady: true,
        providerRegistered: true,
        credentials: expect.objectContaining({
          envKey: 'OPENAI_API_KEY',
          resolved: true,
        }),
        issues: [],
      }),
    );
  });

  it('reports invalid managed runtime configuration when env credentials are unresolved', async () => {
    const service = new AiRuntimeDiagnosticsService(
      {
        getAiGatewayConfig: jest.fn(async () => ({
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
            type: 'managed',
            key: 'ai_runtime',
            version: 4,
          },
        })),
      } as any,
      {
        listProviderNames: jest.fn(() => ['mock', 'openai']),
        resolve: jest.fn(() => ({ providerName: 'openai' })),
      } as any,
    );

    await expect(service.getDiagnostics()).resolves.toEqual(
      expect.objectContaining({
        status: 'invalid',
        canUseRuntime: false,
        exploratoryReady: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'missing_credentials',
            severity: 'error',
          }),
        ]),
      }),
    );
  });

  it('treats exploratory OpenAI bootstrap as ready when the env key resolves', async () => {
    const service = new AiRuntimeDiagnosticsService(
      {
        getAiGatewayConfig: jest.fn(async () => ({
          provider: 'openai',
          model: 'gpt-4.1-mini',
          timeoutMs: 7000,
          credentials: {
            strategy: 'env',
            envKey: 'OPENAI_API_KEY',
            value: 'secret-token',
          },
          providerOptions: {},
          source: {
            type: 'bootstrap',
            reason: 'env_openai_exploratory_default',
          },
        })),
      } as any,
      {
        listProviderNames: jest.fn(() => ['mock', 'openai']),
        resolve: jest.fn(() => ({ providerName: 'openai' })),
      } as any,
    );

    await expect(service.getDiagnostics()).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        canUseRuntime: true,
        exploratoryReady: true,
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'using_bootstrap_default',
            severity: 'warning',
          }),
        ]),
      }),
    );
  });

  it('treats mock runtime as fallback even when the provider is registered', async () => {
    const service = new AiRuntimeDiagnosticsService(
      {
        getAiGatewayConfig: jest.fn(async () => ({
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
            version: 2,
          },
        })),
      } as any,
      {
        listProviderNames: jest.fn(() => ['mock', 'openai']),
        resolve: jest.fn(() => ({ providerName: 'mock' })),
      } as any,
    );

    await expect(service.getDiagnostics()).resolves.toEqual(
      expect.objectContaining({
        status: 'fallback',
        canUseRuntime: true,
        exploratoryReady: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'mock_runtime_active',
            severity: 'warning',
          }),
        ]),
      }),
    );
  });
});

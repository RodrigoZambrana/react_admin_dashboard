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
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'missing_credentials',
            severity: 'error',
          }),
        ]),
      }),
    );
  });
});

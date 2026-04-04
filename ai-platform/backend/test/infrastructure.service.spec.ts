import { InfrastructureService } from '../src/modules/infrastructure/infrastructure.service';

describe('InfrastructureService', () => {
  it('reports ready when all services, tables, and exploratory AI runtime are available', async () => {
    const service = new InfrastructureService(
      {
        pingDatabase: jest.fn(async () => true),
        listPublicTables: jest.fn(async () => [
          'Conversation',
          'Message',
          'ChatLog',
          'PromptVersion',
          'Knowledge',
        ]),
      } as any,
      {} as any,
      {} as any,
      {
        ping: jest.fn(async () => ({ status: 'ok', detail: 'PONG' })),
      } as any,
      {
        healthCheck: jest.fn(async () => ({ status: 'ok', collections: 0 })),
      } as any,
      {} as any,
      {
        log: jest.fn(),
      } as any,
      {
        getDiagnostics: jest.fn(async () => ({
          provider: 'openai',
          model: 'gpt-4.1-mini',
          source: {
            type: 'bootstrap',
            reason: 'env_openai_exploratory_default',
          },
          status: 'ready',
          canUseRuntime: true,
          exploratoryReady: true,
          issues: [],
        })),
      } as any,
    );

    await expect(service.getReadiness()).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        services: expect.objectContaining({
          aiRuntime: expect.objectContaining({
            status: 'ok',
            exploratoryReady: true,
          }),
        }),
      }),
    );
  });

  it('reports not_ready when infrastructure is healthy but AI runtime is still mock fallback', async () => {
    const service = new InfrastructureService(
      {
        pingDatabase: jest.fn(async () => true),
        listPublicTables: jest.fn(async () => [
          'Conversation',
          'Message',
          'ChatLog',
          'PromptVersion',
          'Knowledge',
        ]),
      } as any,
      {} as any,
      {} as any,
      {
        ping: jest.fn(async () => ({ status: 'ok', detail: 'PONG' })),
      } as any,
      {
        healthCheck: jest.fn(async () => ({ status: 'ok', collections: 0 })),
      } as any,
      {} as any,
      {
        log: jest.fn(),
      } as any,
      {
        getDiagnostics: jest.fn(async () => ({
          provider: 'mock',
          model: 'mock-rule-engine',
          source: {
            type: 'fallback',
            reason: 'missing_managed_resource',
          },
          status: 'fallback',
          canUseRuntime: true,
          exploratoryReady: false,
          issues: [
            {
              code: 'mock_runtime_active',
              severity: 'warning',
              message: 'The active AI runtime is using the mock provider.',
            },
          ],
        })),
      } as any,
    );

    await expect(service.getReadiness()).resolves.toEqual(
      expect.objectContaining({
        status: 'not_ready',
        services: expect.objectContaining({
          aiRuntime: expect.objectContaining({
            status: 'warning',
            exploratoryReady: false,
          }),
        }),
      }),
    );
  });
});

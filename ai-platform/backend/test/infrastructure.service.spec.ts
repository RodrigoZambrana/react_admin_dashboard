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

  it('reports not_ready when infrastructure is healthy but AI runtime has no credential yet', async () => {
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
            reason: 'missing_openai_credentials',
          },
          status: 'invalid',
          canUseRuntime: false,
          exploratoryReady: false,
          issues: [
            {
              code: 'missing_openai_credentials',
              severity: 'warning',
              message:
                'No governed ai_runtime resource is active and no OpenAI credential is currently available in secure storage or env.',
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
            status: 'error',
            exploratoryReady: false,
          }),
        }),
      }),
    );
  });
});

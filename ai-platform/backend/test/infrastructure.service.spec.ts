import { InfrastructureService } from '../src/modules/infrastructure/infrastructure.service';

describe('InfrastructureService', () => {
  it('reports ready when all services and tables are available', async () => {
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
    );

    await expect(service.getReadiness()).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
      }),
    );
  });
});

import { PromptService } from '../src/modules/prompt/prompt.service';

describe('PromptService', () => {
  it('maps active managed prompts into admin-facing response objects', async () => {
    const service = new PromptService(
      {
        listActive: jest.fn(async () => [
          {
            id: 'prompt-1',
            key: 'interpretation',
            value: 'Return JSON only.',
            version: 3,
            status: 'ACTIVE',
            metadata: {
              origin: 'admin',
            },
            createdAt: new Date('2026-04-03T00:00:00.000Z'),
            createdBy: 'admin',
          },
        ]),
      } as any,
      {
        list: jest.fn(async () => []),
      } as any,
      {
        debug: jest.fn(),
        log: jest.fn(),
      } as any,
    );

    await expect(service.listActivePrompts()).resolves.toEqual([
      expect.objectContaining({
        id: 'prompt-1',
        key: 'interpretation',
        template: 'Return JSON only.',
        version: 3,
        status: 'ACTIVE',
      }),
    ]);
  });

  it('filters stored prompt versions by key through the repository boundary', async () => {
    const list = jest.fn(async () => [
      {
        key: 'response',
        version: 1,
      },
    ]);
    const service = new PromptService(
      {
        listActive: jest.fn(async () => []),
      } as any,
      {
        list,
      } as any,
      {
        debug: jest.fn(),
        log: jest.fn(),
      } as any,
    );

    await expect(service.listPrompts('response')).resolves.toEqual([
      expect.objectContaining({
        key: 'response',
      }),
    ]);
    expect(list).toHaveBeenCalledWith('response');
  });
});

import { AdminKnowledgeController } from '../src/modules/api/admin-knowledge.controller';

describe('AdminKnowledgeController', () => {
  it('exposes governed knowledge listing and detail contracts', async () => {
    const service = {
      listKnowledge: jest.fn(async () => [{ id: 'knowledge-1' }]),
      getKnowledge: jest.fn(async () => ({ id: 'knowledge-1' })),
    };
    const controller = new AdminKnowledgeController(service as any);

    await expect(controller.listKnowledge('10', 'BOOKING')).resolves.toEqual([
      { id: 'knowledge-1' },
    ]);
    await expect(controller.getKnowledge('knowledge-1')).resolves.toEqual({
      id: 'knowledge-1',
    });
  });
});

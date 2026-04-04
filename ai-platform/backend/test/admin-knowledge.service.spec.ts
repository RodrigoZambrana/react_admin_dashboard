import { NotFoundException } from '@nestjs/common';

import { AdminKnowledgeService } from '../src/modules/api/admin-knowledge.service';

describe('AdminKnowledgeService', () => {
  it('lists knowledge through the backend knowledge service', async () => {
    const knowledgeService = {
      listKnowledge: jest.fn(async () => [{ id: 'k1' }]),
    };
    const service = new AdminKnowledgeService(knowledgeService as any);

    await expect(
      service.listKnowledge({ limit: 10, category: 'BOOKING' }),
    ).resolves.toEqual([{ id: 'k1' }]);
    expect(knowledgeService.listKnowledge).toHaveBeenCalledWith({
      limit: 10,
      category: 'BOOKING',
    });
  });

  it('fails safely when a knowledge entry is not found', async () => {
    const service = new AdminKnowledgeService({
      getKnowledgeById: jest.fn(async () => null),
    } as any);

    await expect(service.getKnowledge('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

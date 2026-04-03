import { KnowledgeCategory } from '@prisma/client';

import { extractKnowledgeCandidate } from '../src/modules/knowledge/knowledge.extractor';

describe('extractKnowledgeCandidate', () => {
  it('classifies booking tool executions into booking knowledge', () => {
    const candidate = extractKnowledgeCandidate({
      stage: 'execution',
      payload: {
        toolName: 'create_booking',
        output: {
          bookingId: 'bk_123',
          status: 'confirmed',
        },
      },
    });

    expect(candidate).toEqual(
      expect.objectContaining({
        category: KnowledgeCategory.BOOKING,
      }),
    );
  });

  it('ignores unsupported stages', () => {
    expect(
      extractKnowledgeCandidate({
        stage: 'interpretation',
        payload: {},
      }),
    ).toBeNull();
  });
});

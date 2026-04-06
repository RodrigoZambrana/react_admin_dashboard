import { DocumentKnowledgePromotionService } from '../src/modules/documents/document-knowledge-promotion.service';

describe('DocumentKnowledgePromotionService', () => {
  it('aggregates normalized propositions into reusable promotion candidates by pattern key', async () => {
    const repository = {
      listPromotionAnalysisRows: jest.fn().mockResolvedValue([
        {
          patternKey: 'feature_support||negated|subject:section_topic|scopes:',
          predicate: 'feature_support',
          facet: undefined,
          layer: 'factual',
          profileKey: 'product_catalog',
          promotionState: 'unclassified',
          promotedAxis: undefined,
          promotedFacet: undefined,
          supportClass: 'explicit_fact',
          polarity: 'negated',
          evidenceTier: 'normalized_proposition',
          confidence: 0.92,
          subject: {
            axis: 'section_topic',
            value: 'SERIE 25',
            normalizedValue: 'serie 25',
          },
          relationScope: [],
          objectValue: 'DVH',
          objectNormalizedValue: 'dvh',
          evidenceTextSpan: 'No soporta DVH.',
          document: {
            id: 'doc-1',
            title: 'Aberturas',
            updatedAt: '2026-04-06T10:00:00.000Z',
          },
        },
        {
          patternKey: 'feature_support||negated|subject:section_topic|scopes:',
          predicate: 'feature_support',
          facet: undefined,
          layer: 'factual',
          profileKey: 'product_catalog',
          promotionState: 'unclassified',
          promotedAxis: undefined,
          promotedFacet: undefined,
          supportClass: 'explicit_fact',
          polarity: 'negated',
          evidenceTier: 'normalized_proposition',
          confidence: 0.88,
          subject: {
            axis: 'section_topic',
            value: 'SERIE 20',
            normalizedValue: 'serie 20',
          },
          relationScope: [],
          objectValue: 'DVH',
          objectNormalizedValue: 'dvh',
          evidenceTextSpan: 'No soporta DVH.',
          document: {
            id: 'doc-2',
            title: 'Aberturas',
            updatedAt: '2026-04-06T10:05:00.000Z',
          },
        },
      ]),
      markPatternAsCandidate: jest.fn(),
      promotePattern: jest.fn(),
      rejectPattern: jest.fn(),
    };

    const service = new DocumentKnowledgePromotionService(repository as any);
    const candidates = await service.listPromotionCandidates({
      minOccurrences: 2,
      limit: 10,
    });

    expect(repository.listPromotionAnalysisRows).toHaveBeenCalledWith(
      expect.objectContaining({
        promotionStates: ['unclassified', 'candidate'],
        activeOnly: true,
      }),
    );
    expect(candidates).toEqual([
      expect.objectContaining({
        patternKey: 'feature_support||negated|subject:section_topic|scopes:',
        predicate: 'feature_support',
        occurrenceCount: 2,
        documentCount: 2,
        averageConfidence: 0.9,
        exampleValues: ['DVH'],
        subjects: expect.arrayContaining([
          expect.objectContaining({
            value: 'SERIE 25',
          }),
          expect.objectContaining({
            value: 'SERIE 20',
          }),
        ]),
      }),
    ]);
  });
});

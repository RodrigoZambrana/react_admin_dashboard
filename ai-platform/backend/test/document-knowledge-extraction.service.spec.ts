import { DocumentKnowledgeExtractionService } from '../src/modules/documents/document-knowledge-extraction.service';

describe('DocumentKnowledgeExtractionService', () => {
  it('builds semantic chunks with structured claims, entities, and retrieval projections', () => {
    const service = new DocumentKnowledgeExtractionService();

    const chunks = service.buildChunkCandidates({
      sourceText: [
        'CORTINAS DE ENROLLAR',
        '',
        'Disponibles en PVC y aluminio, con opciones manuales o motorizadas.',
        'Variedad de colores.',
        'Ideal para exteriores.',
        '',
        'Tipos: Roller Screen, Roller Blackout y Roller Doble.',
      ].join('\n'),
      originKind: 'TEXT',
      sourceMetadata: {
        sourceName: 'catalogo.txt',
      },
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(
      expect.objectContaining({
        retrievalProjection: expect.stringContaining('pvc'),
        metadata: expect.objectContaining({
          section: 'CORTINAS DE ENROLLAR',
          originKind: 'TEXT',
          supportSummary: expect.objectContaining({
            topic: 'CORTINAS DE ENROLLAR',
            supportedAxes: expect.arrayContaining([
              'materials',
              'operation_modes',
              'color_options',
              'suitability',
              'product_types',
            ]),
            unspecifiedAxes: expect.arrayContaining(['exact_color_options']),
          }),
        }),
        structuredItems: expect.arrayContaining([
          expect.objectContaining({
            kind: 'claim',
            label: 'materials',
            valueText: 'PVC | aluminio',
            supportClass: 'explicit_fact',
            evidenceTextSpan: expect.stringContaining('PVC y aluminio'),
            metadata: expect.objectContaining({
              extractionScope: 'tenant_only',
              claim: expect.objectContaining({
                axis: 'materials',
                kind: 'value_list',
                values: ['PVC', 'aluminio'],
              }),
            }),
          }),
          expect.objectContaining({
            kind: 'entity',
            label: 'material',
            valueText: 'PVC',
            supportClass: 'explicit_fact',
            metadata: expect.objectContaining({
              extractionScope: 'tenant_only',
            }),
          }),
          expect.objectContaining({
            kind: 'claim',
            label: 'operation_modes',
            valueText: 'manuales | motorizadas',
            supportClass: 'explicit_fact',
            metadata: expect.objectContaining({
              extractionScope: 'core',
              claim: expect.objectContaining({
                axis: 'operation_modes',
                kind: 'value_list',
                values: ['manuales', 'motorizadas'],
              }),
            }),
          }),
          expect.objectContaining({
            kind: 'claim',
            label: 'color_options',
            valueText: 'variety',
            supportClass: 'partial_fact',
            metadata: expect.objectContaining({
              extractionScope: 'core',
              unspecifiedAxes: ['exact_color_options'],
              claim: expect.objectContaining({
                axis: 'color_options',
                kind: 'qualifier',
                values: ['variety'],
              }),
            }),
          }),
          expect.objectContaining({
            kind: 'claim',
            label: 'suitability',
            valueText: 'exteriores',
            supportClass: 'bounded_inference',
            evidenceTextSpan: 'Ideal para exteriores.',
            metadata: expect.objectContaining({
              claim: expect.objectContaining({
                axis: 'suitability',
                kind: 'relation_target',
                values: ['exteriores'],
              }),
            }),
          }),
          expect.objectContaining({
            kind: 'claim',
            label: 'product_types',
            valueText: 'Roller Screen | Roller Blackout | Roller Doble',
            supportClass: 'explicit_fact',
          }),
        ]),
      }),
    );
  });
});

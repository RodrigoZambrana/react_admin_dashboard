import {
  buildDocumentCorpusMetadata,
  composeActiveCorpusByLayer,
} from '../src/modules/documents/document-corpus';

describe('document corpus composition', () => {
  it('classifies a document with strong factual and behavioral layers as mixed master', () => {
    const metadata = buildDocumentCorpusMetadata([
      buildChunk({
        documentId: 'doc-master',
        layer: 'factual',
      }),
      buildChunk({
        documentId: 'doc-master',
        layer: 'factual',
      }),
      buildChunk({
        documentId: 'doc-master',
        layer: 'factual',
      }),
      buildChunk({
        documentId: 'doc-master',
        layer: 'factual',
      }),
      buildChunk({
        documentId: 'doc-master',
        layer: 'factual',
      }),
      buildChunk({
        documentId: 'doc-master',
        layer: 'factual',
      }),
      buildChunk({
        documentId: 'doc-master',
        layer: 'workflow',
      }),
      buildChunk({
        documentId: 'doc-master',
        layer: 'workflow',
      }),
      buildChunk({
        documentId: 'doc-master',
        layer: 'guidance',
      }),
      buildChunk({
        documentId: 'doc-master',
        layer: 'guidance',
      }),
    ]);

    expect(metadata).toEqual(
      expect.objectContaining({
        documentRole: 'mixed_master',
        documentLayers: expect.arrayContaining([
          'factual',
          'workflow',
          'guidance',
        ]),
      }),
    );
  });

  it('composes active corpus by layer so a newer guide does not replace factual master chunks', () => {
    const composition = composeActiveCorpusByLayer([
      buildChunk({
        documentId: 'doc-master',
        updatedAt: '2026-04-05T18:00:00.000Z',
        metadata: {
          documentRole: 'factual_master',
          documentLayers: ['factual'],
        },
        layer: 'factual',
      }),
      buildChunk({
        documentId: 'doc-guide',
        updatedAt: '2026-04-05T20:00:00.000Z',
        metadata: {
          documentRole: 'operational_guide',
          documentLayers: ['workflow', 'guidance'],
        },
        layer: 'workflow',
      }),
    ]);

    expect(composition.authoritativeDocumentsByLayer.factual?.id).toBe('doc-master');
    expect(composition.authoritativeDocumentsByLayer.workflow?.id).toBe('doc-guide');
    expect(composition.chunks.map((chunk) => chunk.documentId)).toEqual([
      'doc-master',
      'doc-guide',
    ]);
  });

  it('uses date precedence when two active documents share the same role for a layer', () => {
    const composition = composeActiveCorpusByLayer([
      buildChunk({
        documentId: 'doc-old',
        updatedAt: '2026-04-05T18:00:00.000Z',
        metadata: {
          documentRole: 'factual_master',
          documentLayers: ['factual'],
        },
        layer: 'factual',
      }),
      buildChunk({
        documentId: 'doc-new',
        updatedAt: '2026-04-05T20:00:00.000Z',
        metadata: {
          documentRole: 'factual_master',
          documentLayers: ['factual'],
        },
        layer: 'factual',
      }),
    ]);

    expect(composition.authoritativeDocumentsByLayer.factual?.id).toBe('doc-new');
    expect(composition.chunks.map((chunk) => chunk.documentId)).toEqual(['doc-new']);
  });
});

function buildChunk(input: {
  documentId: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  layer: 'factual' | 'workflow' | 'guidance' | 'prudence';
}) {
  return {
    documentId: input.documentId,
    sequence: 0,
    metadata: {
      usageBoundary: input.layer === 'factual' ? 'knowledge' : 'operational',
    },
    knowledgeItems: [
      {
        kind: 'CLAIM',
        metadata: {
          claim: {
            axis: input.layer === 'factual' ? 'materials' : `${input.layer}_axis`,
            kind: 'value_list',
            layer: input.layer,
            values: ['value'],
          },
        },
      },
    ],
    document: {
      id: input.documentId,
      title: input.documentId,
      status: 'ACTIVE',
      ingestionStatus: 'READY',
      language: 'es',
      sourceName: `${input.documentId}.txt`,
      metadata: input.metadata,
      updatedAt: input.updatedAt ?? '2026-04-05T18:00:00.000Z',
    },
  };
}

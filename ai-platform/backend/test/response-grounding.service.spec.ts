import { ResponseGroundingService } from '../src/modules/response/response-grounding.service';

describe('ResponseGroundingService', () => {
  const service = new ResponseGroundingService();

  it('marks general document color evidence as partial when exact options are requested', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: '¿Qué colores exactos tiene esta línea?',
      documentContext: {
        source: 'document_origin',
        query: 'colores exactos',
        groundedSummary: 'El documento indica una variedad de colores para esta línea.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt: 'Disponible en una variedad de colores.',
            sequence: 0,
            score: 3.4,
          },
        ],
      },
    });

    expect(assessment).toEqual(
      expect.objectContaining({
        supportLevel: 'partial',
        exactnessRequested: true,
        partialDetailTypes: ['color_options'],
      }),
    );
  });

  it('marks unsupported commercial detail requests when the approved context does not back them', () => {
    const assessment = service.assessDocumentContext({
      locale: 'en',
      userMessage: 'How much does it cost and where can I buy it?',
      documentContext: {
        source: 'document_origin',
        query: 'cost and purchase info',
        groundedSummary: 'The document describes light filtering and privacy benefits.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catalog',
            excerpt: 'It filters light and improves privacy.',
            sequence: 0,
            score: 2.7,
          },
        ],
      },
    });

    expect(assessment.unsupportedDetailTypes).toEqual(
      expect.arrayContaining(['pricing', 'purchase_channel']),
    );
  });

  it('marks missing approved evidence as unavailable instead of pretending support exists', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: '¿Qué tipos tienen de cortinas de enrollar?',
      documentContext: {
        source: 'document_origin',
        query: 'tipos de cortinas de enrollar',
        groundedSummary: '',
        matches: [],
      },
    });

    expect(assessment).toEqual(
      expect.objectContaining({
        supportLevel: 'unavailable',
      }),
    );
  });

  it('marks unsupported coverage questions when the approved document context does not confirm coverage', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: '¿El documento dice si cubren cambio de cadena?',
      documentContext: {
        source: 'document_origin',
        query: 'cobertura cambio de cadena',
        groundedSummary: 'El documento describe cortinas roller y sus características.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt: 'Describe cortinas roller y sus características.',
            sequence: 0,
            score: 2.1,
          },
        ],
      },
    });

    expect(assessment.unsupportedDetailTypes).toContain('coverage_support');
  });

  it('builds a concise unspecified-detail clause for partial document grounding', () => {
    const clause = service.buildUnspecifiedDetailClause({
      locale: 'es',
      documentContext: {
        source: 'document_origin',
        query: 'colores exactos',
        groundedSummary: 'Variedad de colores.',
        responseMode: 'document_exploration',
        grounding: {
          supportLevel: 'partial',
          exactnessRequested: true,
          requestedDetailTypes: ['color_options'],
          supportedDetailTypes: [],
          partialDetailTypes: ['color_options'],
          unsupportedDetailTypes: [],
        },
        matches: [],
      },
    } as any);

    expect(clause).toBe('No especifica los colores exactos.');
  });

  it('recognizes natural unspecified-detail phrasing with reflexive wording', () => {
    expect(
      service.containsUnspecifiedCue({
        locale: 'es',
        message: 'No se especifica en el documento si cubren ese servicio.',
      }),
    ).toBe(true);
  });

  it('recognizes close-turn reopen cues that should fall back to a shorter acknowledgment', () => {
    expect(
      service.containsCloseTurnReopenCue({
        locale: 'es',
        message:
          'Gracias a ti por tu mensaje. Quedo a tu disposición para cualquier otra consulta.',
      }),
    ).toBe(true);
  });

  it('flags document overreach from sentences with weak grounded overlap instead of relying on inline stopword buckets', () => {
    expect(
      service.hasDocumentContextOverreach({
        approvedContext: {
          locale: 'es',
          userMessage: 'Quiero algo con privacidad y luz natural.',
          documentContext: {
            source: 'document_origin',
            query: 'privacidad y luz natural',
            groundedSummary:
              'La tela screen permite el paso de luz y mejora la privacidad.',
            responseMode: 'document_exploration',
            grounding: {
              supportLevel: 'explicit',
              exactnessRequested: false,
              requestedDetailTypes: [],
              supportedDetailTypes: [],
              partialDetailTypes: [],
              unsupportedDetailTypes: [],
            },
            matches: [
              {
                documentId: 'doc-1',
                title: 'Catálogo',
                excerpt:
                  'La tela screen permite el paso de luz y mejora la privacidad.',
                sequence: 0,
                score: 4.1,
              },
            ],
          },
        } as any,
        approvedDraft:
          'La tela screen permite el paso de luz y mejora la privacidad.',
        message:
          'Podrías ir por paneles japoneses, lino liviano o shades dobles para lograr ese efecto.',
      }),
    ).toBe(true);
  });

  it('does not flag grounded document synthesis when the reply stays close to approved context', () => {
    expect(
      service.hasDocumentContextOverreach({
        approvedContext: {
          locale: 'es',
          userMessage: 'Quiero algo con privacidad y luz natural.',
          documentContext: {
            source: 'document_origin',
            query: 'privacidad y luz natural',
            groundedSummary:
              'La tela screen permite el paso de luz y mejora la privacidad.',
            responseMode: 'document_exploration',
            grounding: {
              supportLevel: 'explicit',
              exactnessRequested: false,
              requestedDetailTypes: [],
              supportedDetailTypes: [],
              partialDetailTypes: [],
              unsupportedDetailTypes: [],
            },
            matches: [
              {
                documentId: 'doc-1',
                title: 'Catálogo',
                excerpt:
                  'La tela screen permite el paso de luz y mejora la privacidad.',
                sequence: 0,
                score: 4.1,
              },
            ],
          },
        } as any,
        approvedDraft:
          'La tela screen permite el paso de luz y mejora la privacidad.',
        message:
          'La tela screen permite el paso de luz y mejora la privacidad para ese uso.',
      }),
    ).toBe(false);
  });
});

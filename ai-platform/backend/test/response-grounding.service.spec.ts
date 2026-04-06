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

  it('qualifies partial color questions with an unspecified-detail requirement even without the word exact when the user asks as a concrete question', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: '¿Qué colores tienen las blackout?',
      documentContext: {
        source: 'document_origin',
        query: 'blackout colores',
        groundedSummary: 'El documento menciona variedad de colores para esta línea.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt: 'Disponible en una variedad de colores.',
            sequence: 0,
            score: 3.1,
          },
        ],
      },
    });

    expect(assessment).toEqual(
      expect.objectContaining({
        supportLevel: 'partial',
        partialDetailTypes: ['color_options'],
        requiredUnspecifiedDetailTypes: ['color_options'],
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

  it('treats visit-cost questions as structurally supported when the document exposes visit cost axes', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'dentro de montevideo la visita tiene costo?',
      documentContext: {
        source: 'document_origin',
        query: 'visita montevideo costo',
        groundedSummary:
          'Las visitas dentro de Montevideo son sin costo. Fuera de Montevideo puede corresponder costo de traslado.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt:
              'Las visitas dentro de Montevideo son sin costo. Fuera de Montevideo puede corresponder costo de traslado.',
            sequence: 0,
            score: 4.4,
            supportSummary: {
              topic: 'VISITAS, RECTIFICACION Y MUESTRAS',
              supportedAxes: ['commercial_visit_cost', 'travel_cost_responsibility'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'commercial_visit_cost',
                  values: ['sin costo'],
                  supportClass: 'explicit_fact',
                  appliesTo: [
                    {
                      axis: 'location',
                      value: 'Montevideo',
                      normalizedValue: 'montevideo',
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment).toEqual(
      expect.objectContaining({
        supportLevel: 'explicit',
        supportedDetailTypes: ['pricing'],
      }),
    );
  });

  it('treats warranty questions as structurally supported when warranty claims are present', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'que garantia tienen las cortinas de enrollar?',
      documentContext: {
        source: 'document_origin',
        query: 'garantía cortinas de enrollar',
        groundedSummary:
          'La garantía depende del producto. En varias líneas de aluminio y roller trabajamos con 2 años, y en distintas opciones de PVC la referencia habitual es 1 año.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt:
              'La garantía depende del producto. En varias líneas de aluminio y roller trabajamos con 2 años, y en distintas opciones de PVC la referencia habitual es 1 año.',
            sequence: 0,
            score: 4.1,
            supportSummary: {
              topic: 'GARANTIAS',
              supportedAxes: ['warranty_terms'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'warranty_terms',
                  values: ['2 años', '1 año'],
                  supportClass: 'explicit_fact',
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment).toEqual(
      expect.objectContaining({
        supportLevel: 'explicit',
        requestedDetailTypes: ['warranty'],
        supportedDetailTypes: ['warranty'],
      }),
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

  it('does not infer a requested material-detail axis only because the grounded summary mentions telas or materials', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'hacen cortinas roller a medida?',
      documentContext: {
        source: 'document_origin',
        query: 'cortinas roller a medida',
        groundedSummary:
          'Roller Screen, Roller Blackout y Roller Doble, que combina una tela screen y una tela blackout en una misma instalación.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt:
              'Roller Doble combina una tela screen y una tela blackout en una misma instalación.',
            sequence: 0,
            score: 3.4,
            supportSummary: {
              topic: 'cortinas roller',
              supportedAxes: ['product_types'],
              unspecifiedAxes: ['materials'],
            },
          },
        ],
      },
    });

    expect(assessment).toEqual(
      expect.objectContaining({
        supportLevel: 'explicit',
        requestedDetailTypes: [],
        partialDetailTypes: [],
        unsupportedDetailTypes: [],
      }),
    );
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

    expect(clause).toBe(
      'Por ahora no tengo confirmación sobre los colores exactos.',
    );
  });

  it('omits the unspecified-detail clause when the summary already includes the concrete grounded values', () => {
    const clause = service.buildUnspecifiedDetailClause({
      locale: 'es',
      summary: 'Las cortinas de enrollar en aluminio están disponibles en blanco, negro y gris.',
      documentContext: {
        source: 'document_origin',
        query: 'colores aluminio',
        groundedSummary: 'Variedad de colores.',
        responseMode: 'document_exploration',
        grounding: {
          supportLevel: 'partial',
          exactnessRequested: true,
          requestedDetailTypes: ['color_options'],
          supportedDetailTypes: [],
          partialDetailTypes: ['color_options'],
          unsupportedDetailTypes: [],
          requiredUnspecifiedDetailTypes: ['color_options'],
        },
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt: 'Disponible en variedad de colores.',
            sequence: 0,
            score: 4.2,
            supportSummary: {
              topic: 'cortinas de enrollar en aluminio',
              supportedAxes: ['color_options'],
              unspecifiedAxes: ['exact_color_options'],
              axisSummaries: [
                {
                  axis: 'color_options',
                  values: ['blanco', 'negro', 'gris'],
                  supportClass: 'explicit_fact',
                  appliesTo: [
                    {
                      axis: 'material',
                      value: 'aluminio',
                      normalizedValue: 'aluminio',
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    } as any);

    expect(clause).toBeNull();
  });

  it('detects when a grounded summary does not address the requested detail axis', () => {
    expect(
      service.summaryAddressesRequestedDetails({
        locale: 'es',
        summary: 'Roller Screen, Roller Blackout, Roller Doble',
        detailTypes: ['color_options'],
      }),
    ).toBe(false);
  });

  it('derives material detail support from structured document claims instead of hardcoded material vocabularies', () => {
    const detailTypes = service.extractClaimedDetailTypes({
      locale: 'es',
      message: 'Vienen en PVC y aluminio.',
      documentContext: {
        source: 'document_origin',
        query: 'materiales enrollar',
        groundedSummary: 'materiales: PVC, aluminio',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt: 'Disponibles en PVC y aluminio.',
            sequence: 0,
            score: 3.8,
            supportSummary: {
              topic: 'cortinas de enrollar',
              supportedAxes: ['materials'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'materials',
                  values: ['PVC', 'aluminio'],
                  supportClass: 'explicit_fact',
                  extractionScope: 'tenant_only',
                },
              ],
            },
          },
        ],
      },
    });

    expect(detailTypes).toContain('materials');
  });

  it('recognizes natural unspecified-detail phrasing with reflexive wording', () => {
    expect(
      service.containsUnspecifiedCue({
        locale: 'es',
        message: 'No se especifica en el documento si cubren ese servicio.',
      }),
    ).toBe(true);
  });

  it('recognizes natural unspecified-detail phrasing with confirmation wording', () => {
    expect(
      service.containsUnspecifiedCue({
        locale: 'es',
        message: 'Por ahora no tengo confirmación sobre los colores exactos.',
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

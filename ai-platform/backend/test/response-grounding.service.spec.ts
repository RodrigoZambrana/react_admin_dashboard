import { ResponseGroundingService } from '../src/modules/response/response-grounding.service';

describe('ResponseGroundingService', () => {
  const service = new ResponseGroundingService();
  const buildGrounding = (
    overrides: Partial<{
      supportLevel: 'explicit' | 'partial' | 'unavailable';
      evidenceTier:
        | 'typed_claim'
        | 'normalized_proposition'
        | 'excerpt_only'
        | 'none';
      absenceReason: 'document_gap' | 'extraction_uncertain' | null;
      exactnessRequested: boolean;
      requestedDetailTypes: Array<
        | 'coverage_support'
        | 'pricing'
        | 'payment_terms'
        | 'purchase_channel'
        | 'service_capability'
        | 'quote_requirements'
        | 'recommendation'
        | 'availability'
        | 'warranty'
        | 'materials'
        | 'color_options'
        | 'specific_variants'
        | 'feature_support'
      >;
      supportedDetailTypes: Array<
        | 'coverage_support'
        | 'pricing'
        | 'payment_terms'
        | 'purchase_channel'
        | 'service_capability'
        | 'quote_requirements'
        | 'recommendation'
        | 'availability'
        | 'warranty'
        | 'materials'
        | 'color_options'
        | 'specific_variants'
        | 'feature_support'
      >;
      partialDetailTypes: Array<
        | 'coverage_support'
        | 'pricing'
        | 'payment_terms'
        | 'purchase_channel'
        | 'service_capability'
        | 'quote_requirements'
        | 'recommendation'
        | 'availability'
        | 'warranty'
        | 'materials'
        | 'color_options'
        | 'specific_variants'
        | 'feature_support'
      >;
      unsupportedDetailTypes: Array<
        | 'coverage_support'
        | 'pricing'
        | 'payment_terms'
        | 'purchase_channel'
        | 'service_capability'
        | 'quote_requirements'
        | 'recommendation'
        | 'availability'
        | 'warranty'
        | 'materials'
        | 'color_options'
        | 'specific_variants'
        | 'feature_support'
      >;
      requiredUnspecifiedDetailTypes: Array<
        | 'coverage_support'
        | 'pricing'
        | 'payment_terms'
        | 'purchase_channel'
        | 'service_capability'
        | 'quote_requirements'
        | 'recommendation'
        | 'availability'
        | 'warranty'
        | 'materials'
        | 'color_options'
        | 'specific_variants'
        | 'feature_support'
      >;
    }> = {},
  ) => ({
    supportLevel: 'explicit' as const,
    evidenceTier: 'typed_claim' as const,
    absenceReason: null,
    exactnessRequested: false,
    requestedDetailTypes: [],
    supportedDetailTypes: [],
    partialDetailTypes: [],
    unsupportedDetailTypes: [],
    ...overrides,
  });

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
        evidenceTier: 'excerpt_only',
        absenceReason: 'extraction_uncertain',
        exactnessRequested: true,
        partialDetailTypes: expect.arrayContaining(['color_options']),
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
        evidenceTier: 'excerpt_only',
        absenceReason: 'extraction_uncertain',
        partialDetailTypes: ['color_options'],
        requiredUnspecifiedDetailTypes: ['color_options'],
      }),
    );
  });

  it('prefers detail types inferred from the user turn over broader paraphrases introduced by the retrieval query', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage:
        'Perfecto entonces en PVC solo blanco y en aluminio que colores tienen?',
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre colores disponibles para cortinas enrollar de aluminio y PVC',
        groundedSummary:
          'En PVC el color disponible es blanco. En aluminio, los colores disponibles son blanco, negro, marron, color madera, gris y verde.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt:
              'En PVC el color disponible es blanco. En aluminio, los colores disponibles son blanco, negro, marron, color madera, gris y verde.',
            sequence: 0,
            score: 4.9,
            supportSummary: {
              topic: 'CORTINAS DE ENROLLAR',
              supportedAxes: ['color_options'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'color_options',
                  values: ['blanco'],
                  supportClass: 'explicit_fact',
                  appliesTo: [{ axis: 'material', value: 'PVC' }],
                },
                {
                  axis: 'color_options',
                  values: ['blanco', 'negro', 'marron', 'color madera', 'gris', 'verde'],
                  supportClass: 'explicit_fact',
                  appliesTo: [{ axis: 'material', value: 'ALUMINIO' }],
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment.requestedDetailTypes).toEqual(['color_options']);
    expect(assessment.unsupportedDetailTypes).toEqual([]);
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

  it('treats installation questions with an unsupported execution qualifier as partial mixed detail support', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'y hacen instalacion de aberturas con albañileria?',
      parsedSubject: 'instalacion de aberturas con albañileria',
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre instalación de aberturas con albañilería',
        groundedSummary: 'toma de medidas, instalacion',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt:
              'La mano de obra de aberturas puede cotizarse por separado o quedar sujeta a confirmación según el relevamiento en obra.',
            sequence: 0,
            score: 9.5,
            supportSummary: {
              topic: '12. ABERTURAS EN ALUMINIO / Instalación',
              supportedAxes: ['service_offers'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'service_offers',
                  layer: 'factual',
                  values: ['toma de medidas', 'instalacion'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'ABERTURAS',
                    normalizedValue: 'aberturas',
                  },
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment).toEqual(
      expect.objectContaining({
        supportLevel: 'partial',
        requestedDetailTypes: expect.arrayContaining([
          'service_capability',
          'feature_support',
        ]),
        supportedDetailTypes: expect.arrayContaining(['service_capability']),
        unsupportedDetailTypes: expect.arrayContaining(['feature_support']),
        requiredUnspecifiedDetailTypes: expect.arrayContaining(['feature_support']),
      }),
    );
  });

  it('treats purchase-channel questions as supported when commercial presence and visit facts are present', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'tienen local comercial?',
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre local comercial y modalidad de atención',
        groundedSummary:
          'No contamos con local comercial. Trabajamos principalmente de forma online.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt:
              'No contamos con local comercial. Nuestra atención es principalmente online. Podemos coordinar visitas a domicilio.',
            sequence: 0,
            score: 4.8,
            supportSummary: {
              topic: 'INFORMACION GENERAL',
              supportedAxes: [
                'commercial_presence',
                'service_offers',
                'coverage_locations',
              ],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'commercial_presence',
                  values: ['sin local comercial', 'atencion online'],
                  supportClass: 'explicit_fact',
                },
                {
                  axis: 'service_offers',
                  values: ['visita a domicilio'],
                  supportClass: 'explicit_fact',
                },
                {
                  axis: 'coverage_locations',
                  values: ['Montevideo'],
                  supportClass: 'explicit_fact',
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment.supportedDetailTypes).toContain('purchase_channel');
    expect(assessment.unsupportedDetailTypes).not.toContain('purchase_channel');
  });

  it('treats service capability questions as supported when service offers are present', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'toman medidas a domicilio?',
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre toma de medidas a domicilio',
        groundedSummary:
          'Sí, podemos coordinar una visita a domicilio para tomar medidas.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt:
              'Sí, podemos coordinar una visita a domicilio para tomar medidas.',
            sequence: 0,
            score: 4.9,
            supportSummary: {
              topic: 'VISITA PREVIA',
              supportedAxes: ['service_offers'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'service_offers',
                  values: ['visita a domicilio', 'toma de medidas'],
                  supportClass: 'explicit_fact',
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment.supportedDetailTypes).toContain('service_capability');
  });

  it('keeps recommendation and variant cues alongside supported service capability in noisy mixed queries', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage:
        'hola, estoy viendo opciones porque se me rompio una persiana y ademas quiero algo mas moderno, ustedes hacen eso?',
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre reparación y opciones modernas de persianas',
        groundedSummary:
          'Realizamos reparación de cortinas y persianas, además de mantenimiento general.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt:
              'Realizamos reparación de cortinas y persianas, además de mantenimiento general.',
            sequence: 0,
            score: 5.4,
            supportSummary: {
              topic: 'SERVICIOS',
              supportedAxes: ['service_offers'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'service_offers',
                  values: ['reparacion', 'mantenimiento'],
                  supportClass: 'explicit_fact',
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment.requestedDetailTypes).toEqual(
      expect.arrayContaining([
        'service_capability',
        'recommendation',
        'specific_variants',
      ]),
    );
    expect(assessment.supportedDetailTypes).toContain('service_capability');
    expect(assessment.unsupportedDetailTypes).toEqual(
      expect.arrayContaining(['recommendation', 'specific_variants']),
    );
  });

  it('marks generic matched evidence as unavailable when the parsed subject is outside the supported domain', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'venden muebles o hacen trabajos electricos?',
      parsedSubject: 'muebles o trabajos eléctricos',
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre venta de muebles o realización de trabajos eléctricos',
        groundedSummary:
          'Combinamos venta, instalación, mantenimiento, reparación y trabajos a medida.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt:
              'Combinamos venta, instalación, mantenimiento, reparación y trabajos a medida.',
            sequence: 0,
            score: 2,
            supportSummary: {
              topic: 'PERFIL COMERCIAL',
              supportedAxes: ['service_offers', 'commercial_presence'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'service_offers',
                  values: ['instalacion', 'mantenimiento', 'reparacion'],
                  supportClass: 'explicit_fact',
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment.supportLevel).toBe('unavailable');
    expect(assessment.absenceReason).toBe('document_gap');
  });

  it('treats usage-shape queries as recommendation requests when they provide enough weak recommendation signals', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'me interesa algo exterior y de bajo mantenimiento',
      documentContext: {
        source: 'document_origin',
        query: 'Interés en persiana exterior de bajo mantenimiento',
        groundedSummary:
          'Las cortinas de enrollar exteriores pueden ser de PVC o aluminio.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt:
              'Las cortinas de enrollar exteriores pueden ser de PVC o aluminio.',
            sequence: 0,
            score: 4.1,
            supportSummary: {
              topic: 'CORTINAS DE ENROLLAR',
              supportedAxes: ['materials', 'product_types'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'materials',
                  values: ['PVC', 'ALUMINIO'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'CORTINAS DE ENROLLAR',
                    normalizedValue: 'cortinas de enrollar',
                  },
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment.requestedDetailTypes).toContain('recommendation');
    expect(assessment.supportedDetailTypes).toContain('recommendation');
  });

  it('lets recommendation cues take precedence over broader carryover service cues', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'me interesa algo exterior y de bajo mantenimiento',
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre reparación y opciones modernas de persianas',
        groundedSummary:
          'Las cortinas de enrollar exteriores pueden ser de PVC o aluminio.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt:
              'Las cortinas de enrollar exteriores pueden ser de PVC o aluminio.',
            sequence: 0,
            score: 4.1,
            supportSummary: {
              topic: 'CORTINAS DE ENROLLAR',
              supportedAxes: ['materials', 'product_types'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'materials',
                  values: ['PVC', 'ALUMINIO'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'CORTINAS DE ENROLLAR',
                    normalizedValue: 'cortinas de enrollar',
                  },
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment.requestedDetailTypes).toContain('recommendation');
    expect(assessment.requestedDetailTypes).not.toContain('service_capability');
  });

  it('treats availability questions as supported when explicit product types are present', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'tienen roller blackout?',
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre disponibilidad de roller blackout',
        groundedSummary: 'Roller Blackout.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt: 'Roller Blackout',
            sequence: 0,
            score: 6.2,
            supportSummary: {
              topic: 'CORTINAS ROLLER',
              supportedAxes: ['product_types'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'product_types',
                  values: ['Roller Blackout'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'CORTINAS ROLLER',
                    normalizedValue: 'cortinas roller',
                  },
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment.requestedDetailTypes).toEqual(['availability']);
    expect(assessment.supportedDetailTypes).toContain('availability');
    expect(assessment.unsupportedDetailTypes).not.toContain('availability');
  });

  it('marks availability as unavailable when the concrete subject is outside the document domain', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'Hola venden camas de 1 plaza?',
      parsedSubject: 'camas de 1 plaza',
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre disponibilidad de camas de 1 plaza',
        groundedSummary:
          'Confirmamos el producto, pedimos medidas aproximadas, pedimos cantidad, pedimos variante o configuración si aplica',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Documento Maestro',
            excerpt:
              'Confirmamos el producto, pedimos medidas aproximadas, pedimos cantidad, pedimos variante o configuración si aplica',
            sequence: 0,
            score: 7,
            supportSummary: {
              topic: 'Si la consulta pasa a presupuesto',
              supportedAxes: ['quote_transition'],
              unspecifiedAxes: [],
            },
          },
          {
            documentId: 'doc-1',
            title: 'Documento Maestro',
            excerpt: 'Roller blackout, roller doble, trasluz y tela liviana.',
            sequence: 1,
            score: 6,
            supportSummary: {
              topic: 'CORTINAS TRADICIONALES',
              supportedAxes: ['product_types'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'product_types',
                  values: ['velo', 'trasluz', 'blackout', 'tela liviana', 'doble capa'],
                  supportClass: 'explicit_fact',
                  subject: {
                    axis: 'section_topic',
                    value: 'CORTINAS TRADICIONALES',
                    normalizedValue: 'cortinas tradicionales',
                  },
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment.requestedDetailTypes).toEqual(['availability']);
    expect(assessment.supportLevel).toBe('unavailable');
    expect(assessment.absenceReason).toBe('document_gap');
    expect(assessment.supportedDetailTypes).not.toContain('availability');
  });

  it('treats quote requirement questions as supported when quote_fields are present', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'que datos necesitan para cotizar?',
      documentContext: {
        source: 'document_origin',
        query: 'Consulta sobre datos para presupuesto',
        groundedSummary:
          'Para cotizar necesitamos ancho y alto aproximado, si es instalación nueva o reemplazo, y si prefieres manual o motorizada.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Catálogo',
            excerpt:
              'ancho y alto aproximado; si es instalación nueva o reemplazo; si prefieres manual o motorizada',
            sequence: 0,
            score: 4.7,
            supportSummary: {
              topic: 'Datos útiles para presupuesto',
              supportedAxes: ['quote_fields'],
              unspecifiedAxes: [],
              axisSummaries: [
                {
                  axis: 'quote_fields',
                  values: [
                    'ancho y alto aproximado',
                    'si es instalación nueva o reemplazo',
                    'si prefieres manual o motorizada',
                  ],
                  supportClass: 'explicit_fact',
                },
              ],
            },
          },
        ],
      },
    });

    expect(assessment.supportedDetailTypes).toContain('quote_requirements');
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
        supportedDetailTypes: expect.arrayContaining(['pricing']),
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
        evidenceTier: 'typed_claim',
        absenceReason: null,
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
        evidenceTier: 'none',
        absenceReason: 'extraction_uncertain',
      }),
    );
  });

  it('treats proposition-only support as extraction-safe partial evidence instead of document absence', () => {
    const assessment = service.assessDocumentContext({
      locale: 'es',
      userMessage: 'la serie 25 soporta dvh?',
      documentContext: {
        source: 'document_origin',
        query: 'serie 25 dvh',
        groundedSummary: 'Compatibilidad (SERIE 25): no soporta DVH',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Aberturas',
            excerpt: 'Serie 25. No soporta DVH.',
            sequence: 0,
            score: 4.3,
            supportSummary: {
              topic: 'SERIE 25',
              supportedAxes: [],
              unspecifiedAxes: [],
              propositionSummaries: [
                {
                  predicate: 'feature_support',
                  supportClass: 'explicit_fact',
                  evidenceTier: 'normalized_proposition',
                  polarity: 'negated',
                  confidence: 0.92,
                  subject: {
                    axis: 'product_type',
                    value: 'SERIE 25',
                    normalizedValue: 'serie 25',
                  },
                  relationScope: [],
                  objectValue: 'DVH',
                  patternKey: 'feature_support||negated|subject:product_type|scopes:',
                },
              ],
              evidenceTier: 'normalized_proposition',
            },
          },
        ],
      },
    });

    expect(assessment).toEqual(
      expect.objectContaining({
        supportLevel: 'partial',
        evidenceTier: 'normalized_proposition',
        absenceReason: 'extraction_uncertain',
        requestedDetailTypes: ['feature_support'],
        partialDetailTypes: ['feature_support'],
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
          evidenceTier: 'typed_claim',
          absenceReason: 'document_gap',
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

  it('uses extraction-uncertainty wording instead of document-gap wording when support is excerpt-based only', () => {
    const clause = service.buildUnspecifiedDetailClause({
      locale: 'es',
      documentContext: {
        source: 'document_origin',
        query: 'tarjetas mercado pago',
        groundedSummary: 'Aceptamos pagos con tarjeta a través de Mercado Pago.',
        responseMode: 'document_exploration',
        grounding: {
          supportLevel: 'partial',
          evidenceTier: 'excerpt_only',
          absenceReason: 'extraction_uncertain',
          exactnessRequested: true,
          requestedDetailTypes: ['payment_terms'],
          supportedDetailTypes: [],
          partialDetailTypes: ['payment_terms'],
          unsupportedDetailTypes: [],
          requiredUnspecifiedDetailTypes: ['payment_terms'],
        },
        matches: [],
      },
    } as any);

    expect(clause).toBe(
      'Por ahora no tengo una confirmación suficientemente clara sobre las condiciones de pago.',
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
          evidenceTier: 'typed_claim',
          absenceReason: 'document_gap',
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
            grounding: buildGrounding(),
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
            grounding: buildGrounding(),
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

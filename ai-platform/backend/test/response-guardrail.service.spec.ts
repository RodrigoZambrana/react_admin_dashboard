import { ResponseGuardrailService } from '../src/modules/response/response-guardrail.service';
import { ResponseGroundingService } from '../src/modules/response/response-grounding.service';
import { ApprovedResponseContext } from '../src/modules/response/response.types';

describe('ResponseGuardrailService', () => {
  const responseFallbackService = {
    startsWithGreeting: jest.fn(
      async (_locale: string | null | undefined, value: string) => {
        const normalized = value.trim().toLowerCase();
        return (
          normalized.startsWith('hola') ||
          normalized.startsWith('buenas') ||
          normalized.startsWith('hello') ||
          normalized.startsWith('hi')
        );
      },
    ),
  };
  const service = new ResponseGuardrailService(
    new ResponseGroundingService(),
    responseFallbackService as any,
  );
  const buildGrounding = (
    overrides: Partial<
      NonNullable<ApprovedResponseContext['documentContext']>['grounding']
    > = {},
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

  const approvedContext: ApprovedResponseContext = {
    locale: 'es',
    userMessage: 'Reservar para mañana',
    intent: 'CREATE_BOOKING',
    outcome: 'execution_succeeded',
    decision: {
      domain: 'tenant',
      action: 'invoke_tool',
      toolName: 'create_booking',
      reasonCode: 'booking_requested',
      missingFields: [],
      responseTemplateKey: 'tenant.booking.confirmation',
    },
    interpretation: {
      language: 'es',
      confidence: 0.92,
      entities: {
        rawMessage: 'Reservar para mañana',
      },
      normalizedEntities: {
        dates: [
          {
            source: 'mañana',
            iso: '2026-04-04T12:00:00.000Z',
            precision: 'date',
          },
        ],
        measurements: [],
        dimensions: [],
      },
    },
    execution: {
      status: 'succeeded',
      toolName: 'create_booking',
      validatedInputSummary: {
        requestedDateIso: '2026-04-04T12:00:00.000Z',
      },
      resultSummary: {
        bookingId: 'bk_123',
        scheduledFor: '2026-04-04T12:00:00.000Z',
        status: 'confirmed',
      },
      failure: null,
    },
    approvedFactKeys: [],
    approvedResultKeys: ['bookingId', 'scheduledFor', 'status'],
    approvedDocumentIds: ['doc-1'],
    documentContext: {
      source: 'document_origin',
      query: 'reserva de visita',
      groundedSummary: 'El documento describe la cobertura del servicio.',
      responseMode: 'combined_execution',
      grounding: buildGrounding(),
      matches: [],
    },
  };

  it('accepts grounded AI output that matches backend-approved execution truth', async () => {
    await expect(
      service.evaluate({
        approvedContext,
        generatedResponse: {
          message: 'Your booking is confirmed for 2026-04-04T12:00:00.000Z.',
          assertedOutcome: 'execution_succeeded',
          assertedExecutionStatus: 'succeeded',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: ['scheduledFor', 'status'],
          mentionedDocumentIds: ['doc-1'],
        },
      }),
    ).resolves.toEqual({
      accepted: true,
      reasons: [],
    });
  });

  it('rejects fabricated success and unsupported result keys', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'execution_failed',
          execution: {
            status: 'failed',
            toolName: 'create_booking',
            validatedInputSummary: {
              requestedDateIso: '2026-04-04T12:00:00.000Z',
            },
            resultSummary: null,
            failure: {
              code: 'execution_failed',
              message: 'tool error',
              details: null,
            },
          },
          approvedResultKeys: [],
        },
        generatedResponse: {
          message: 'Your booking is confirmed.',
          assertedOutcome: 'execution_succeeded',
          assertedExecutionStatus: 'succeeded',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: ['bookingId'],
          mentionedDocumentIds: ['doc-1'],
        },
      }),
    ).resolves.toEqual({
      accepted: false,
      reasons: [
        'outcome_mismatch',
        'execution_status_mismatch',
        'unsupported_result_keys',
      ],
    });
  });

  it('rejects unsupported document pricing claims that are not backed by approved context', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'respond',
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          documentContext: {
            source: 'document_origin',
            query: 'que dice sobre la tela screen',
            groundedSummary: 'El documento describe filtrado de luz y privacidad.',
            responseMode: 'document_exploration',
            grounding: buildGrounding({
              supportLevel: 'partial',
              requestedDetailTypes: ['pricing'],
              unsupportedDetailTypes: ['pricing'],
            }),
            matches: [],
          },
        },
        generatedResponse: {
          message: 'Es una opcion economica y suele estar en un rango de precio accesible.',
          assertedOutcome: 'respond',
          assertedExecutionStatus: 'not_applicable',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: [],
          mentionedDocumentIds: [],
        },
      }),
    ).resolves.toEqual({
      accepted: false,
      reasons: ['missing_required_detail_axis', 'unsupported_document_detail'],
    });
  });

  it('allows unsupported detail references when the reply explicitly says the detail is not specified', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'execution_succeeded',
          documentContext: {
            source: 'document_origin',
            query: 'si cubre cambio de cadena',
            groundedSummary: '',
            responseMode: 'combined_execution',
            grounding: buildGrounding({
              supportLevel: 'partial',
              absenceReason: 'document_gap',
              requestedDetailTypes: ['coverage_support'],
              unsupportedDetailTypes: ['coverage_support'],
            }),
            matches: [],
          },
        },
        generatedResponse: {
          message:
            'El documento no especifica si está cubierto. La reserva fue confirmada para 2026-04-04T12:00:00.000Z.',
          assertedOutcome: 'execution_succeeded',
          assertedExecutionStatus: 'succeeded',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: ['scheduledFor', 'status'],
          mentionedDocumentIds: [],
        },
      }),
    ).resolves.toEqual({
      accepted: true,
      reasons: [],
    });
  });

  it('allows incidental unsupported framing when the same sentence concretely answers a supported requested detail', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'respond',
          documentContext: {
            source: 'document_origin',
            query: 'Consulta sobre colores para PVC y aluminio',
            groundedSummary:
              'En PVC el color disponible es blanco. En aluminio, los colores disponibles son blanco, negro y gris.',
            responseMode: 'document_exploration',
            grounding: buildGrounding({
              requestedDetailTypes: ['color_options'],
              supportedDetailTypes: ['color_options'],
            }),
            matches: [
              {
                documentId: 'doc-1',
                title: 'Catálogo',
                excerpt:
                  'En PVC el color disponible es blanco. En aluminio, los colores disponibles son blanco, negro y gris.',
                sequence: 0,
                score: 4.3,
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
                      values: ['blanco', 'negro', 'gris'],
                      supportClass: 'explicit_fact',
                      appliesTo: [{ axis: 'material', value: 'ALUMINIO' }],
                    },
                  ],
                },
              },
            ],
          },
        },
        generatedResponse: {
          message:
            'En PVC, el color disponible es blanco. En aluminio, las cortinas de enrollar están disponibles en blanco, negro y gris.',
          assertedOutcome: 'respond',
          assertedExecutionStatus: 'not_applicable',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: [],
          mentionedDocumentIds: [],
        },
      }),
    ).resolves.toEqual({
      accepted: true,
      reasons: [],
    });
  });

  it('rejects vague replies that avoid the required unsupported-detail axis', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'respond',
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          documentContext: {
            source: 'document_origin',
            query: 'que colores exactos tiene',
            groundedSummary: 'El documento indica variedad de colores para esa linea.',
            responseMode: 'document_exploration',
            grounding: buildGrounding({
              supportLevel: 'partial',
              absenceReason: 'document_gap',
              exactnessRequested: true,
              requestedDetailTypes: ['color_options'],
              partialDetailTypes: ['color_options'],
              requiredUnspecifiedDetailTypes: ['color_options'],
            }),
            matches: [],
          },
        },
        generatedResponse: {
          message: 'No tengo una confirmación clara sobre eso ahora mismo.',
          assertedOutcome: 'respond',
          assertedExecutionStatus: 'not_applicable',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: [],
          mentionedDocumentIds: [],
        },
      }),
    ).resolves.toEqual({
      accepted: false,
      reasons: ['missing_required_detail_axis'],
    });
  });

  it('rejects mixed service answers that mention an unresolved recommendation without clarifying the missing context', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'respond',
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          userMessage:
            'hola, estoy viendo opciones porque se me rompio una persiana y ademas quiero algo mas moderno, ustedes hacen eso?',
          documentContext: {
            source: 'document_origin',
            query:
              'Consulta sobre opciones para persianas modernas y reparación de persiana rota',
            groundedSummary:
              'Reparacion, mantenimiento instalacion, reparacion, motorizacion, automatizacion',
            responseMode: 'document_exploration',
            grounding: buildGrounding({
              supportLevel: 'partial',
              absenceReason: 'document_gap',
              requestedDetailTypes: [
                'recommendation',
                'specific_variants',
                'service_capability',
              ],
              supportedDetailTypes: ['service_capability'],
              unsupportedDetailTypes: ['recommendation', 'specific_variants'],
              requiredUnspecifiedDetailTypes: [
                'recommendation',
                'specific_variants',
              ],
            }),
            matches: [
              {
                documentId: 'doc-1',
                title: 'Catálogo',
                excerpt:
                  'Realizamos reparación de cortinas y persianas, además de mantenimiento general.',
                sequence: 0,
                score: 5.2,
                supportSummary: {
                  topic: 'SERVICIOS',
                  supportedAxes: ['service_offers'],
                  unspecifiedAxes: [],
                  axisSummaries: [
                    {
                      axis: 'service_offers',
                      values: ['reparacion', 'mantenimiento', 'automatizacion'],
                      supportClass: 'explicit_fact',
                    },
                  ],
                },
              },
            ],
          },
        },
        generatedResponse: {
          message:
            'Sí, realizamos reparación de persianas y también ofrecemos soluciones modernas como motorización y automatización. Podemos hacer una visita a domicilio para tomar medidas y asesorarte sobre la mejor opción para tu caso.',
          assertedOutcome: 'respond',
          assertedExecutionStatus: 'not_applicable',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: [],
          mentionedDocumentIds: [],
        },
      }),
    ).resolves.toEqual({
      accepted: false,
      reasons: ['missing_required_detail_axis', 'unsupported_document_detail'],
    });
  });

  it('rejects presenting partially supported detail as explicit when exactness was requested', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'respond',
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          documentContext: {
            source: 'document_origin',
            query: 'que colores exactos tiene',
            groundedSummary: 'El documento indica variedad de colores para esa linea.',
            responseMode: 'document_exploration',
            grounding: buildGrounding({
              supportLevel: 'partial',
              absenceReason: 'document_gap',
              exactnessRequested: true,
              requestedDetailTypes: ['color_options'],
              partialDetailTypes: ['color_options'],
            }),
            matches: [],
          },
        },
        generatedResponse: {
          message: 'Viene en varios colores para esa linea.',
          assertedOutcome: 'respond',
          assertedExecutionStatus: 'not_applicable',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: [],
          mentionedDocumentIds: [],
        },
      }),
    ).resolves.toEqual({
      accepted: false,
      reasons: ['missing_required_detail_axis', 'partial_document_detail_overclaim'],
    });
  });

  it('rejects unspecified-detail replies that dodge into the wrong detail axis', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'respond',
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          documentContext: {
            source: 'document_origin',
            query: 'que colores exactos tiene',
            groundedSummary: 'El documento indica variedad de colores para esa linea.',
            responseMode: 'document_exploration',
            grounding: buildGrounding({
              supportLevel: 'partial',
              absenceReason: 'document_gap',
              exactnessRequested: true,
              requestedDetailTypes: ['color_options'],
              partialDetailTypes: ['color_options'],
            }),
            matches: [],
          },
        },
        generatedResponse: {
          message: 'No se especifican los materiales exactos para esa linea.',
          assertedOutcome: 'respond',
          assertedExecutionStatus: 'not_applicable',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: [],
          mentionedDocumentIds: [],
        },
      }),
    ).resolves.toEqual({
      accepted: false,
      reasons: ['missing_required_detail_axis', 'wrong_unspecified_detail_axis'],
    });
  });

  it('rejects document-grounded overreach when the reply introduces several unsupported option terms', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'respond',
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          documentContext: {
            source: 'document_origin',
            query: 'privacy and light filtering',
            groundedSummary: 'The document says screen fabric filters light and improves privacy.',
            responseMode: 'document_exploration',
            grounding: buildGrounding(),
            matches: [],
          },
        },
        generatedResponse: {
          message:
            'Podrias ir por estores traslucidos, paneles japoneses, lino liviano o shades dobles para lograr ese efecto.',
          assertedOutcome: 'respond',
          assertedExecutionStatus: 'not_applicable',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: [],
          mentionedDocumentIds: [],
        },
      }),
    ).resolves.toEqual({
      accepted: false,
      reasons: ['document_context_overreach'],
    });
  });

  it('does not reject a respond outcome only because the model echoed a non-applicable execution status incorrectly', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'respond',
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          approvedDocumentIds: ['doc-1'],
          documentContext: {
            source: 'document_origin',
            query: 'que dice sobre screen',
            groundedSummary:
              'La tela screen permite paso de luz y visibilidad unidireccional.',
            responseMode: 'document_exploration',
            grounding: buildGrounding(),
            matches: [
              {
                documentId: 'doc-1',
                title: 'Catalogo',
                sequence: 0,
                score: 4,
                excerpt:
                  'La tela screen permite paso de luz y visibilidad unidireccional.',
              },
            ],
          },
        },
        approvedDraft:
          'La tela screen permite paso de luz y visibilidad unidireccional.',
        generatedResponse: {
          message:
            'La tela screen permite paso de luz y visibilidad unidireccional.',
          assertedOutcome: 'respond',
          assertedExecutionStatus: 'succeeded',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: [],
          mentionedDocumentIds: ['doc-1'],
        },
      }),
    ).resolves.toEqual({
      accepted: true,
      reasons: [],
    });
  });

  it('rejects close_turn messages that reopen the conversation with a fresh help offer', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'close_turn',
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          documentContext: undefined,
          approvedDocumentIds: [],
        },
        generatedResponse: {
          message:
            'Gracias a ti por tu mensaje. Quedo a tu disposición para cualquier otra consulta.',
          assertedOutcome: 'close_turn',
          assertedExecutionStatus: 'succeeded',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: [],
          mentionedDocumentIds: [],
        },
      }),
    ).resolves.toEqual({
      accepted: false,
      reasons: ['close_turn_reopen'],
    });
  });

  it('rejects generated responses that add a second greeting when the opening is backend-owned', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'respond',
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          responseStyle: {
            preferBrief: true,
            incrementalFollowUp: false,
            groundedKnowledgeOnly: false,
            includeInitialGreeting: true,
            preferMultiline: true,
            hasPriorConversation: false,
          },
          documentContext: {
            source: 'document_origin',
            query: 'cortinas de enrollar',
            groundedSummary: 'Sí, tenemos cortinas de enrollar manuales y motorizadas.',
            responseMode: 'document_exploration',
            grounding: buildGrounding(),
            matches: [],
          },
        },
        generatedResponse: {
          message: 'Hola, sí, tenemos cortinas de enrollar manuales y motorizadas.',
          assertedOutcome: 'respond',
          assertedExecutionStatus: 'not_applicable',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: [],
          mentionedDocumentIds: [],
        },
      }),
    ).resolves.toEqual({
      accepted: false,
      reasons: ['duplicate_opening_greeting'],
    });
  });

  it('rejects standalone greetings on follow-up turns even when the approved draft does not own an opening', async () => {
    await expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'respond',
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          responseStyle: {
            preferBrief: true,
            incrementalFollowUp: true,
            groundedKnowledgeOnly: false,
            includeInitialGreeting: false,
            preferMultiline: false,
            hasPriorConversation: true,
          },
          documentContext: {
            source: 'document_origin',
            query: 'coordinar visita',
            groundedSummary: 'Indicame cuándo te queda bien la visita y sigo con eso.',
            responseMode: 'document_exploration',
            grounding: buildGrounding(),
            matches: [],
          },
        },
        generatedResponse: {
          message:
            'Hola, gracias por contactarnos. Indicame cuándo te queda bien la visita y sigo con eso.',
          assertedOutcome: 'respond',
          assertedExecutionStatus: 'not_applicable',
          mentionedMissingFields: [],
          mentionedApprovedFactKeys: [],
          mentionedApprovedResultKeys: [],
          mentionedDocumentIds: [],
        },
      }),
    ).resolves.toEqual({
      accepted: false,
      reasons: ['unexpected_followup_greeting'],
    });
  });
});

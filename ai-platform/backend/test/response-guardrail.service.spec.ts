import { ResponseGuardrailService } from '../src/modules/response/response-guardrail.service';
import { ResponseGroundingService } from '../src/modules/response/response-grounding.service';
import { ApprovedResponseContext } from '../src/modules/response/response.types';

describe('ResponseGuardrailService', () => {
  const service = new ResponseGuardrailService(new ResponseGroundingService());

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
      grounding: {
        supportLevel: 'explicit',
        exactnessRequested: false,
        requestedDetailTypes: [],
        supportedDetailTypes: [],
        partialDetailTypes: [],
        unsupportedDetailTypes: [],
      },
      matches: [],
    },
  };

  it('accepts grounded AI output that matches backend-approved execution truth', () => {
    expect(
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
    ).toEqual({
      accepted: true,
      reasons: [],
    });
  });

  it('rejects fabricated success and unsupported result keys', () => {
    expect(
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
    ).toEqual({
      accepted: false,
      reasons: [
        'outcome_mismatch',
        'execution_status_mismatch',
        'unsupported_result_keys',
      ],
    });
  });

  it('rejects unsupported document pricing claims that are not backed by approved context', () => {
    expect(
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
            grounding: {
              supportLevel: 'partial',
              exactnessRequested: false,
              requestedDetailTypes: ['pricing'],
              supportedDetailTypes: [],
              partialDetailTypes: [],
              unsupportedDetailTypes: ['pricing'],
            },
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
    ).toEqual({
      accepted: false,
      reasons: ['unsupported_document_detail'],
    });
  });

  it('allows unsupported detail references when the reply explicitly says the detail is not specified', () => {
    expect(
      service.evaluate({
        approvedContext: {
          ...approvedContext,
          outcome: 'execution_succeeded',
          documentContext: {
            source: 'document_origin',
            query: 'si cubre cambio de cadena',
            groundedSummary: '',
            responseMode: 'combined_execution',
            grounding: {
              supportLevel: 'partial',
              exactnessRequested: false,
              requestedDetailTypes: ['coverage_support'],
              supportedDetailTypes: [],
              partialDetailTypes: [],
              unsupportedDetailTypes: ['coverage_support'],
            },
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
    ).toEqual({
      accepted: true,
      reasons: [],
    });
  });

  it('rejects presenting partially supported detail as explicit when exactness was requested', () => {
    expect(
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
    ).toEqual({
      accepted: false,
      reasons: ['partial_document_detail_overclaim'],
    });
  });

  it('rejects unspecified-detail replies that dodge into the wrong detail axis', () => {
    expect(
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
    ).toEqual({
      accepted: false,
      reasons: ['wrong_unspecified_detail_axis'],
    });
  });

  it('rejects document-grounded overreach when the reply introduces several unsupported option terms', () => {
    expect(
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
            grounding: {
              supportLevel: 'explicit',
              exactnessRequested: false,
              requestedDetailTypes: [],
              supportedDetailTypes: [],
              partialDetailTypes: [],
              unsupportedDetailTypes: [],
            },
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
    ).toEqual({
      accepted: false,
      reasons: ['document_context_overreach'],
    });
  });

  it('does not reject a respond outcome only because the model echoed a non-applicable execution status incorrectly', () => {
    expect(
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
    ).toEqual({
      accepted: true,
      reasons: [],
    });
  });

  it('rejects close_turn messages that reopen the conversation with a fresh help offer', () => {
    expect(
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
    ).toEqual({
      accepted: false,
      reasons: ['close_turn_reopen'],
    });
  });
});

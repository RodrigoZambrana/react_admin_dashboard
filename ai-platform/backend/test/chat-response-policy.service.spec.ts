import { ChatResponsePolicyService } from '../src/modules/response/chat-response-policy.service';

describe('ChatResponsePolicyService', () => {
  const service = new ChatResponsePolicyService({
    render: jest.fn(
      async (input: {
        locale?: string;
        templateKey: string;
        variables?: Record<string, string | number | null | undefined>;
      }) => {
        const templates = buildCatalog(input.locale).templates as Record<
          string,
          string
        >;
        return templates[input.templateKey].replace(
          /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
          (_match, key: string) => String(input.variables?.[key] ?? ''),
        );
      },
    ),
    getDefaults: jest.fn(async (locale?: string) => buildCatalog(locale).defaults),
    getActionLabel: jest.fn(
      async (locale: string | undefined, toolName: string | null | undefined) => {
        const labels = buildCatalog(locale).actionLabels;

        if (toolName === 'create_booking') {
          return labels.create_booking;
        }

        if (toolName === 'create_quote') {
          return labels.create_quote;
        }

        if (toolName === 'get_product') {
          return labels.get_product;
        }

        return labels.default;
      },
    ),
  } as any);

  it('returns a grounded booking confirmation after successful execution', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Reservar para manana',
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
          confidence: 0.95,
          entities: {},
          normalizedEntities: {
            dates: [],
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
            bookingId: 'bk_12345678',
            scheduledFor: '2026-04-04T12:00:00.000Z',
            status: 'confirmed',
          },
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: ['bookingId', 'scheduledFor', 'status'],
        approvedDocumentIds: [],
      }),
    ).resolves.toBe('La reserva fue confirmada para 2026-04-04T12:00:00.000Z.');
  });

  it('returns a grounded quote confirmation after successful execution', async () => {
    await expect(
      service.resolve({
        locale: 'en',
        userMessage: 'Need a quote',
        intent: 'CREATE_QUOTE',
        outcome: 'execution_succeeded',
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'create_quote',
          reasonCode: 'quote_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.quote.confirmation',
        },
        interpretation: {
          language: 'en',
          confidence: 0.95,
          entities: {},
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'succeeded',
          toolName: 'create_quote',
          validatedInputSummary: {
            requestSummary: 'Need a quote',
          },
          resultSummary: {
            quoteId: 'qt_12345678',
            estimatedTotal: 144,
            currency: 'USD',
            status: 'drafted',
          },
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: ['quoteId', 'estimatedTotal', 'currency', 'status'],
        approvedDocumentIds: [],
      }),
    ).resolves.toBe('The preliminary quote was created for USD 144.00.');
  });

  it('returns a grounded product result after successful execution', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Beacon Desk Lamp',
        intent: 'GET_PRODUCT',
        outcome: 'execution_succeeded',
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'get_product',
          reasonCode: 'product_lookup_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.ecommerce.product_result',
        },
        interpretation: {
          language: 'es',
          confidence: 0.95,
          entities: {},
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'succeeded',
          toolName: 'get_product',
          validatedInputSummary: {
            query: 'Beacon Desk Lamp',
          },
          resultSummary: {
            sku: 'B-77',
            name: 'Beacon Desk Lamp',
            price: 89,
            currency: 'USD',
          },
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: ['sku', 'name', 'price', 'currency'],
        approvedDocumentIds: [],
      }),
    ).resolves.toBe('Encontré Beacon Desk Lamp por USD 89.00.');
  });

  it('returns a deterministic validation failure response without claiming success', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Reservar',
        intent: 'CREATE_BOOKING',
        outcome: 'execution_failed',
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
          confidence: 0.95,
          entities: {},
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'failed',
          toolName: 'create_booking',
          validatedInputSummary: null,
          resultSummary: null,
          failure: {
            code: 'validation_failed',
            message: 'Tool input validation failed.',
            details: null,
          },
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
      }),
    ).resolves.toBe(
      'No pude completar la reserva solicitada con la información disponible.',
    );
  });

  it('returns a deterministic unknown-tool failure response without claiming success', async () => {
    await expect(
      service.resolve({
        locale: 'en',
        userMessage: 'do the thing',
        intent: 'GET_PRODUCT',
        outcome: 'execution_failed',
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'get_product',
          reasonCode: 'product_lookup_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.ecommerce.product_result',
        },
        interpretation: {
          language: 'en',
          confidence: 0.95,
          entities: {},
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'failed',
          toolName: 'missing_tool',
          validatedInputSummary: null,
          resultSummary: null,
          failure: {
            code: 'unknown_tool',
            message: 'Unknown tool',
            details: null,
          },
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
      }),
    ).resolves.toBe(
      'I could not complete the requested product lookup because the approved capability is not available.',
    );
  });

  it('asks only for the requested booking date when that is the only backend missing field', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Quiero agendar una visita',
        intent: 'CREATE_BOOKING',
        outcome: 'clarify',
        decision: {
          domain: 'core',
          action: 'clarify',
          reasonCode: 'booking_missing_fields',
          missingFields: ['requested_date'],
          responseTemplateKey: 'core.clarification',
        },
        interpretation: {
          language: 'es',
          confidence: 0.92,
          entities: {
            rawMessage: 'Quiero agendar una visita',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        missingFields: ['requested_date'],
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
      }),
    ).resolves.toMatch(/fecha|hora|visita/i);

    await expect(
      service.resolve({
        locale: 'es',
        userMessage: 'Quiero agendar una visita',
        intent: 'CREATE_BOOKING',
        outcome: 'clarify',
        decision: {
          domain: 'core',
          action: 'clarify',
          reasonCode: 'booking_missing_fields',
          missingFields: ['requested_date'],
          responseTemplateKey: 'core.clarification',
        },
        interpretation: {
          language: 'es',
          confidence: 0.92,
          entities: {
            rawMessage: 'Quiero agendar una visita',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        missingFields: ['requested_date'],
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
      }),
    ).resolves.not.toMatch(/objetivo|tipo de cita/i);
  });

  it('composes document grounding with booking confirmation for combined flows', async () => {
    await expect(
      service.resolve({
        locale: 'es',
        userMessage:
          'Si el documento dice que cubren cambio de cadena, agendame una visita para mañana a las 11.',
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
          confidence: 0.96,
          entities: {
            rawMessage:
              'Si el documento dice que cubren cambio de cadena, agendame una visita para mañana a las 11.',
            requestSummary: 'cambio de cadena de cortina roller',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'succeeded',
          toolName: 'create_booking',
          validatedInputSummary: {
            requestedDateIso: '2026-04-05T11:00:00.000Z',
          },
          resultSummary: {
            bookingId: 'bk_12345678',
            scheduledFor: '2026-04-05T11:00:00.000Z',
            status: 'confirmed',
          },
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: ['bookingId', 'scheduledFor', 'status'],
        approvedDocumentIds: ['doc-1'],
        documentContext: {
          source: 'document_origin',
          query: 'cambio de cadena de cortina roller',
          groundedSummary:
            'El documento indica que el cambio de cadena de cortinas roller está cubierto dentro del servicio estándar.',
          matches: [
            {
              documentId: 'doc-1',
              title: 'Cobertura Roller',
              excerpt:
                'El cambio de cadena de cortinas roller está cubierto dentro del servicio estándar.',
              sequence: 0,
              score: 4.4,
            },
          ],
        },
      }),
    ).resolves.toBe(
      'El documento indica que el cambio de cadena de cortinas roller está cubierto dentro del servicio estándar. La reserva fue confirmada para 2026-04-05T11:00:00.000Z.',
    );
  });

  it('uses a governed not-found response when active documents do not support the question', async () => {
    await expect(
      service.resolve({
        locale: 'en',
        userMessage: 'What does the document say about chain replacement coverage?',
        intent: 'GENERAL_CONVERSATION',
        outcome: 'respond',
        decision: {
          domain: 'core',
          action: 'respond',
          reasonCode: 'general_conversation',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        },
        interpretation: {
          language: 'en',
          confidence: 0.78,
          entities: {
            rawMessage: 'What does the document say about chain replacement coverage?',
          },
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        },
        execution: {
          status: 'not_applicable',
          toolName: null,
          validatedInputSummary: null,
          resultSummary: null,
          failure: null,
        },
        approvedFactKeys: [],
        approvedResultKeys: [],
        approvedDocumentIds: [],
        documentContext: {
          source: 'document_origin',
          query: 'chain replacement coverage',
          groundedSummary: '',
          matches: [],
        },
      }),
    ).resolves.toMatch(/document/i);
  });
});

function buildCatalog(locale?: string) {
  if ((locale ?? '').toLowerCase().startsWith('es')) {
    return {
      templates: {
        basic_response: 'Hola, ¿en qué puedo ayudarte?',
        clarification_requested_date:
          'Para coordinar la visita, necesito la fecha y la hora que te sirven.',
        clarification_user_goal:
          'Contame brevemente qué necesitás y sigo con eso.',
        clarification_generic: 'Necesito un poco más de contexto para seguir.',
        execution_success_booking:
          'La reserva fue confirmada para {{scheduledFor}}.',
        execution_success_quote:
          'La cotización preliminar fue creada por {{currency}} {{estimatedTotal}}.',
        execution_success_product: 'Encontré {{name}} por {{currency}} {{price}}.',
        execution_success_generic:
          'La acción solicitada se ejecutó correctamente.',
        execution_failure_unknown_tool:
          'No pude completar {{actionLabel}} porque la capacidad aprobada no está disponible.',
        execution_failure_validation:
          'No pude completar {{actionLabel}} con la información disponible.',
        execution_failure_generic:
          'No pude completar {{actionLabel}} por un error durante la ejecución.',
        document_not_found:
          'No encontré información relevante sobre eso en los documentos activos.',
      },
      templateVariants: {
        basic_response: [
          'Hola, ¿en qué puedo ayudarte?',
          'Decime qué necesitás y te doy una mano.',
          'Contame qué querés resolver y lo vemos.',
        ],
        clarification_requested_date: [
          'Para coordinar la visita, necesito la fecha y la hora que te sirven.',
          'Decime qué día y horario querés para poder agendar la visita.',
          'Indicame cuándo te queda bien la visita y sigo con eso.',
        ],
        clarification_user_goal: [
          'Contame brevemente qué necesitás y sigo con eso.',
          'Decime qué querés resolver y continúo desde ahí.',
          'Necesito que me cuentes un poco más qué necesitás para avanzar.',
        ],
        clarification_generic: [
          'Necesito un poco más de contexto para seguir.',
          'Dame un poco más de detalle y continúo.',
          'Contame un poco más para poder avanzar.',
        ],
        document_not_found: [
          'No encontré información relevante sobre eso en los documentos activos.',
        ],
      },
      actionLabels: {
        create_booking: 'la reserva solicitada',
        create_quote: 'la cotización solicitada',
        get_product: 'la consulta de producto solicitada',
        default: 'la solicitud aprobada',
      },
      defaults: {
        scheduledFor: 'la fecha solicitada',
        currency: 'USD',
        amount: '0.00',
        productName: 'el producto solicitado',
      },
    };
  }

  return {
    templates: {
      basic_response: 'Hi, how can I help you?',
      clarification_requested_date: 'To schedule the visit, I need the requested date and time.',
      clarification_user_goal:
        'Tell me briefly what you need so I can keep going.',
      clarification_generic: 'I need a bit more context to continue.',
      execution_success_booking:
        'The booking was confirmed for {{scheduledFor}}.',
      execution_success_quote:
        'The preliminary quote was created for {{currency}} {{estimatedTotal}}.',
      execution_success_product: 'I found {{name}} for {{currency}} {{price}}.',
      execution_success_generic:
        'The requested action was executed successfully.',
      execution_failure_unknown_tool:
        'I could not complete {{actionLabel}} because the approved capability is not available.',
      execution_failure_validation:
        'I could not complete {{actionLabel}} with the available information.',
      execution_failure_generic:
        'I could not complete {{actionLabel}} because of an execution error.',
      document_not_found:
        'I could not find relevant information about that in the active documents.',
    },
    templateVariants: {
      basic_response: [
        'Hi, how can I help you?',
        "Tell me what you need and I'll take it from there.",
        "Let me know what you'd like to sort out.",
      ],
      clarification_requested_date: [
        'To schedule the visit, I need the requested date and time.',
        "Tell me the day and time that work for you so I can schedule the visit.",
        "Let me know when you'd like the visit and I'll keep going.",
      ],
      clarification_user_goal: [
        'Tell me briefly what you need so I can keep going.',
        "Let me know what you want to solve and I'll continue from there.",
        'I need a bit more detail about what you need so I can move forward.',
      ],
      clarification_generic: [
        'I need a bit more context to continue.',
        "Share a little more detail and I'll keep going.",
        'Tell me a bit more so I can move forward.',
      ],
      document_not_found: [
        'I could not find relevant information about that in the active documents.',
      ],
    },
    actionLabels: {
      create_booking: 'the requested booking',
      create_quote: 'the requested quote',
      get_product: 'the requested product lookup',
      default: 'the approved request',
    },
    defaults: {
      scheduledFor: 'the requested date',
      currency: 'USD',
      amount: '0.00',
      productName: 'the requested product',
    },
  };
}

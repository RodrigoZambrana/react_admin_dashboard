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
      }),
    ).resolves.toBe('Encontre Beacon Desk Lamp por USD 89.00.');
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
      }),
    ).resolves.toBe(
      'No pude completar la reserva solicitada con la informacion disponible.',
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
      }),
    ).resolves.toBe(
      'I could not complete the requested product lookup because the approved capability is not available.',
    );
  });
});

function buildCatalog(locale?: string) {
  if ((locale ?? '').toLowerCase().startsWith('es')) {
    return {
      templates: {
        basic_response: 'Entiendo. Como puedo ayudarte?',
        clarification_requested_date:
          'Necesito la fecha deseada para continuar.',
        clarification_user_goal:
          'Necesito entender mejor lo que necesitas para continuar.',
        clarification_generic: 'Necesito un poco mas de contexto para continuar.',
        execution_success_booking:
          'La reserva fue confirmada para {{scheduledFor}}.',
        execution_success_quote:
          'La cotizacion preliminar fue creada por {{currency}} {{estimatedTotal}}.',
        execution_success_product: 'Encontre {{name}} por {{currency}} {{price}}.',
        execution_success_generic:
          'La accion solicitada fue ejecutada correctamente.',
        execution_failure_unknown_tool:
          'No pude completar {{actionLabel}} porque la capacidad aprobada no esta disponible.',
        execution_failure_validation:
          'No pude completar {{actionLabel}} con la informacion disponible.',
        execution_failure_generic:
          'No pude completar {{actionLabel}} por un error durante la ejecucion.',
      },
      actionLabels: {
        create_booking: 'la reserva solicitada',
        create_quote: 'la cotizacion solicitada',
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
      basic_response: 'Hello, how can I help you?',
      clarification_requested_date: 'I need the requested date to continue.',
      clarification_user_goal:
        'I need to better understand what you need to continue.',
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

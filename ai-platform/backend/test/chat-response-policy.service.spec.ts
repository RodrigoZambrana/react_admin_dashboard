import { ChatResponsePolicyService } from '../src/modules/response/chat-response-policy.service';

describe('ChatResponsePolicyService', () => {
  const service = new ChatResponsePolicyService();

  it('returns a grounded booking confirmation after successful execution', () => {
    expect(
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
    ).toBe('La reserva fue confirmada para 2026-04-04T12:00:00.000Z.');
  });

  it('returns a grounded quote confirmation after successful execution', () => {
    expect(
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
    ).toBe('The preliminary quote was created for USD 144.00.');
  });

  it('returns a grounded product result after successful execution', () => {
    expect(
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
    ).toBe('Encontre Beacon Desk Lamp por USD 89.00.');
  });

  it('returns a deterministic validation failure response without claiming success', () => {
    expect(
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
    ).toBe(
      'No pude completar la reserva solicitada con la informacion disponible.',
    );
  });

  it('returns a deterministic unknown-tool failure response without claiming success', () => {
    expect(
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
    ).toBe(
      'I could not complete the requested product lookup because the approved capability is not available.',
    );
  });
});

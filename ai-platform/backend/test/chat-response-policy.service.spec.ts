import { ChatResponsePolicyService } from '../src/modules/api/chat-response-policy.service';

describe('ChatResponsePolicyService', () => {
  const service = new ChatResponsePolicyService();

  it('returns a grounded booking confirmation after successful execution', () => {
    expect(
      service.resolve({
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'create_booking',
          reasonCode: 'booking_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.booking.confirmation',
        },
        execution: {
          ok: true,
          toolName: 'create_booking',
          validatedInput: {
            requestedDateIso: '2026-04-04T12:00:00.000Z',
          },
          payload: {
            bookingId: 'bk_12345678',
            scheduledFor: '2026-04-04T12:00:00.000Z',
            status: 'confirmed',
          },
          durationMs: 4,
        },
        message: 'Reservar para manana',
        locale: 'es',
      }),
    ).toBe('La reserva fue confirmada para 2026-04-04T12:00:00.000Z.');
  });

  it('returns a grounded quote confirmation after successful execution', () => {
    expect(
      service.resolve({
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'create_quote',
          reasonCode: 'quote_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.quote.confirmation',
        },
        execution: {
          ok: true,
          toolName: 'create_quote',
          validatedInput: {
            requestSummary: 'Need a quote',
          },
          payload: {
            quoteId: 'qt_12345678',
            estimatedTotal: 144,
            currency: 'USD',
            status: 'drafted',
          },
          durationMs: 3,
        },
        message: 'Need a quote',
        locale: 'en',
      }),
    ).toBe('The preliminary quote was created for USD 144.00.');
  });

  it('returns a grounded product result after successful execution', () => {
    expect(
      service.resolve({
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'get_product',
          reasonCode: 'product_lookup_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.ecommerce.product_result',
        },
        execution: {
          ok: true,
          toolName: 'get_product',
          validatedInput: {
            query: 'Beacon Desk Lamp',
          },
          payload: {
            sku: 'B-77',
            name: 'Beacon Desk Lamp',
            price: 89,
            currency: 'USD',
          },
          durationMs: 2,
        },
        message: 'Beacon Desk Lamp',
        locale: 'es',
      }),
    ).toBe('Encontre Beacon Desk Lamp por USD 89.00.');
  });

  it('returns a deterministic validation failure response without claiming success', () => {
    expect(
      service.resolve({
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'create_booking',
          reasonCode: 'booking_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.booking.confirmation',
        },
        execution: {
          ok: false,
          toolName: 'create_booking',
          validatedInput: null,
          errorCode: 'validation_failed',
          errorMessage: 'Tool input validation failed.',
          durationMs: null,
        },
        message: 'Reservar',
        locale: 'es',
      }),
    ).toBe(
      'No pude completar la reserva solicitada con la informacion disponible.',
    );
  });

  it('returns a deterministic unknown-tool failure response without claiming success', () => {
    expect(
      service.resolve({
        decision: {
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'get_product',
          reasonCode: 'product_lookup_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.ecommerce.product_result',
        },
        execution: {
          ok: false,
          toolName: 'missing_tool',
          validatedInput: null,
          errorCode: 'unknown_tool',
          errorMessage: 'Unknown tool',
          durationMs: null,
        },
        message: 'do the thing',
        locale: 'en',
      }),
    ).toBe(
      'I could not complete the requested product lookup because the approved capability is not available.',
    );
  });
});

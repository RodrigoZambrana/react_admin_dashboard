import { ApprovedResponseContextService } from '../src/modules/response/approved-response-context.service';
import { ResponseGroundingService } from '../src/modules/response/response-grounding.service';

describe('ApprovedResponseContextService', () => {
  it('reduces raw document excerpt exposure for combined execution responses', () => {
    const service = new ApprovedResponseContextService(
      new ResponseGroundingService(),
    );

    const context = service.build({
      message:
        'Según el documento, ¿cubren cambio de cadena? Si sí, agendame una visita para mañana a las 11.',
      interpretation: {
        intent: 'CREATE_BOOKING',
        language: 'es',
        confidence: 0.95,
        entities: {
          rawMessage:
            'Según el documento, ¿cubren cambio de cadena? Si sí, agendame una visita para mañana a las 11.',
        },
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      } as any,
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
          requestedDateIso: '2026-04-05T11:00:00.000Z',
        },
        payload: {
          bookingId: 'bk-1',
          scheduledFor: '2026-04-05T11:00:00.000Z',
          status: 'confirmed',
        },
        durationMs: 12,
      } as any,
      continuity: {
        applied: false,
        activeLane: 'booking',
        carriedFactKeys: [],
        invalidatedFactKeys: [],
        missingFields: [],
        previousStateSummary: null,
      },
      conversationState: null,
      documentContext: {
        source: 'document_origin',
        query: 'cambio de cadena roller',
        groundedSummary:
          'El documento indica que el cambio de cadena de cortinas roller está cubierto dentro del servicio estándar.',
        matches: [
          {
            documentId: 'doc-1',
            title: 'Cobertura Roller',
            excerpt:
              'El cambio de cadena de cortinas roller está cubierto dentro del servicio estándar y el catálogo agrega recomendaciones de mantenimiento complementarias.',
            sequence: 0,
            score: 4.4,
          },
        ],
      },
    });

    expect(context.documentContext).toEqual(
      expect.objectContaining({
        groundedSummary:
          'El documento indica que el cambio de cadena de cortinas roller está cubierto dentro del servicio estándar.',
        responseMode: 'combined_execution',
        grounding: expect.objectContaining({
          supportLevel: 'partial',
          requestedDetailTypes: ['coverage_support'],
          unsupportedDetailTypes: ['coverage_support'],
        }),
        matches: [
          expect.not.objectContaining({
            excerpt: expect.any(String),
          }),
        ],
      }),
    );
  });
});

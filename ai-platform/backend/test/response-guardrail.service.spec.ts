import { ResponseGuardrailService } from '../src/modules/response/response-guardrail.service';
import { ApprovedResponseContext } from '../src/modules/response/response.types';

describe('ResponseGuardrailService', () => {
  const service = new ResponseGuardrailService();

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
});

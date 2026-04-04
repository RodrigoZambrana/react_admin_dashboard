import { ChatResponseService } from '../src/modules/response/chat-response.service';

describe('ChatResponseService', () => {
  const baseInput = {
    message: 'Reservar',
    interpretation: {
      intent: 'CREATE_BOOKING',
      entities: {
        rawMessage: 'Reservar',
      },
      language: 'es',
      confidence: 0.91,
      normalizedEntities: {
        dates: [],
        measurements: [],
        dimensions: [],
      },
    },
    decision: {
      domain: 'core',
      action: 'clarify',
      reasonCode: 'booking_missing_fields',
      missingFields: ['requested_date'],
      responseTemplateKey: 'core.clarification',
    },
    execution: null,
    continuity: {
      applied: false,
      activeLane: 'booking',
      carriedFactKeys: [],
      invalidatedFactKeys: [],
      missingFields: ['requested_date'],
      nextUsefulField: 'requested_date',
      previousStateSummary: {
        lane: 'booking',
        missingFields: ['requested_date'],
        nextUsefulField: 'requested_date',
        lastApprovedAction: 'clarify',
      },
    },
    conversationState: {
      conversationId: 'conv-1',
      lane: 'booking',
      missingFields: ['requested_date'],
      nextUsefulField: 'requested_date',
      lastApprovedAction: 'clarify',
    },
  } as const;

  it('falls back deterministically when response generation fails', async () => {
    const service = new ChatResponseService(
      {
        build: jest.fn(() => ({
          locale: 'es',
          userMessage: 'Reservar',
          intent: 'CREATE_BOOKING',
          outcome: 'clarify',
          decision: baseInput.decision,
          interpretation: {
            language: 'es',
            confidence: 0.91,
            entities: {
              rawMessage: 'Reservar',
            },
            normalizedEntities: {
              dates: [],
              measurements: [],
              dimensions: [],
            },
          },
          execution: {
            status: 'not_applicable',
            toolName: 'create_booking',
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          missingFields: ['requested_date'],
          nextUsefulField: 'requested_date',
          approvedFactKeys: [],
          approvedResultKeys: [],
        })),
      } as any,
      {
        resolve: jest.fn(() => 'Necesito la fecha deseada para continuar.'),
      } as any,
      {
        generateResponse: jest.fn(async () => ({
          ok: false,
          rawResponse: null,
          parsedResponse: null,
          error: 'provider unavailable',
          provider: 'mock',
          model: 'mock-rule-engine',
          promptId: null,
          promptVersion: null,
        })),
      } as any,
      {
        evaluate: jest.fn(),
      } as any,
    );

    await expect(service.generate(baseInput as any)).resolves.toEqual(
      expect.objectContaining({
        response: 'Necesito la fecha deseada para continuar.',
        usedFallback: true,
        fallbackReason: 'generation_failed',
        generation: expect.objectContaining({
          error: 'provider unavailable',
        }),
      }),
    );
  });

  it('falls back when guardrails reject fabricated AI output', async () => {
    const service = new ChatResponseService(
      {
        build: jest.fn(() => ({
          locale: 'es',
          userMessage: 'Reservar',
          intent: 'CREATE_BOOKING',
          outcome: 'clarify',
          decision: baseInput.decision,
          interpretation: {
            language: 'es',
            confidence: 0.91,
            entities: {
              rawMessage: 'Reservar',
            },
            normalizedEntities: {
              dates: [],
              measurements: [],
              dimensions: [],
            },
          },
          execution: {
            status: 'not_applicable',
            toolName: 'create_booking',
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          missingFields: ['requested_date'],
          nextUsefulField: 'requested_date',
          approvedFactKeys: [],
          approvedResultKeys: [],
        })),
      } as any,
      {
        resolve: jest.fn(() => 'Necesito la fecha deseada para continuar.'),
      } as any,
      {
        generateResponse: jest.fn(async () => ({
          ok: true,
          rawResponse:
            '{"message":"La reserva fue confirmada.","assertedOutcome":"execution_succeeded","assertedExecutionStatus":"succeeded","mentionedMissingFields":[],"mentionedApprovedFactKeys":[],"mentionedApprovedResultKeys":["bookingId"]}',
          parsedResponse: {
            message: 'La reserva fue confirmada.',
            assertedOutcome: 'execution_succeeded',
            assertedExecutionStatus: 'succeeded',
            mentionedMissingFields: [],
            mentionedApprovedFactKeys: [],
            mentionedApprovedResultKeys: ['bookingId'],
          },
          error: null,
          provider: 'mock',
          model: 'mock-rule-engine',
          promptId: null,
          promptVersion: null,
        })),
      } as any,
      {
        evaluate: jest.fn(() => ({
          accepted: false,
          reasons: ['outcome_mismatch', 'unsupported_result_keys'],
        })),
      } as any,
    );

    await expect(service.generate(baseInput as any)).resolves.toEqual(
      expect.objectContaining({
        response: 'Necesito la fecha deseada para continuar.',
        usedFallback: true,
        fallbackReason: 'guardrail_rejected',
        generation: expect.objectContaining({
          guardrails: {
            accepted: false,
            reasons: ['outcome_mismatch', 'unsupported_result_keys'],
          },
        }),
      }),
    );
  });
});

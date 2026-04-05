import { ChatResponseService } from '../src/modules/response/chat-response.service';

describe('ChatResponseService', () => {
  const clarifyInput = {
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

  const buildClarifyContext = () => ({
    locale: 'es',
    userMessage: 'Reservar',
    intent: 'CREATE_BOOKING',
    outcome: 'clarify' as const,
    decision: clarifyInput.decision,
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
      status: 'not_applicable' as const,
      toolName: 'create_booking',
      validatedInputSummary: null,
      resultSummary: null,
      failure: null,
    },
    missingFields: ['requested_date'],
    nextUsefulField: 'requested_date',
    approvedFactKeys: [],
    approvedResultKeys: [],
  });

  const executionInput = {
    message: 'Necesito una cotizacion para 2 metros',
    interpretation: {
      intent: 'CREATE_QUOTE',
      entities: {
        rawMessage: 'Necesito una cotizacion para 2 metros',
      },
      language: 'es',
      confidence: 0.93,
      normalizedEntities: {
        dates: [],
        measurements: [
          {
            source: '2 m',
            value: 2,
            unit: 'm',
            normalizedValue: 2,
            normalizedUnit: 'm',
            kind: 'length',
          },
        ],
        dimensions: [],
      },
    },
    decision: {
      domain: 'tenant',
      action: 'invoke_tool',
      toolName: 'create_quote',
      reasonCode: 'quote_requested',
      missingFields: [],
      responseTemplateKey: 'tenant.quote.confirmation',
    },
    execution: {
      ok: true as const,
      toolName: 'create_quote',
      validatedInput: {
        requestSummary: 'Necesito una cotizacion para 2 metros',
      },
      payload: {
        quoteId: 'qt_123',
        estimatedTotal: 144,
        currency: 'USD',
        status: 'drafted',
      },
      durationMs: 3,
    },
    continuity: {
      applied: false,
      activeLane: 'quote',
      carriedFactKeys: [],
      invalidatedFactKeys: [],
      missingFields: [],
      previousStateSummary: null,
    },
    conversationState: {
      conversationId: 'conv-2',
      lane: 'quote',
      missingFields: [],
      lastApprovedAction: 'invoke_tool',
      lastApprovedToolName: 'create_quote',
      lastApprovedResult: {
        quoteId: 'qt_123',
        estimatedTotal: 144,
        currency: 'USD',
        status: 'drafted',
      },
    },
  } as const;

  const buildExecutionContext = () => ({
    locale: 'es',
    userMessage: 'Necesito una cotizacion para 2 metros',
    intent: 'CREATE_QUOTE',
    outcome: 'execution_succeeded' as const,
    decision: executionInput.decision,
    interpretation: {
      language: 'es',
      confidence: 0.93,
      entities: {
        rawMessage: 'Necesito una cotizacion para 2 metros',
      },
      normalizedEntities: executionInput.interpretation.normalizedEntities,
    },
    execution: {
      status: 'succeeded' as const,
      toolName: 'create_quote',
      validatedInputSummary: {
        requestSummary: 'Necesito una cotizacion para 2 metros',
      },
      resultSummary: {
        quoteId: 'qt_123',
        estimatedTotal: 144,
        currency: 'USD',
        status: 'drafted',
      },
      failure: null,
    },
    approvedFactKeys: [],
    approvedResultKeys: ['quoteId', 'estimatedTotal', 'currency', 'status'],
  });

  it('returns AI wording over approved execution truth when guardrails accept it', async () => {
    const service = new ChatResponseService(
      {
        build: jest.fn(buildExecutionContext),
      } as any,
      {
        resolve: jest.fn(
          () => 'La cotizacion preliminar fue creada por USD 144.00.',
        ),
      } as any,
      {
        generateResponse: jest.fn(async () => ({
          ok: true,
          rawResponse:
            '{"message":"Ya tengo una cotizacion preliminar por USD 144.00.","assertedOutcome":"execution_succeeded","assertedExecutionStatus":"succeeded","mentionedMissingFields":[],"mentionedApprovedFactKeys":[],"mentionedApprovedResultKeys":["estimatedTotal","currency","status"]}',
          parsedResponse: {
            message: 'Ya tengo una cotizacion preliminar por USD 144.00.',
            assertedOutcome: 'execution_succeeded',
            assertedExecutionStatus: 'succeeded',
            mentionedMissingFields: [],
            mentionedApprovedFactKeys: [],
            mentionedApprovedResultKeys: ['estimatedTotal', 'currency', 'status'],
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
          accepted: true,
          reasons: [],
        })),
      } as any,
    );

    await expect(service.generate(executionInput as any)).resolves.toEqual(
      expect.objectContaining({
        response: 'Ya tengo una cotizacion preliminar por USD 144.00.',
        usedFallback: false,
        fallbackReason: null,
      }),
    );
  });

  it('returns AI clarification wording over backend-approved missing fields', async () => {
    const service = new ChatResponseService(
      {
        build: jest.fn(buildClarifyContext),
      } as any,
      {
        resolve: jest.fn(() => 'Necesito la fecha deseada para continuar.'),
      } as any,
      {
        generateResponse: jest.fn(async () => ({
          ok: true,
          rawResponse:
            '{"message":"Para continuar, indicame la fecha deseada.","assertedOutcome":"clarify","assertedExecutionStatus":"not_applicable","mentionedMissingFields":["requested_date"],"mentionedApprovedFactKeys":[],"mentionedApprovedResultKeys":[]}',
          parsedResponse: {
            message: 'Para continuar, indicame la fecha deseada.',
            assertedOutcome: 'clarify',
            assertedExecutionStatus: 'not_applicable',
            mentionedMissingFields: ['requested_date'],
            mentionedApprovedFactKeys: [],
            mentionedApprovedResultKeys: [],
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
          accepted: true,
          reasons: [],
        })),
      } as any,
    );

    await expect(service.generate(clarifyInput as any)).resolves.toEqual(
      expect.objectContaining({
        response: 'Para continuar, indicame la fecha deseada.',
        usedFallback: false,
        fallbackReason: null,
      }),
    );
  });

  it('falls back deterministically when response generation fails', async () => {
    const service = new ChatResponseService(
      {
        build: jest.fn(buildClarifyContext),
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

    await expect(service.generate(clarifyInput as any)).resolves.toEqual(
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
        build: jest.fn(buildClarifyContext),
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

    await expect(service.generate(clarifyInput as any)).resolves.toEqual(
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

  it('locks to the approved draft when grounded knowledge is unavailable and generic fill-in would be unsafe', async () => {
    const service = new ChatResponseService(
      {
        build: jest.fn(() => ({
          ...buildClarifyContext(),
          outcome: 'respond',
          decision: {
            domain: 'core',
            action: 'respond',
            reasonCode: 'document_grounded_exploration',
            missingFields: [],
            responseTemplateKey: 'core.general_response',
          },
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          documentContext: {
            source: 'document_origin',
            query: 'tipos de cortinas roller',
            groundedSummary: '',
            responseMode: 'document_exploration',
            grounding: {
              supportLevel: 'unavailable',
              exactnessRequested: false,
              requestedDetailTypes: ['specific_variants'],
              supportedDetailTypes: [],
              partialDetailTypes: [],
              unsupportedDetailTypes: ['specific_variants'],
            },
            matches: [],
          },
          responseStyle: {
            preferBrief: true,
            incrementalFollowUp: true,
            groundedKnowledgeOnly: true,
          },
        })),
      } as any,
      {
        resolve: jest.fn(() => 'Por ahora no tengo una confirmación clara sobre eso.'),
      } as any,
      {
        generateResponse: jest.fn(),
      } as any,
      {
        evaluate: jest.fn(),
      } as any,
    );

    await expect(service.generate(clarifyInput as any)).resolves.toEqual(
      expect.objectContaining({
        response: 'Por ahora no tengo una confirmación clara sobre eso.',
        usedFallback: true,
        fallbackReason: 'policy_locked',
      }),
    );
  });
});

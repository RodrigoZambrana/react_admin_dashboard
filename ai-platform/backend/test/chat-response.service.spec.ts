import { ChatResponseService } from '../src/modules/response/chat-response.service';

describe('ChatResponseService', () => {
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
      responseFallbackService as any,
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
      responseFallbackService as any,
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
      responseFallbackService as any,
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
      responseFallbackService as any,
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

  it('locks close_turn responses to the approved draft and skips AI generation', async () => {
    const generateResponse = jest.fn();
    const service = new ChatResponseService(
      {
        build: jest.fn(() => ({
          ...buildClarifyContext(),
          userMessage: 'Perfecto muchas gracias por su ayuda',
          outcome: 'close_turn',
          decision: {
            domain: 'core',
            action: 'close_turn',
            reasonCode: 'contextual_close_acknowledged',
            missingFields: [],
            responseTemplateKey: 'core.close_turn',
          },
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
            includeInitialGreeting: false,
            preferMultiline: false,
            hasPriorConversation: true,
          },
          documentContext: undefined,
          approvedDocumentIds: [],
        })),
      } as any,
      {
        resolve: jest.fn(
          () => 'Gracias por escribir. Quedamos a disposición por cualquier otra duda.',
        ),
      } as any,
      {
        generateResponse,
      } as any,
      {
        evaluate: jest.fn(),
      } as any,
      responseFallbackService as any,
    );

    await expect(service.generate(clarifyInput as any)).resolves.toEqual(
      expect.objectContaining({
        response:
          'Gracias por escribir. Quedamos a disposición por cualquier otra duda.',
        usedFallback: true,
        fallbackReason: 'policy_locked',
      }),
    );
    expect(generateResponse).not.toHaveBeenCalled();
  });

  it('keeps the AI response path open for ordinary document turns even when support is unavailable', async () => {
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
            groundedKnowledgeOnly: false,
            hasPriorConversation: true,
          },
        })),
      } as any,
      {
        resolve: jest.fn(() => 'Por ahora no tengo una confirmación clara sobre eso.'),
      } as any,
      {
        generateResponse: jest.fn(async () => ({
          ok: true,
          rawResponse:
            '{"message":"Por ahora no veo el detalle exacto, pero si querés lo revisamos sobre una opción puntual.","assertedOutcome":"respond","assertedExecutionStatus":"not_applicable","mentionedMissingFields":[],"mentionedApprovedFactKeys":[],"mentionedApprovedResultKeys":[],"mentionedDocumentIds":[]}',
          parsedResponse: {
            message:
              'Por ahora no veo el detalle exacto, pero si querés lo revisamos sobre una opción puntual.',
            assertedOutcome: 'respond',
            assertedExecutionStatus: 'not_applicable',
            mentionedMissingFields: [],
            mentionedApprovedFactKeys: [],
            mentionedApprovedResultKeys: [],
            mentionedDocumentIds: [],
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
      responseFallbackService as any,
    );

    await expect(service.generate(clarifyInput as any)).resolves.toEqual(
      expect.objectContaining({
        response:
          'Por ahora no veo el detalle exacto, pero si querés lo revisamos sobre una opción puntual.',
        usedFallback: false,
        fallbackReason: null,
      }),
    );
  });

  it('keeps a contextual greeting and multiline layout when the approved draft requires an opening service tone', async () => {
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
          responseStyle: {
            preferBrief: true,
            incrementalFollowUp: false,
            groundedKnowledgeOnly: false,
            includeInitialGreeting: true,
            preferMultiline: true,
            hasPriorConversation: false,
          },
          approvedDocumentIds: ['doc-1'],
          approvedFactKeys: [],
          approvedResultKeys: [],
          documentContext: {
            source: 'document_origin',
            query: 'cortinas roller',
            groundedSummary: 'Sí, tenemos cortinas roller.',
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
        })),
      } as any,
      {
        resolve: jest.fn(
          () =>
            'Hola, gracias por contactarnos.\n\nSí, tenemos cortinas roller.\n\n¿Buscás algún tipo en particular?',
        ),
      } as any,
      {
        generateResponse: jest.fn(async () => ({
          ok: true,
          rawResponse:
            '{"message":"Sí, tenemos cortinas roller. ¿Buscás algún tipo en particular?","assertedOutcome":"respond","assertedExecutionStatus":"not_applicable","mentionedMissingFields":[],"mentionedApprovedFactKeys":[],"mentionedApprovedResultKeys":[],"mentionedDocumentIds":["doc-1"]}',
          parsedResponse: {
            message: 'Sí, tenemos cortinas roller. ¿Buscás algún tipo en particular?',
            assertedOutcome: 'respond',
            assertedExecutionStatus: 'not_applicable',
            mentionedMissingFields: [],
            mentionedApprovedFactKeys: [],
            mentionedApprovedResultKeys: [],
            mentionedDocumentIds: ['doc-1'],
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
      responseFallbackService as any,
    );

    await expect(service.generate(clarifyInput as any)).resolves.toEqual(
      expect.objectContaining({
        response:
          'Hola, gracias por contactarnos.\n\nSí, tenemos cortinas roller.\n\n¿Buscás algún tipo en particular?',
        usedFallback: false,
      }),
    );
  });

  it('falls back to the approved draft when a follow-up turn adds a fresh greeting', async () => {
    const service = new ChatResponseService(
      {
        build: jest.fn(() => ({
          ...buildClarifyContext(),
          userMessage: 'buenismo te agradezco la ayuda. Como se hace para coordinar visita?',
          outcome: 'clarify',
          decision: {
            domain: 'core',
            action: 'clarify',
            reasonCode: 'booking_missing_fields',
            missingFields: ['requested_date'],
            responseTemplateKey: 'core.clarification',
          },
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
            includeInitialGreeting: false,
            preferMultiline: false,
            hasPriorConversation: true,
          },
          approvedDocumentIds: [],
          approvedFactKeys: [],
          approvedResultKeys: [],
        })),
      } as any,
      {
        resolve: jest.fn(() => 'Indicame cuándo te queda bien la visita y sigo con eso.'),
      } as any,
      {
        generateResponse: jest.fn(async () => ({
          ok: true,
          rawResponse:
            '{"message":"Hola, gracias por contactarnos. Indicame cuándo te queda bien la visita y sigo con eso.","assertedOutcome":"clarify","assertedExecutionStatus":"not_applicable","mentionedMissingFields":["requested_date"],"mentionedApprovedFactKeys":[],"mentionedApprovedResultKeys":[],"mentionedDocumentIds":[]}',
          parsedResponse: {
            message:
              'Hola, gracias por contactarnos. Indicame cuándo te queda bien la visita y sigo con eso.',
            assertedOutcome: 'clarify',
            assertedExecutionStatus: 'not_applicable',
            mentionedMissingFields: ['requested_date'],
            mentionedApprovedFactKeys: [],
            mentionedApprovedResultKeys: [],
            mentionedDocumentIds: [],
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
          reasons: ['unexpected_followup_greeting'],
        })),
      } as any,
      responseFallbackService as any,
    );

    await expect(service.generate(clarifyInput as any)).resolves.toEqual(
      expect.objectContaining({
        response: 'Indicame cuándo te queda bien la visita y sigo con eso.',
        usedFallback: true,
        fallbackReason: 'guardrail_rejected',
      }),
    );
  });

  it('salvages a grounded AI response by stripping only the duplicate opening greeting', async () => {
    const evaluate = jest.fn(({ generatedResponse }) => {
      if (generatedResponse.message.startsWith('Hola, gracias por contactarnos.')) {
        return {
          accepted: false,
          reasons: ['duplicate_opening_greeting'],
        };
      }

      return {
        accepted: true,
        reasons: [],
      };
    });
    const service = new ChatResponseService(
      {
        build: jest.fn(() => ({
          ...buildClarifyContext(),
          userMessage: 'Que medios de pago aceptan?',
          intent: 'GENERAL_CONVERSATION',
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
          responseStyle: {
            preferBrief: true,
            incrementalFollowUp: false,
            groundedKnowledgeOnly: false,
            includeInitialGreeting: true,
            preferMultiline: true,
            hasPriorConversation: false,
          },
          approvedDocumentIds: ['doc-1'],
          approvedFactKeys: [],
          approvedResultKeys: [],
          documentContext: {
            source: 'document_origin',
            query: 'medios de pago',
            groundedSummary: 'Medios de pago: Mercado Pago',
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
        })),
      } as any,
      {
        resolve: jest.fn(
          () =>
            'Hola, gracias por contactarnos.\n\nMedios de pago: Mercado Pago.',
        ),
      } as any,
      {
        generateResponse: jest.fn(async () => ({
          ok: true,
          rawResponse: '{}',
          parsedResponse: {
            message:
              'Hola, gracias por contactarnos. Aceptamos transferencia bancaria, efectivo, Mercado Pago y tarjetas.',
            assertedOutcome: 'respond',
            assertedExecutionStatus: 'not_applicable',
            mentionedMissingFields: [],
            mentionedApprovedFactKeys: [],
            mentionedApprovedResultKeys: [],
            mentionedDocumentIds: ['doc-1'],
          },
          error: null,
          provider: 'mock',
          model: 'mock-rule-engine',
          promptId: null,
          promptVersion: null,
        })),
      } as any,
      {
        evaluate,
      } as any,
      responseFallbackService as any,
    );

    await expect(service.generate(clarifyInput as any)).resolves.toEqual(
      expect.objectContaining({
        response:
          'Hola, gracias por contactarnos.\n\nAceptamos transferencia bancaria, efectivo, Mercado Pago y tarjetas.',
        usedFallback: false,
        fallbackReason: null,
      }),
    );
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('salvages a grounded AI response when the duplicate greeting is inline with the answer sentence', async () => {
    const evaluate = jest.fn(({ generatedResponse }) => {
      if (generatedResponse.message.startsWith('Hola, sí')) {
        return {
          accepted: false,
          reasons: ['duplicate_opening_greeting'],
        };
      }

      return {
        accepted: true,
        reasons: [],
      };
    });
    const service = new ChatResponseService(
      {
        build: jest.fn(() => ({
          ...buildClarifyContext(),
          userMessage: 'tienen cortina de enrollar en aluminio?',
          intent: 'GENERAL_CONVERSATION',
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
          responseStyle: {
            preferBrief: true,
            incrementalFollowUp: false,
            groundedKnowledgeOnly: false,
            includeInitialGreeting: true,
            preferMultiline: true,
            hasPriorConversation: false,
          },
          approvedDocumentIds: ['doc-1'],
          approvedFactKeys: [],
          approvedResultKeys: [],
          documentContext: {
            source: 'document_origin',
            query: 'cortina de enrollar en aluminio',
            groundedSummary:
              'Materiales (cortinas de enrollar): aluminio',
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
        })),
      } as any,
      {
        resolve: jest.fn(
          () => 'Hola, gracias por contactarnos.\n\nSí, trabajamos con cortina de enrollar en aluminio.',
        ),
      } as any,
      {
        generateResponse: jest.fn(async () => ({
          ok: true,
          rawResponse: '{}',
          parsedResponse: {
            message:
              'Hola, sí contamos con cortina de enrollar en aluminio, que es una opción robusta y durable.',
            assertedOutcome: 'respond',
            assertedExecutionStatus: 'not_applicable',
            mentionedMissingFields: [],
            mentionedApprovedFactKeys: [],
            mentionedApprovedResultKeys: [],
            mentionedDocumentIds: ['doc-1'],
          },
          error: null,
          provider: 'mock',
          model: 'mock-rule-engine',
          promptId: null,
          promptVersion: null,
        })),
      } as any,
      {
        evaluate,
      } as any,
      responseFallbackService as any,
    );

    await expect(service.generate(clarifyInput as any)).resolves.toEqual(
      expect.objectContaining({
        response:
          'Hola, gracias por contactarnos.\n\nSí contamos con cortina de enrollar en aluminio, que es una opción robusta y durable.',
        usedFallback: false,
        fallbackReason: null,
      }),
    );
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('normalizes unsupported provenance references before evaluating guardrails', async () => {
    const evaluate = jest.fn(({ generatedResponse }) => {
      expect(generatedResponse.mentionedApprovedFactKeys).toEqual([]);
      expect(generatedResponse.mentionedDocumentIds).toEqual(['doc-1']);

      return {
        accepted: true,
        reasons: [],
      };
    });
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
          responseStyle: {
            preferBrief: true,
            incrementalFollowUp: false,
            groundedKnowledgeOnly: false,
            includeInitialGreeting: true,
            preferMultiline: true,
            hasPriorConversation: false,
          },
          approvedDocumentIds: ['doc-1'],
          approvedFactKeys: ['lastGroundedSummary'],
          approvedResultKeys: [],
          documentContext: {
            source: 'document_origin',
            query: 'cortinas roller',
            groundedSummary: 'Sí, tenemos cortinas roller.',
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
        })),
      } as any,
      {
        resolve: jest.fn(
          () =>
            'Hola, gracias por contactarnos.\n\nSí, tenemos cortinas roller.\n\n¿Buscás algún tipo en particular?',
        ),
      } as any,
      {
        generateResponse: jest.fn(async () => ({
          ok: true,
          rawResponse: '{}',
          parsedResponse: {
            message:
              'Hola, gracias por contactarnos. Sí, tenemos cortinas roller. ¿Buscás algún tipo en particular?',
            assertedOutcome: 'respond',
            assertedExecutionStatus: 'not_applicable',
            mentionedMissingFields: [],
            mentionedApprovedFactKeys: ['doc-1'],
            mentionedApprovedResultKeys: [],
            mentionedDocumentIds: ['doc-1'],
          },
          error: null,
          provider: 'mock',
          model: 'mock-rule-engine',
          promptId: null,
          promptVersion: null,
        })),
      } as any,
      {
        evaluate,
      } as any,
      responseFallbackService as any,
    );

    await expect(service.generate(clarifyInput as any)).resolves.toEqual(
      expect.objectContaining({
        usedFallback: false,
      }),
    );
  });
});

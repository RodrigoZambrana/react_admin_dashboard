import { ChatOrchestratorService } from '../src/modules/api/chat-orchestrator.service';

describe('ChatOrchestratorService', () => {
  it('stores a basic interaction, skips execution for respond decisions, and returns the minimal response payload', async () => {
    const traceLogService = {
      recordStage: jest.fn(async () => undefined),
    };
    const interpretationService = {
      interpret: jest.fn(async () => ({
        interpretation: {
          intent: 'GENERAL_CONVERSATION',
          entities: {},
          language: 'es',
          confidence: 0.94,
        },
        rawAiResponse:
          '{"intent":"GENERAL_CONVERSATION","entities":{},"language":"es","confidence":0.94}',
        parsedJson: {
          intent: 'GENERAL_CONVERSATION',
          entities: {},
          language: 'es',
          confidence: 0.94,
        },
        error: null,
        provider: 'mock',
        model: 'mock-rule-engine',
        usedFallback: false,
      })),
    };
    const parsingService = {
      normalize: jest.fn(async () => ({
        intent: 'GENERAL_CONVERSATION',
        entities: {},
        language: 'es',
        confidence: 0.94,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      })),
    };
    const decisionService = {
      decide: jest.fn(() => ({
        domain: 'core',
        action: 'respond',
        reasonCode: 'general_conversation',
        missingFields: [],
        responseTemplateKey: 'core.general_response',
      })),
    };
    const continuityService = {
      prepareTurn: jest.fn(async ({ interpretation }: any) => ({
        previousState: null,
        activeState: null,
        effectiveInterpretation: {
          ...interpretation,
          continuity: {
            applied: false,
            activeLane: null,
            carriedFactKeys: [],
            invalidatedFactKeys: [],
            missingFields: [],
            previousStateSummary: null,
          },
        },
        continuity: {
          applied: false,
          activeLane: null,
          carriedFactKeys: [],
          invalidatedFactKeys: [],
          missingFields: [],
          previousStateSummary: null,
        },
      })),
      persistTurnState: jest.fn(async () => null),
    };
    const toolExecutionService = {
      executeApprovedAction: jest.fn(async () => null),
    };
    const responsePolicyService = {
      resolve: jest.fn(() => 'Hello, how can I help you?'),
    };
    const memoryService = {
      getRecent: jest.fn(async () => []),
      append: jest.fn(async () => undefined),
    };

    const service = new ChatOrchestratorService(
      {
        getTraceId: () => 'trace-1',
      } as any,
      {
        findById: jest.fn(async () => null),
        createConversation: jest.fn(async () => ({ id: 'conv-1' })),
        appendMessage: jest
          .fn()
          .mockResolvedValueOnce({ id: 'msg-user-1' })
          .mockResolvedValueOnce({ id: 'msg-assistant-1' }),
        listRecent: jest.fn(async () => []),
      } as any,
      {
        listByConversation: jest.fn(async () => []),
      } as any,
      interpretationService as any,
      parsingService as any,
      continuityService as any,
      decisionService as any,
      toolExecutionService as any,
      responsePolicyService as any,
      memoryService as any,
      traceLogService as any,
    );

    const result = await service.handleMessage({
      message: 'hola',
    });

    expect(result).toEqual({
      response: 'Hello, how can I help you?',
      intent: 'GENERAL_CONVERSATION',
      entities: {},
      metadata: {
        conversationId: 'conv-1',
        traceId: 'trace-1',
      },
    });
    expect(traceLogService.recordStage).toHaveBeenCalledTimes(6);
    expect(toolExecutionService.executeApprovedAction).toHaveBeenCalledWith({
      decision: expect.objectContaining({
        action: 'respond',
      }),
      interpretation: expect.objectContaining({
        intent: 'GENERAL_CONVERSATION',
      }),
    });
    expect(continuityService.prepareTurn).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      interpretation: expect.objectContaining({
        intent: 'GENERAL_CONVERSATION',
      }),
    });
    expect(responsePolicyService.resolve).toHaveBeenCalledWith({
      decision: expect.objectContaining({
        action: 'respond',
      }),
      execution: null,
      message: 'hola',
      locale: 'es',
    });
    const hasExecutionStage = traceLogService.recordStage.mock.calls.some(
      (args: any[]) => args[0]?.stage === 'execution',
    );
    expect(hasExecutionStage).toBe(false);
  });

  it('returns a deterministic clarification when booking date evidence is missing', async () => {
    const traceLogService = {
      recordStage: jest.fn(async () => undefined),
    };
    const interpretationService = {
      interpret: jest.fn(async () => ({
        interpretation: {
          intent: 'CREATE_BOOKING',
          entities: {
            rawMessage: 'Reservar',
          },
          language: 'es',
          confidence: 0.91,
        },
        rawAiResponse: '{}',
        parsedJson: null,
        error: null,
        provider: 'mock',
        model: 'mock-rule-engine',
        usedFallback: false,
      })),
    };
    const parsingService = {
      normalize: jest.fn(async () => ({
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
      })),
    };
    const decisionService = {
      decide: jest.fn(() => ({
        domain: 'core',
        action: 'clarify',
        reasonCode: 'booking_missing_fields',
        missingFields: ['requested_date'],
        responseTemplateKey: 'core.clarification',
      })),
    };
    const continuityService = {
      prepareTurn: jest.fn(async ({ interpretation }: any) => ({
        previousState: null,
        activeState: null,
        effectiveInterpretation: {
          ...interpretation,
          continuity: {
            applied: false,
            activeLane: 'booking',
            carriedFactKeys: [],
            invalidatedFactKeys: [],
            missingFields: [],
            previousStateSummary: null,
          },
        },
        continuity: {
          applied: false,
          activeLane: 'booking',
          carriedFactKeys: [],
          invalidatedFactKeys: [],
          missingFields: [],
          previousStateSummary: null,
        },
      })),
      persistTurnState: jest.fn(async () => ({
        lane: 'booking',
        missingFields: ['requested_date'],
        nextUsefulField: 'requested_date',
      })),
    };
    const toolExecutionService = {
      executeApprovedAction: jest.fn(async () => null),
    };
    const responsePolicyService = {
      resolve: jest.fn(() => 'Necesito la fecha deseada para continuar.'),
    };
    const memoryService = {
      getRecent: jest.fn(async () => []),
      append: jest.fn(async () => undefined),
    };

    const service = new ChatOrchestratorService(
      {
        getTraceId: () => 'trace-booking-clarify',
      } as any,
      {
        findById: jest.fn(async () => null),
        createConversation: jest.fn(async () => ({ id: 'conv-2' })),
        appendMessage: jest
          .fn()
          .mockResolvedValueOnce({ id: 'msg-user-2' })
          .mockResolvedValueOnce({ id: 'msg-assistant-2' }),
        listRecent: jest.fn(async () => []),
      } as any,
      {
        listByConversation: jest.fn(async () => []),
      } as any,
      interpretationService as any,
      parsingService as any,
      continuityService as any,
      decisionService as any,
      toolExecutionService as any,
      responsePolicyService as any,
      memoryService as any,
      traceLogService as any,
    );

    const result = await service.handleMessage({
      message: 'Reservar',
      locale: 'es',
    });

    expect(result).toEqual({
      response: 'Necesito la fecha deseada para continuar.',
      intent: 'CREATE_BOOKING',
      entities: {
        rawMessage: 'Reservar',
      },
      metadata: {
        conversationId: 'conv-2',
        traceId: 'trace-booking-clarify',
      },
    });
    const hasExecutionStage = traceLogService.recordStage.mock.calls.some(
      (args: any[]) => args[0]?.stage === 'execution',
    );
    expect(hasExecutionStage).toBe(false);
  });

  it('logs the execution stage and returns a deterministic execution-aware response for tool decisions', async () => {
    const traceLogService = {
      recordStage: jest.fn(async () => undefined),
    };
    const interpretationService = {
      interpret: jest.fn(async () => ({
        interpretation: {
          intent: 'GET_PRODUCT',
          entities: {
            rawMessage: 'quiero algo barato',
          },
          language: 'es',
          confidence: 0.89,
        },
        rawAiResponse: '{}',
        parsedJson: null,
        error: null,
        provider: 'mock',
        model: 'mock-rule-engine',
        usedFallback: false,
      })),
    };
    const parsingService = {
      normalize: jest.fn(async () => ({
        intent: 'GET_PRODUCT',
        entities: {
          rawMessage: 'quiero algo barato',
        },
        language: 'es',
        confidence: 0.89,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      })),
    };
    const decisionService = {
      decide: jest.fn(() => ({
        domain: 'tenant',
        action: 'invoke_tool',
        toolName: 'get_product',
        reasonCode: 'product_lookup_requested',
        missingFields: [],
        responseTemplateKey: 'tenant.ecommerce.product_result',
      })),
    };
    const continuityService = {
      prepareTurn: jest.fn(async ({ interpretation }: any) => ({
        previousState: null,
        activeState: null,
        effectiveInterpretation: {
          ...interpretation,
          continuity: {
            applied: false,
            activeLane: 'product_lookup',
            carriedFactKeys: [],
            invalidatedFactKeys: [],
            missingFields: [],
            previousStateSummary: null,
          },
        },
        continuity: {
          applied: false,
          activeLane: 'product_lookup',
          carriedFactKeys: [],
          invalidatedFactKeys: [],
          missingFields: [],
          previousStateSummary: null,
        },
      })),
      persistTurnState: jest.fn(async () => ({
        lane: 'product_lookup',
        missingFields: [],
        nextUsefulField: undefined,
        lastApprovedAction: 'invoke_tool',
        lastApprovedToolName: 'get_product',
      })),
    };
    const execution = {
      ok: true,
      toolName: 'get_product',
      validatedInput: {
        query: 'quiero algo barato',
      },
      payload: {
        sku: 'A-19',
      },
      durationMs: 4,
    };
    const toolExecutionService = {
      executeApprovedAction: jest.fn(async () => execution),
    };
    const responsePolicyService = {
      resolve: jest.fn(() => 'Listo. La accion solicitada fue procesada correctamente.'),
    };
    const memoryService = {
      getRecent: jest.fn(async () => []),
      append: jest.fn(async () => undefined),
    };

    const service = new ChatOrchestratorService(
      {
        getTraceId: () => 'trace-tool-success',
      } as any,
      {
        findById: jest.fn(async () => null),
        createConversation: jest.fn(async () => ({ id: 'conv-3' })),
        appendMessage: jest
          .fn()
          .mockResolvedValueOnce({ id: 'msg-user-3' })
          .mockResolvedValueOnce({ id: 'msg-assistant-3' }),
        listRecent: jest.fn(async () => []),
      } as any,
      {
        listByConversation: jest.fn(async () => []),
      } as any,
      interpretationService as any,
      parsingService as any,
      continuityService as any,
      decisionService as any,
      toolExecutionService as any,
      responsePolicyService as any,
      memoryService as any,
      traceLogService as any,
    );

    const result = await service.handleMessage({
      message: 'quiero algo barato',
      locale: 'es',
    });

    expect(result).toEqual({
      response: 'Listo. La accion solicitada fue procesada correctamente.',
      intent: 'GET_PRODUCT',
      entities: {
        rawMessage: 'quiero algo barato',
      },
      metadata: {
        conversationId: 'conv-3',
        traceId: 'trace-tool-success',
      },
    });
    expect(traceLogService.recordStage).toHaveBeenCalledTimes(7);
    expect(traceLogService.recordStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'execution',
        status: 'completed',
        payload: expect.objectContaining({
          toolName: 'get_product',
          validatedInputSummary: {
            query: 'quiero algo barato',
          },
          executionResultSummary: {
            sku: 'A-19',
          },
          failure: null,
        }),
      }),
    );
  });

  it('uses continuity-prepared interpretation for follow-up execution without changing the HTTP contract', async () => {
    const traceLogService = {
      recordStage: jest.fn(async () => undefined),
    };
    const interpretationService = {
      interpret: jest.fn(async () => ({
        interpretation: {
          intent: 'CLARIFICATION',
          entities: {
            rawMessage: 'para 3 personas',
            attendees: 3,
          },
          language: 'es',
          confidence: 0.41,
        },
        rawAiResponse: '{}',
        parsedJson: null,
        error: null,
        provider: 'mock',
        model: 'mock-rule-engine',
        usedFallback: false,
      })),
    };
    const parsingService = {
      normalize: jest.fn(async () => ({
        intent: 'CLARIFICATION',
        entities: {
          rawMessage: 'para 3 personas',
          attendees: 3,
        },
        language: 'es',
        confidence: 0.41,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      })),
    };
    const continuityInterpretation = {
      intent: 'CREATE_BOOKING',
      entities: {
        rawMessage: 'para 3 personas',
        attendees: 3,
      },
      language: 'es',
      confidence: 0.41,
      normalizedEntities: {
        dates: [
          {
            source: 'execution',
            iso: '2026-04-04T12:00:00.000Z',
            precision: 'date',
          },
        ],
        measurements: [],
        dimensions: [],
      },
      continuity: {
        applied: true,
        activeLane: 'booking',
        carriedFactKeys: ['requestedDate'],
        invalidatedFactKeys: [],
        missingFields: [],
        previousStateSummary: {
          lane: 'booking',
          missingFields: [],
          lastApprovedAction: 'invoke_tool',
        },
      },
    };
    const continuityService = {
      prepareTurn: jest.fn(async () => ({
        previousState: {
          conversationId: 'conv-5',
          lane: 'booking',
          missingFields: [],
        },
        activeState: {
          conversationId: 'conv-5',
          lane: 'booking',
          missingFields: [],
        },
        effectiveInterpretation: continuityInterpretation,
        continuity: continuityInterpretation.continuity,
      })),
      persistTurnState: jest.fn(async () => ({
        conversationId: 'conv-5',
        lane: 'booking',
        missingFields: [],
        lastApprovedAction: 'invoke_tool',
        lastApprovedToolName: 'create_booking',
      })),
    };
    const decisionService = {
      decide: jest.fn(() => ({
        domain: 'tenant',
        action: 'invoke_tool',
        toolName: 'create_booking',
        reasonCode: 'booking_requested',
        missingFields: [],
        responseTemplateKey: 'tenant.booking.confirmation',
      })),
    };
    const execution = {
      ok: true as const,
      toolName: 'create_booking',
      validatedInput: {
        requestedDateIso: '2026-04-04T12:00:00.000Z',
        attendees: 3,
      },
      payload: {
        bookingId: 'bk_55',
        scheduledFor: '2026-04-04T12:00:00.000Z',
        attendees: 3,
        status: 'confirmed',
      },
      durationMs: 3,
    };
    const toolExecutionService = {
      executeApprovedAction: jest.fn(async () => execution),
    };
    const responsePolicyService = {
      resolve: jest.fn(() => 'La reserva fue confirmada para 2026-04-04T12:00:00.000Z.'),
    };
    const memoryService = {
      getRecent: jest.fn(async () => []),
      append: jest.fn(async () => undefined),
    };

    const service = new ChatOrchestratorService(
      {
        getTraceId: () => 'trace-booking-follow-up',
      } as any,
      {
        findById: jest.fn(async () => null),
        createConversation: jest.fn(async () => ({ id: 'conv-5' })),
        appendMessage: jest
          .fn()
          .mockResolvedValueOnce({ id: 'msg-user-5' })
          .mockResolvedValueOnce({ id: 'msg-assistant-5' }),
        listRecent: jest.fn(async () => []),
      } as any,
      {
        listByConversation: jest.fn(async () => []),
      } as any,
      interpretationService as any,
      parsingService as any,
      continuityService as any,
      decisionService as any,
      toolExecutionService as any,
      responsePolicyService as any,
      memoryService as any,
      traceLogService as any,
    );

    const result = await service.handleMessage({
      message: 'para 3 personas',
      locale: 'es',
    });

    expect(result).toEqual({
      response: 'La reserva fue confirmada para 2026-04-04T12:00:00.000Z.',
      intent: 'CREATE_BOOKING',
      entities: {
        rawMessage: 'para 3 personas',
        attendees: 3,
      },
      metadata: {
        conversationId: 'conv-5',
        traceId: 'trace-booking-follow-up',
      },
    });
    expect(decisionService.decide).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'CREATE_BOOKING',
        continuity: expect.objectContaining({
          applied: true,
          activeLane: 'booking',
        }),
      }),
    );
    expect(toolExecutionService.executeApprovedAction).toHaveBeenCalledWith({
      decision: expect.objectContaining({
        toolName: 'create_booking',
      }),
      interpretation: expect.objectContaining({
        intent: 'CREATE_BOOKING',
        normalizedEntities: expect.objectContaining({
          dates: [
            expect.objectContaining({
              iso: '2026-04-04T12:00:00.000Z',
            }),
          ],
        }),
      }),
    });
  });

  it('logs failed execution traces and still returns the current response contract', async () => {
    const traceLogService = {
      recordStage: jest.fn(async () => undefined),
    };
    const interpretationService = {
      interpret: jest.fn(async () => ({
        interpretation: {
          intent: 'CREATE_QUOTE',
          entities: {
            rawMessage: 'Necesito una cotizacion',
          },
          language: 'es',
          confidence: 0.87,
        },
        rawAiResponse: '{}',
        parsedJson: null,
        error: null,
        provider: 'mock',
        model: 'mock-rule-engine',
        usedFallback: false,
      })),
    };
    const parsingService = {
      normalize: jest.fn(async () => ({
        intent: 'CREATE_QUOTE',
        entities: {
          rawMessage: 'Necesito una cotizacion',
        },
        language: 'es',
        confidence: 0.87,
        normalizedEntities: {
          dates: [],
          measurements: [],
          dimensions: [],
        },
      })),
    };
    const decisionService = {
      decide: jest.fn(() => ({
        domain: 'tenant',
        action: 'invoke_tool',
        toolName: 'create_quote',
        reasonCode: 'quote_requested',
        missingFields: [],
        responseTemplateKey: 'tenant.quote.confirmation',
      })),
    };
    const continuityService = {
      prepareTurn: jest.fn(async ({ interpretation }: any) => ({
        previousState: null,
        activeState: null,
        effectiveInterpretation: {
          ...interpretation,
          continuity: {
            applied: false,
            activeLane: 'quote',
            carriedFactKeys: [],
            invalidatedFactKeys: [],
            missingFields: [],
            previousStateSummary: null,
          },
        },
        continuity: {
          applied: false,
          activeLane: 'quote',
          carriedFactKeys: [],
          invalidatedFactKeys: [],
          missingFields: [],
          previousStateSummary: null,
        },
      })),
      persistTurnState: jest.fn(async () => ({
        lane: 'quote',
        missingFields: [],
        nextUsefulField: undefined,
      })),
    };
    const execution = {
      ok: false as const,
      toolName: 'create_quote',
      validatedInput: {
        requestSummary: 'Necesito una cotizacion',
      },
      errorCode: 'validation_failed' as const,
      errorMessage: 'Tool input validation failed.',
      durationMs: null,
      errorDetails: {
        issues: {
          fieldErrors: {
            requestSummary: ['invalid'],
          },
        },
      },
    };
    const toolExecutionService = {
      executeApprovedAction: jest.fn(async () => execution),
    };
    const responsePolicyService = {
      resolve: jest.fn(
        () => 'No pude completar la cotizacion solicitada con la informacion disponible.',
      ),
    };
    const memoryService = {
      getRecent: jest.fn(async () => []),
      append: jest.fn(async () => undefined),
    };

    const service = new ChatOrchestratorService(
      {
        getTraceId: () => 'trace-tool-failure',
      } as any,
      {
        findById: jest.fn(async () => null),
        createConversation: jest.fn(async () => ({ id: 'conv-4' })),
        appendMessage: jest
          .fn()
          .mockResolvedValueOnce({ id: 'msg-user-4' })
          .mockResolvedValueOnce({ id: 'msg-assistant-4' }),
        listRecent: jest.fn(async () => []),
      } as any,
      {
        listByConversation: jest.fn(async () => []),
      } as any,
      interpretationService as any,
      parsingService as any,
      continuityService as any,
      decisionService as any,
      toolExecutionService as any,
      responsePolicyService as any,
      memoryService as any,
      traceLogService as any,
    );

    const result = await service.handleMessage({
      message: 'Necesito una cotizacion',
      locale: 'es',
    });

    expect(result).toEqual({
      response:
        'No pude completar la cotizacion solicitada con la informacion disponible.',
      intent: 'CREATE_QUOTE',
      entities: {
        rawMessage: 'Necesito una cotizacion',
      },
      metadata: {
        conversationId: 'conv-4',
        traceId: 'trace-tool-failure',
      },
    });
    expect(traceLogService.recordStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'execution',
        status: 'failed',
        payload: expect.objectContaining({
          toolName: 'create_quote',
          validatedInputSummary: {
            requestSummary: 'Necesito una cotizacion',
          },
          executionResultSummary: null,
          failure: expect.objectContaining({
            code: 'validation_failed',
            message: 'Tool input validation failed.',
          }),
        }),
      }),
    );
  });
});

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
});

import { ChatOrchestratorService } from '../src/modules/api/chat-orchestrator.service';

describe('ChatOrchestratorService', () => {
  it('stores a basic interaction, runs decisioning, logs decision, and returns the minimal response payload', async () => {
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
      normalize: jest.fn(() => ({
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
    expect(interpretationService.interpret).toHaveBeenCalledWith('hola', undefined, []);
    expect(parsingService.normalize).toHaveBeenCalledWith({
      intent: 'GENERAL_CONVERSATION',
      entities: {},
      language: 'es',
      confidence: 0.94,
    });
    expect(decisionService.decide).toHaveBeenCalledWith({
      intent: 'GENERAL_CONVERSATION',
      entities: {},
      language: 'es',
      confidence: 0.94,
      normalizedEntities: {
        dates: [],
        measurements: [],
        dimensions: [],
      },
    });
    expect(traceLogService.recordStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'decision',
        status: 'completed',
        payload: expect.objectContaining({
          domain: 'core',
          action: 'respond',
          reasonCode: 'general_conversation',
          missingFields: [],
        }),
      }),
    );
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
      normalize: jest.fn(() => ({
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
    expect(traceLogService.recordStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'decision',
        payload: expect.objectContaining({
          action: 'clarify',
          missingFields: ['requested_date'],
        }),
      }),
    );
  });

  it('returns a neutral acknowledgement when the deterministic decision would invoke a tool', async () => {
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
      normalize: jest.fn(() => ({
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
    const memoryService = {
      getRecent: jest.fn(async () => []),
      append: jest.fn(async () => undefined),
    };

    const service = new ChatOrchestratorService(
      {
        getTraceId: () => 'trace-tool-pending',
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
      memoryService as any,
      traceLogService as any,
    );

    const result = await service.handleMessage({
      message: 'quiero algo barato',
      locale: 'es',
    });

    expect(result).toEqual({
      response:
        'Entendido. Identifique tu consulta de producto y la deje lista para el siguiente paso.',
      intent: 'GET_PRODUCT',
      entities: {
        rawMessage: 'quiero algo barato',
      },
      metadata: {
        conversationId: 'conv-3',
        traceId: 'trace-tool-pending',
      },
    });
  });
});

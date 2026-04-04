import { SemanticTurnExecutionService } from '../src/modules/api/semantic-turn-execution.service';

describe('SemanticTurnExecutionService', () => {
  it('runs the canonical pipeline and projects the assistant reply immediately for synchronous chat', async () => {
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
    const chatResponseService = {
      generate: jest.fn(async () => ({
        response: 'Hello, how can I help you?',
        approvedContext: {
          locale: 'es',
          userMessage: 'hola',
          intent: 'GENERAL_CONVERSATION',
          outcome: 'respond',
          decision: {
            domain: 'core',
            action: 'respond',
            reasonCode: 'general_conversation',
            missingFields: [],
            responseTemplateKey: 'core.general_response',
          },
          interpretation: {
            language: 'es',
            confidence: 0.94,
            entities: {},
            normalizedEntities: {
              dates: [],
              measurements: [],
              dimensions: [],
            },
          },
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          approvedFactKeys: [],
          approvedResultKeys: [],
        },
        approvedDraft: 'Hello, how can I help you?',
        usedFallback: false,
        fallbackReason: null,
        generation: {
          provider: 'mock',
          model: 'mock-rule-engine',
          promptId: null,
          promptVersion: null,
          rawAiResponse: null,
          parsedJson: null,
          error: null,
          guardrails: {
            accepted: true,
            issues: [],
          },
        },
      })),
    };
    const memoryService = {
      getRecent: jest.fn(async () => []),
      append: jest.fn(async () => undefined),
    };
    const conversationRepository = {
      appendMessage: jest
        .fn()
        .mockResolvedValueOnce({ id: 'msg-user-1' })
        .mockResolvedValueOnce({ id: 'msg-assistant-1' }),
    };

    const service = new SemanticTurnExecutionService(
      {
        getTraceId: () => 'trace-1',
      } as any,
      conversationRepository as any,
      interpretationService as any,
      parsingService as any,
      continuityService as any,
      decisionService as any,
      toolExecutionService as any,
      chatResponseService as any,
      memoryService as any,
      traceLogService as any,
    );

    const result = await service.executeClosedTurn(
      {
        conversationId: 'conv-1',
        message: 'hola',
        locale: 'es',
      },
      {
        projectReplyImmediately: true,
      },
    );

    expect(result.response).toBe('Hello, how can I help you?');
    expect(result.outgoingMessageId).toBe('msg-assistant-1');
    expect(conversationRepository.appendMessage).toHaveBeenCalledTimes(2);
    expect(memoryService.append).toHaveBeenCalledWith(
      'conv-1',
      'assistant',
      'Hello, how can I help you?',
    );
    expect(traceLogService.recordStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'logging',
        payload: expect.objectContaining({
          replyProjectionStatus: 'projected',
          outgoingMessageId: 'msg-assistant-1',
        }),
      }),
    );
  });

  it('can defer assistant reply projection for async turn handling', async () => {
    const conversationRepository = {
      appendMessage: jest.fn(async () => ({ id: 'msg-user-1' })),
    };
    const service = new SemanticTurnExecutionService(
      {
        getTraceId: () => 'trace-async',
      } as any,
      conversationRepository as any,
      {
        interpret: jest.fn(async () => ({
          interpretation: {
            intent: 'GENERAL_CONVERSATION',
            entities: {},
            language: 'es',
            confidence: 0.9,
          },
          rawAiResponse: null,
          parsedJson: null,
          error: null,
          provider: 'mock',
          model: 'mock-rule-engine',
          usedFallback: false,
        })),
      } as any,
      {
        normalize: jest.fn(async () => ({
          intent: 'GENERAL_CONVERSATION',
          entities: {},
          language: 'es',
          confidence: 0.9,
          normalizedEntities: {
            dates: [],
            measurements: [],
            dimensions: [],
          },
        })),
      } as any,
      {
        prepareTurn: jest.fn(async ({ interpretation }: any) => ({
          previousState: null,
          activeState: null,
          effectiveInterpretation: interpretation,
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
      } as any,
      {
        decide: jest.fn(() => ({
          domain: 'core',
          action: 'respond',
          reasonCode: 'general_conversation',
          missingFields: [],
          responseTemplateKey: 'core.general_response',
        })),
      } as any,
      {
        executeApprovedAction: jest.fn(async () => null),
      } as any,
      {
        generate: jest.fn(async () => ({
          response: 'Queued async response',
          approvedContext: {} as any,
          approvedDraft: 'Queued async response',
          usedFallback: false,
          fallbackReason: null,
          generation: {
            provider: 'mock',
            model: 'mock-rule-engine',
            promptId: null,
            promptVersion: null,
            rawAiResponse: null,
            parsedJson: null,
            error: null,
            guardrails: {
              accepted: true,
              issues: [],
            },
          },
        })),
      } as any,
      {
        getRecent: jest.fn(async () => []),
        append: jest.fn(async () => undefined),
      } as any,
      {
        recordStage: jest.fn(async () => undefined),
      } as any,
    );

    const result = await service.executeClosedTurn(
      {
        conversationId: 'conv-async',
        message: 'hola',
        locale: 'es',
      },
      {
        projectReplyImmediately: false,
      },
    );

    expect(result.outgoingMessageId).toBeNull();
    expect(conversationRepository.appendMessage).toHaveBeenCalledTimes(1);
    expect(result.assistantMessageMetadata).toEqual(
      expect.objectContaining({
        responseGeneration: expect.objectContaining({
          provider: 'mock',
        }),
      }),
    );
  });
});

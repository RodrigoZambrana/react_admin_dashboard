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
      persistTurnState: jest.fn(async () => ({
        conversationId: 'conv-1',
        lane: 'document_exploration',
        missingFields: [],
        lastApprovedAction: 'respond',
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
      countMessages: jest.fn(async () => 0),
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
      {
        retrieveForConversation: jest.fn(async () => ({
          attempted: false,
          reason: 'not_requested',
          result: null,
        })),
        withDecisionContext: jest.fn((attempt: any) => attempt),
      } as any,
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
    expect(chatResponseService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationState: null,
      }),
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
      countMessages: jest.fn(async () => 0),
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
        retrieveForConversation: jest.fn(async () => ({
          attempted: false,
          reason: 'not_requested',
          result: null,
        })),
        withDecisionContext: jest.fn((attempt: any) => attempt),
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

  it('treats durable stored messages as prior conversation even when volatile memory is empty', async () => {
    const chatResponseService = {
      generate: jest.fn(async () => ({
        response: 'Seguimos con el mismo hilo.',
        approvedContext: {} as any,
        approvedDraft: 'Seguimos con el mismo hilo.',
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
    const conversationRepository = {
      countMessages: jest.fn(async () => 4),
      appendMessage: jest
        .fn()
        .mockResolvedValueOnce({ id: 'msg-user-1' })
        .mockResolvedValueOnce({ id: 'msg-assistant-1' }),
    };
    const service = new SemanticTurnExecutionService(
      {
        getTraceId: () => 'trace-history',
      } as any,
      conversationRepository as any,
      {
        interpret: jest.fn(async () => ({
          interpretation: {
            intent: 'GENERAL_CONVERSATION',
            entities: {
              rawMessage: 'disculpe otra consulta',
            },
            language: 'es',
            confidence: 0.91,
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
        normalize: jest.fn(async (interpretation: any) => ({
          ...interpretation,
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
        retrieveForConversation: jest.fn(async () => ({
          attempted: false,
          reason: 'not_requested',
          result: null,
        })),
        withDecisionContext: jest.fn((attempt: any) => attempt),
      } as any,
      chatResponseService as any,
      {
        getRecent: jest.fn(async () => []),
        append: jest.fn(async () => undefined),
      } as any,
      {
        recordStage: jest.fn(async () => undefined),
      } as any,
    );

    await service.executeClosedTurn({
      conversationId: 'conv-history',
      message: 'disculpe otra consulta',
      locale: 'es',
    });

    expect(chatResponseService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        hasPriorMessages: true,
      }),
    );
  });

  it('passes approved document retrieval context into the response layer and traces retrieval separately', async () => {
    const traceLogService = {
      recordStage: jest.fn(async () => undefined),
    };
    const documentContext = {
      source: 'document_origin' as const,
      query: 'cambio de cadena cortina roller',
      groundedSummary:
        'El documento indica que el cambio de cadena de cortinas roller está cubierto.',
      matches: [
        {
          documentId: 'doc-1',
          title: 'Coberturas roller',
          excerpt:
            'El cambio de cadena de cortinas roller está cubierto dentro del servicio.',
          sequence: 0,
          score: 4.2,
        },
      ],
    };
    const chatResponseService = {
      generate: jest.fn(async () => ({
        response:
          'Según el documento, el cambio de cadena está cubierto. La reserva fue confirmada para 2026-04-05T11:00:00.000Z.',
        approvedContext: {
          approvedDocumentIds: ['doc-1'],
        } as any,
        approvedDraft:
          'El documento indica que el cambio de cadena de cortinas roller está cubierto. La reserva fue confirmada para 2026-04-05T11:00:00.000Z.',
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

    const service = new SemanticTurnExecutionService(
      {
        getTraceId: () => 'trace-doc-booking',
      } as any,
      {
        countMessages: jest.fn(async () => 0),
        appendMessage: jest
          .fn()
          .mockResolvedValueOnce({ id: 'msg-user-1' })
          .mockResolvedValueOnce({ id: 'msg-assistant-1' }),
      } as any,
      {
        interpret: jest.fn(async () => ({
          interpretation: {
            intent: 'CREATE_BOOKING',
            entities: {
              rawMessage:
                'Si el documento dice que cubren cambio de cadena, agendame una visita para mañana a las 11.',
              requestSummary: 'cambio de cadena de cortina roller',
            },
            language: 'es',
            confidence: 0.94,
          },
          rawAiResponse: null,
          parsedJson: null,
          error: null,
          provider: 'openai',
          model: 'gpt-4.1-mini',
          usedFallback: false,
        })),
      } as any,
      {
        normalize: jest.fn(async (interpretation: any) => ({
          ...interpretation,
          normalizedEntities: {
            dates: [
              {
                source: 'mañana a las 11',
                iso: '2026-04-05T11:00:00.000Z',
                precision: 'datetime',
              },
            ],
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
            activeLane: 'booking',
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
          domain: 'tenant',
          action: 'invoke_tool',
          toolName: 'create_booking',
          reasonCode: 'booking_requested',
          missingFields: [],
          responseTemplateKey: 'tenant.booking.confirmation',
        })),
      } as any,
      {
        executeApprovedAction: jest.fn(async () => ({
          ok: true,
          toolName: 'create_booking',
          validatedInput: {
            requestedDateIso: '2026-04-05T11:00:00.000Z',
          },
          payload: {
            bookingId: 'bk_doc_1',
            scheduledFor: '2026-04-05T11:00:00.000Z',
            status: 'confirmed',
          },
          durationMs: 5,
        })),
      } as any,
      {
        retrieveForConversation: jest.fn(async () => ({
          attempted: true,
          reason: 'document_query',
          result: documentContext,
        })),
        withDecisionContext: jest.fn((attempt: any) => ({
          ...attempt,
          reason: 'combined_booking_document_query',
        })),
      } as any,
      chatResponseService as any,
      {
        getRecent: jest.fn(async () => []),
        append: jest.fn(async () => undefined),
      } as any,
      traceLogService as any,
    );

    await service.executeClosedTurn({
      conversationId: 'conv-doc-booking',
      message:
        'Si el documento dice que cubren cambio de cadena, agendame una visita para mañana a las 11.',
      locale: 'es',
    });

    expect(chatResponseService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        documentContext,
      }),
    );
    expect(traceLogService.recordStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'retrieval',
        status: 'completed',
        payload: expect.objectContaining({
          source: 'document_origin',
          reason: 'combined_booking_document_query',
        }),
      }),
    );
  });
});

import { AdminTestCenterService } from '../src/modules/api/admin-test-center.service';

describe('AdminTestCenterService', () => {
  it('replays turns through the real orchestrator contract with admin_test_center channel', async () => {
    const seenContexts: Array<{ tenantId: string; traceId: string }> = [];
    const findEvaluationByConversationId = jest.fn(async () => null);
    const service = new AdminTestCenterService(
      {
        getTenantId: jest.fn(() => 'tenant-alpha'),
        run: jest.fn((context, callback) => {
          seenContexts.push(context);
          return callback();
        }),
      } as any,
      {
        handleMessage: jest
          .fn()
          .mockResolvedValueOnce({
            response: 'Hola',
            intent: 'GENERAL_CONVERSATION',
            metadata: {
              conversationId: 'conv-1',
              traceId: 'trace-a',
            },
          })
          .mockResolvedValueOnce({
            response: 'Reserva creada',
            intent: 'CREATE_BOOKING',
            metadata: {
              conversationId: 'conv-1',
              traceId: 'trace-b',
            },
          }),
      } as any,
      {
        findById: jest.fn(async () => ({
          id: 'conv-1',
          language: 'es',
          channel: 'admin_test_center',
          createdAt: new Date('2026-04-04T00:00:00.000Z'),
          updatedAt: new Date('2026-04-04T00:10:00.000Z'),
          messages: [],
        })),
      } as any,
      {
        findByConversationId: jest.fn(async () => null),
      } as any,
      {
        listByConversationId: jest.fn(async () => [
          {
            id: 'log-1',
            traceId: 'trace-a',
            stage: 'response',
            status: 'completed',
            payload: {
              response: 'Hola',
            },
            createdAt: new Date('2026-04-04T00:00:10.000Z'),
            conversationId: 'conv-1',
          },
          {
            id: 'log-2',
            traceId: 'trace-b',
            stage: 'response',
            status: 'completed',
            payload: {
              response: 'Reserva creada',
            },
            createdAt: new Date('2026-04-04T00:00:20.000Z'),
            conversationId: 'conv-1',
          },
        ]),
        getTrace: jest.fn(),
        listRecent: jest.fn(),
      } as any,
      {
        findByConversationId: findEvaluationByConversationId,
        upsertConversationEvaluation: jest.fn(),
      } as any,
      {
        listActivePrompts: jest.fn(),
      } as any,
      {
        listActiveLocales: jest.fn(),
      } as any,
      {
        listActiveCatalogs: jest.fn(),
      } as any,
      {
        listActiveResources: jest.fn(),
      } as any,
      {
        listScenarios: jest.fn(),
        getScenario: jest.fn(),
      } as any,
      {
        evaluateScenarioRun: jest.fn(),
      } as any,
    );

    const result = await service.replayConversation({
      locale: 'es',
      turns: [{ message: 'hola' }, { message: 'reservar mañana' }],
    });

    expect(result.conversationId).toBe('conv-1');
    expect(result.turns).toHaveLength(2);
    expect(seenContexts).toHaveLength(2);
    expect(seenContexts[0].tenantId).toBe('tenant-alpha');
    expect(seenContexts[0].traceId).not.toBe(seenContexts[1].traceId);
    expect(
      (service as any).chatOrchestratorService.handleMessage,
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        message: 'hola',
        locale: 'es',
        channel: 'admin_test_center',
      }),
    );
    expect(
      (service as any).chatOrchestratorService.handleMessage,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        message: 'reservar mañana',
        conversationId: 'conv-1',
        channel: 'admin_test_center',
      }),
    );
  });

  it('compares two traces through backend summaries', async () => {
    const getTrace = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'a1',
          traceId: 'trace-a',
          stage: 'interpretation',
          status: 'completed',
          payload: {
            parsedJson: {
              intent: 'CREATE_BOOKING',
            },
            usedFallback: false,
          },
          createdAt: new Date('2026-04-04T00:00:00.000Z'),
          conversationId: 'conv-1',
        },
        {
          id: 'a2',
          traceId: 'trace-a',
          stage: 'response',
          status: 'completed',
          payload: {
            response: 'Reserva creada',
          },
          createdAt: new Date('2026-04-04T00:00:01.000Z'),
          conversationId: 'conv-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'b1',
          traceId: 'trace-b',
          stage: 'interpretation',
          status: 'completed',
          payload: {
            parsedJson: {
              intent: 'CREATE_BOOKING',
            },
            usedFallback: false,
          },
          createdAt: new Date('2026-04-04T00:00:02.000Z'),
          conversationId: 'conv-2',
        },
        {
          id: 'b2',
          traceId: 'trace-b',
          stage: 'response',
          status: 'completed',
          payload: {
            response: 'Necesito una fecha',
          },
          createdAt: new Date('2026-04-04T00:00:03.000Z'),
          conversationId: 'conv-2',
        },
      ]);

    const service = new AdminTestCenterService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        getTrace,
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const comparison = await service.compareTraces('trace-a', 'trace-b');

    expect(comparison.comparison.sameIntent).toBe(true);
    expect(comparison.comparison.sameResponse).toBe(false);
  });

  it('replays a selected scenario and persists an automatic evaluation', async () => {
    const upsertConversationEvaluation = jest.fn();
    const evaluateScenarioRun = jest.fn(() => ({
      scenarioId: 'scenario-1',
      scenarioLabel: 'Escenario',
      scenarioSourceKind: 'curated',
      locale: 'es',
      overallScore: 91,
      correctnessScore: 92,
      coherenceScore: 90,
      fluencyScore: 89,
      writingQualityScore: 93,
      status: 'pass',
      summaryLines: ['ok'],
      turns: [],
    }));
    const service = new AdminTestCenterService(
      {
        getTenantId: jest.fn(() => 'tenant-alpha'),
        run: jest.fn((_context, callback) => callback()),
      } as any,
      {
        handleMessage: jest.fn(async () => ({
          response: 'Aceptamos transferencia bancaria, efectivo, Mercado Pago y tarjetas.',
          intent: 'GENERAL_CONVERSATION',
          metadata: {
            conversationId: 'conv-scenario',
            traceId: 'trace-scenario',
          },
        })),
      } as any,
      {
        findById: jest.fn(async () => ({
          id: 'conv-scenario',
          language: 'es',
          channel: 'admin_test_center',
          createdAt: new Date('2026-04-04T00:00:00.000Z'),
          updatedAt: new Date('2026-04-04T00:10:00.000Z'),
          messages: [
            {
              id: 'msg-1',
              role: 'USER',
              content: 'que formas de pago aceptan?',
            },
          ],
        })),
      } as any,
      {
        findByConversationId: jest.fn(async () => null),
      } as any,
      {
        listByConversationId: jest.fn(async () => [
          {
            id: 'log-1',
            traceId: 'trace-scenario',
            stage: 'response',
            status: 'completed',
            payload: {
              response: 'Aceptamos transferencia bancaria, efectivo, Mercado Pago y tarjetas.',
            },
            createdAt: new Date('2026-04-04T00:00:10.000Z'),
            conversationId: 'conv-scenario',
          },
        ]),
        getTrace: jest.fn(),
        listRecent: jest.fn(),
      } as any,
      {
        findByConversationId: jest.fn(async () => null),
        upsertConversationEvaluation,
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        listScenarios: jest.fn(async () => []),
        getScenario: jest.fn(async () => ({
          id: 'scenario-1',
          label: 'Escenario',
          description: 'desc',
          locale: 'es',
          sourceKind: 'curated',
          category: 'supported_information',
          tags: [],
          turns: [{ message: 'que formas de pago aceptan?', locale: 'es' }],
        })),
      } as any,
      {
        evaluateScenarioRun,
      } as any,
    );

    const result = await service.replayConversation({
      locale: 'es',
      scenarioId: 'scenario-1',
    });

    expect(result.scenario?.id).toBe('scenario-1');
    expect(result.evaluation?.overallScore).toBe(91);
    expect(upsertConversationEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-scenario',
        scenarioId: 'scenario-1',
      }),
    );
    expect(evaluateScenarioRun).toHaveBeenCalled();
  });
});

import { AsyncConversationTurnStatus } from '@prisma/client';

import { AsyncTurnExecutionControlService } from '../src/modules/api/async-turn-execution-control.service';
import { AsyncTurnIntakeService } from '../src/modules/api/async-turn-intake.service';
import { createAbortError } from '../src/modules/shared/abort.utils';

type TurnRecord = {
  id: string;
  conversationId: string;
  status: AsyncConversationTurnStatus;
  traceId: string;
  locale: string | null;
  acceptedAt: Date;
  firstInputAt: Date;
  lastInputAt: Date;
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
  flushAt: Date;
  replyDueAt: Date | null;
  projectedAt: Date | null;
  supersededAt: Date | null;
  stabilizationDelayMs: number;
  replyDelayMs: number;
  inputCount: number;
  semanticInput: string;
  replyText: string | null;
  replyMessageMetadata: Record<string, unknown> | null;
  resultSummary: Record<string, unknown> | null;
  assistantMessageId: string | null;
  supersededByTurnId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  inputs: Array<{
    id: string;
    turnId: string;
    sequence: number;
    content: string;
    locale: string | null;
    metadata: Record<string, unknown> | null;
    receivedAt: Date;
  }>;
};

function createInMemoryAsyncTurnRepository() {
  const turns = new Map<string, TurnRecord>();
  let nextTurnId = 1;
  let nextInputId = 1;
  const activeStatuses = new Set<AsyncConversationTurnStatus>([
    AsyncConversationTurnStatus.STABILIZING,
    AsyncConversationTurnStatus.PROCESSING,
    AsyncConversationTurnStatus.AWAITING_REPLY,
  ]);

  const cloneTurn = (turn: TurnRecord): TurnRecord => ({
    ...turn,
    metadata: turn.metadata ? { ...turn.metadata } : null,
    replyMessageMetadata: turn.replyMessageMetadata
      ? { ...turn.replyMessageMetadata }
      : null,
    resultSummary: turn.resultSummary ? { ...turn.resultSummary } : null,
    inputs: turn.inputs.map((input) => ({
      ...input,
      metadata: input.metadata ? { ...input.metadata } : null,
    })),
  });

  const getTurnOrThrow = (turnId: string) => {
    const turn = turns.get(turnId);
    if (!turn) {
      throw new Error(`Missing async turn ${turnId}`);
    }

    return turn;
  };

  return {
    listRecoverableTurns: jest.fn(async () => []),
    listActiveTurns: jest.fn(async (conversationId: string) =>
      [...turns.values()]
        .filter(
          (turn) =>
            turn.conversationId === conversationId &&
            activeStatuses.has(turn.status),
        )
        .sort((left, right) => left.acceptedAt.getTime() - right.acceptedAt.getTime())
        .map(cloneTurn),
    ),
    findLatestStabilizingTurn: jest.fn(async (conversationId: string) => {
      const matches = [...turns.values()]
        .filter(
          (turn) =>
            turn.conversationId === conversationId &&
            turn.status === AsyncConversationTurnStatus.STABILIZING,
        )
        .sort((left, right) => right.acceptedAt.getTime() - left.acceptedAt.getTime());

      return matches[0] ? cloneTurn(matches[0]) : null;
    }),
    createTurnWithInitialInput: jest.fn(async (input: any) => {
      const turnId = `turn-${nextTurnId++}`;
      const turn: TurnRecord = {
        id: turnId,
        conversationId: input.conversationId,
        status: AsyncConversationTurnStatus.STABILIZING,
        traceId: input.traceId,
        locale: input.locale ?? null,
        acceptedAt: input.acceptedAt,
        firstInputAt: input.acceptedAt,
        lastInputAt: input.acceptedAt,
        processingStartedAt: null,
        processingCompletedAt: null,
        flushAt: input.flushAt,
        replyDueAt: null,
        projectedAt: null,
        supersededAt: null,
        stabilizationDelayMs: input.stabilizationDelayMs,
        replyDelayMs: 0,
        inputCount: 1,
        semanticInput: input.semanticInput,
        replyText: null,
        replyMessageMetadata: null,
        resultSummary: null,
        assistantMessageId: null,
        supersededByTurnId: null,
        errorCode: null,
        errorMessage: null,
        metadata: (input.metadata ?? null) as Record<string, unknown> | null,
        inputs: [
          {
            id: `turn-input-${nextInputId++}`,
            turnId,
            sequence: 0,
            content: input.content,
            locale: input.locale ?? null,
            metadata: null,
            receivedAt: input.acceptedAt,
          },
        ],
      };

      turns.set(turnId, turn);
      return cloneTurn(turn);
    }),
    appendInputAndRefreshTurn: jest.fn(async (input: any) => {
      const turn = getTurnOrThrow(input.turnId);
      const receivedAt = new Date(turn.lastInputAt.getTime() + 50);
      turn.inputs.push({
        id: `turn-input-${nextInputId++}`,
        turnId: turn.id,
        sequence: turn.inputs.length,
        content: input.content,
        locale: input.locale ?? null,
        metadata: null,
        receivedAt,
      });
      turn.locale = input.locale ?? turn.locale;
      turn.lastInputAt = receivedAt;
      turn.inputCount = input.inputCount;
      turn.semanticInput = input.semanticInput;
      turn.stabilizationDelayMs = input.stabilizationDelayMs;
      turn.flushAt = input.flushAt;
      return cloneTurn(turn);
    }),
    findById: jest.fn(async (turnId: string) => {
      const turn = turns.get(turnId);
      return turn ? cloneTurn(turn) : null;
    }),
    markProcessing: jest.fn(async (turnId: string, startedAt: Date) => {
      const turn = getTurnOrThrow(turnId);
      turn.status = AsyncConversationTurnStatus.PROCESSING;
      turn.processingStartedAt = startedAt;
      return cloneTurn(turn);
    }),
    markAwaitingReply: jest.fn(async (input: any) => {
      const turn = getTurnOrThrow(input.turnId);
      turn.status = AsyncConversationTurnStatus.AWAITING_REPLY;
      turn.processingCompletedAt = input.completedAt;
      turn.replyDueAt = input.replyDueAt;
      turn.replyDelayMs = input.replyDelayMs;
      turn.replyText = input.replyText;
      turn.replyMessageMetadata = input.replyMessageMetadata;
      turn.resultSummary = input.resultSummary;
      return cloneTurn(turn);
    }),
    markCompleted: jest.fn(async (input: any) => {
      const turn = getTurnOrThrow(input.turnId);
      turn.status = AsyncConversationTurnStatus.COMPLETED;
      turn.projectedAt = input.projectedAt;
      turn.assistantMessageId = input.assistantMessageId;
      return cloneTurn(turn);
    }),
    markSuperseded: jest.fn(async (input: any) => {
      const turn = getTurnOrThrow(input.turnId);
      turn.status = AsyncConversationTurnStatus.SUPERSEDED;
      turn.supersededAt = input.supersededAt;
      turn.supersededByTurnId = input.supersededByTurnId;
      turn.metadata = (input.metadata ?? null) as Record<string, unknown> | null;
      return cloneTurn(turn);
    }),
    markFailed: jest.fn(async (input: any) => {
      const turn = getTurnOrThrow(input.turnId);
      turn.status = AsyncConversationTurnStatus.FAILED;
      turn.errorCode = input.errorCode;
      turn.errorMessage = input.errorMessage;
      turn.metadata = (input.metadata ?? null) as Record<string, unknown> | null;
      return cloneTurn(turn);
    }),
    getSessionTurns: jest.fn(async (conversationId: string) =>
      [...turns.values()]
        .filter((turn) => turn.conversationId === conversationId)
        .sort((left, right) => right.acceptedAt.getTime() - left.acceptedAt.getTime())
        .map(cloneTurn),
    ),
  };
}

describe('AsyncTurnIntakeService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('coalesces rapid inbound messages into one semantic turn before pipeline execution', async () => {
    const asyncTurnRepository = createInMemoryAsyncTurnRepository();
    const traceLogService = {
      recordStage: jest.fn(async () => undefined),
    };
    const semanticTurnExecutionService = {
      executeClosedTurn: jest.fn(async () => ({
        response: 'Respuesta consolidada',
        intent: 'CREATE_QUOTE',
        entities: {},
        metadata: {
          conversationId: 'conv-1',
          traceId: 'trace-turn-1',
        },
        decision: {
          action: 'invoke_tool',
          toolName: 'create_quote',
        },
        execution: {
          ok: true,
        },
        approvedResponse: {
          fallbackReason: null,
        },
        assistantMessageMetadata: {
          source: 'async',
        },
      })),
      projectAssistantReply: jest.fn(async () => ({
        id: 'msg-assistant-1',
      })),
    };
    const service = new AsyncTurnIntakeService(
      {
        findById: jest.fn(async () => ({
          id: 'conv-1',
          language: 'es',
          channel: 'webchat_async',
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          updatedAt: new Date('2026-04-04T10:00:00.000Z'),
          messages: [],
        })),
        createConversation: jest.fn(async () => ({
          id: 'conv-1',
          language: 'es',
          channel: 'webchat_async',
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          updatedAt: new Date('2026-04-04T10:00:00.000Z'),
          messages: [],
        })),
      } as any,
      asyncTurnRepository as any,
      {
        getTenantId: () => 'tenant-alpha',
        getTraceId: () => 'trace-request',
        run: (_context: any, callback: () => unknown) => callback(),
      } as any,
      traceLogService as any,
      {
        calculateFlushAt: jest.fn(({ acceptedAt }: { acceptedAt: Date }) => ({
          stabilizationDelayMs: 1000,
          flushAt: new Date(acceptedAt.getTime() + 1000),
        })),
        buildSemanticInput: jest.fn((messages: string[]) => messages.join('\n')),
        estimateReplyDelay: jest.fn(() => 0),
      } as any,
      new AsyncTurnExecutionControlService(),
      semanticTurnExecutionService as any,
    );

    const firstAccepted = await service.acceptMessage({
      message: 'Necesito una cotizacion',
      locale: 'es',
      channel: 'webchat_async',
    });
    const secondAccepted = await service.acceptMessage({
      conversationId: firstAccepted.conversationId,
      message: 'para 3 puertas',
      locale: 'es',
    });

    expect(firstAccepted.presence.state).toBe('queued');
    expect(secondAccepted.turn.id).toBe(firstAccepted.turn.id);
    expect(secondAccepted.turn.inputCount).toBe(2);
    expect(secondAccepted.turn.semanticInput).toBe(
      'Necesito una cotizacion\npara 3 puertas',
    );
    expect(semanticTurnExecutionService.executeClosedTurn).not.toHaveBeenCalled();

    const queuedSession = await service.getSession(firstAccepted.conversationId);
    expect(queuedSession.presence).toEqual(
      expect.objectContaining({
        state: 'queued',
        awaitingReply: true,
        turnId: firstAccepted.turn.id,
      }),
    );
    expect(queuedSession.activeTurn).toEqual(
      expect.objectContaining({
        id: firstAccepted.turn.id,
        inputCount: 2,
      }),
    );

    await jest.advanceTimersByTimeAsync(1000);
    await jest.runOnlyPendingTimersAsync();

    expect(semanticTurnExecutionService.executeClosedTurn).toHaveBeenCalledTimes(1);
    expect(semanticTurnExecutionService.executeClosedTurn).toHaveBeenCalledWith(
      {
        conversationId: 'conv-1',
        message: 'Necesito una cotizacion\npara 3 puertas',
        locale: 'es',
      },
      expect.objectContaining({
        projectReplyImmediately: false,
        abortSignal: expect.any(Object),
      }),
    );
    expect(semanticTurnExecutionService.projectAssistantReply).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      response: 'Respuesta consolidada',
      assistantMessageMetadata: {
        source: 'async',
      },
    });

    const completedSession = await service.getSession(firstAccepted.conversationId);
    expect(completedSession.latestCompletedTurn).toEqual(
      expect.objectContaining({
        id: firstAccepted.turn.id,
        status: 'completed',
        internalStatus: AsyncConversationTurnStatus.COMPLETED,
        assistantMessageId: 'msg-assistant-1',
      }),
    );
    expect(completedSession.presence.state).toBe('idle');
    expect(traceLogService.recordStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'async_intake',
        status: 'coalesced',
      }),
    );
    expect(traceLogService.recordStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'async_turn',
        status: 'closed',
      }),
    );
  });

  it('creates a new async conversation when no existing conversation is provided and exposes accepted queue metadata', async () => {
    const asyncTurnRepository = createInMemoryAsyncTurnRepository();
    const conversationRepository = {
      findById: jest.fn(async () => null),
      createConversation: jest.fn(async () => ({
        id: 'conv-new',
        language: 'en',
        channel: 'webchat_async',
        createdAt: new Date('2026-04-04T10:00:00.000Z'),
        updatedAt: new Date('2026-04-04T10:00:00.000Z'),
        messages: [],
      })),
    };
    const service = new AsyncTurnIntakeService(
      conversationRepository as any,
      asyncTurnRepository as any,
      {
        getTenantId: () => 'tenant-alpha',
        getTraceId: () => 'trace-request',
        run: (_context: any, callback: () => unknown) => callback(),
      } as any,
      {
        recordStage: jest.fn(async () => undefined),
      } as any,
      {
        calculateFlushAt: jest.fn(({ acceptedAt }: { acceptedAt: Date }) => ({
          stabilizationDelayMs: 1200,
          flushAt: new Date(acceptedAt.getTime() + 1200),
        })),
        buildSemanticInput: jest.fn((messages: string[]) => messages.join('\n')),
        estimateReplyDelay: jest.fn(() => 0),
      } as any,
      new AsyncTurnExecutionControlService(),
      {
        executeClosedTurn: jest.fn(),
        projectAssistantReply: jest.fn(),
      } as any,
    );

    const accepted = await service.acceptMessage({
      message: 'Hello there',
      locale: 'en',
    });

    expect(conversationRepository.createConversation).toHaveBeenCalledWith(
      'en',
      'webchat_async',
    );
    expect(accepted).toEqual(
      expect.objectContaining({
        conversationId: 'conv-new',
        turn: expect.objectContaining({
          status: 'queued',
          internalStatus: AsyncConversationTurnStatus.STABILIZING,
          stabilizationDelayMs: 1200,
          inputCount: 1,
        }),
        presence: expect.objectContaining({
          state: 'queued',
          awaitingReply: true,
          acceptedAt: expect.any(String),
          flushAt: expect.any(String),
        }),
      }),
    );
  });

  it('lists recent async conversations with backend-derived presence and preview data', async () => {
    const asyncTurnRepository = createInMemoryAsyncTurnRepository();
    const acceptedAt = new Date('2026-04-04T10:00:00.000Z');
    await asyncTurnRepository.createTurnWithInitialInput({
      conversationId: 'conv-list',
      traceId: 'trace-turn-list',
      content: 'Necesito una cotizacion',
      locale: 'es',
      semanticInput: 'Necesito una cotizacion',
      acceptedAt,
      flushAt: new Date(acceptedAt.getTime() + 1000),
      stabilizationDelayMs: 1000,
      metadata: {
        source: 'async_chat',
      },
    });

    const service = new AsyncTurnIntakeService(
      {
        listRecentByChannel: jest.fn(async () => [
          {
            id: 'conv-list',
            language: 'es',
            channel: 'webchat_async',
            createdAt: acceptedAt,
            updatedAt: new Date('2026-04-04T10:01:00.000Z'),
            messages: [],
          },
        ]),
      } as any,
      asyncTurnRepository as any,
      {
        getTenantId: () => 'tenant-alpha',
        getTraceId: () => 'trace-request',
        run: (_context: any, callback: () => unknown) => callback(),
      } as any,
      {
        recordStage: jest.fn(async () => undefined),
      } as any,
      {
        calculateFlushAt: jest.fn(),
        buildSemanticInput: jest.fn(),
        estimateReplyDelay: jest.fn(),
      } as any,
      new AsyncTurnExecutionControlService(),
      {
        executeClosedTurn: jest.fn(),
        projectAssistantReply: jest.fn(),
      } as any,
    );

    await expect(service.listRecentConversations(5)).resolves.toEqual([
      expect.objectContaining({
        conversationId: 'conv-list',
        channel: 'webchat_async',
        presence: 'queued',
        awaitingReply: true,
        activeTurnId: 'turn-1',
        latestPreview: 'Necesito una cotizacion',
        latestMessageRole: null,
      }),
    ]);
  });

  it('supersedes an awaiting-reply turn when a newer inbound message arrives before projection', async () => {
    const asyncTurnRepository = createInMemoryAsyncTurnRepository();
    const traceLogService = {
      recordStage: jest.fn(async () => undefined),
    };
    const semanticTurnExecutionService = {
      executeClosedTurn: jest.fn(async () => ({
        response: 'Respuesta con espera humana',
        intent: 'GENERAL_CONVERSATION',
        entities: {},
        metadata: {
          conversationId: 'conv-1',
          traceId: 'trace-turn-1',
        },
        decision: {
          action: 'respond',
          toolName: null,
        },
        execution: null,
        approvedResponse: {
          fallbackReason: null,
        },
        assistantMessageMetadata: {
          source: 'async',
        },
      })),
      projectAssistantReply: jest.fn(async () => ({
        id: 'msg-assistant-1',
      })),
    };
    const service = new AsyncTurnIntakeService(
      {
        findById: jest.fn(async () => ({
          id: 'conv-1',
          language: 'es',
          channel: 'webchat_async',
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          updatedAt: new Date('2026-04-04T10:00:00.000Z'),
          messages: [],
        })),
        createConversation: jest.fn(async () => ({
          id: 'conv-1',
          language: 'es',
          channel: 'webchat_async',
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          updatedAt: new Date('2026-04-04T10:00:00.000Z'),
          messages: [],
        })),
      } as any,
      asyncTurnRepository as any,
      {
        getTenantId: () => 'tenant-alpha',
        getTraceId: () => 'trace-request',
        run: (_context: any, callback: () => unknown) => callback(),
      } as any,
      traceLogService as any,
      {
        calculateFlushAt: jest.fn(({ acceptedAt }: { acceptedAt: Date }) => ({
          stabilizationDelayMs: 1000,
          flushAt: new Date(acceptedAt.getTime() + 1000),
        })),
        buildSemanticInput: jest.fn((messages: string[]) => messages.join('\n')),
        estimateReplyDelay: jest.fn(() => 2000),
      } as any,
      new AsyncTurnExecutionControlService(),
      semanticTurnExecutionService as any,
    );

    const firstAccepted = await service.acceptMessage({
      message: 'hola',
      locale: 'es',
      channel: 'webchat_async',
    });

    await jest.advanceTimersByTimeAsync(1000);

    const awaitingSession = await service.getSession(firstAccepted.conversationId);
    expect(awaitingSession.presence).toEqual(
      expect.objectContaining({
        state: 'awaiting_reply',
        awaitingReply: true,
        turnId: firstAccepted.turn.id,
      }),
    );

    const secondAccepted = await service.acceptMessage({
      conversationId: firstAccepted.conversationId,
      message: 'mejor con mas contexto',
      locale: 'es',
    });

    expect(secondAccepted.turn.id).not.toBe(firstAccepted.turn.id);
    expect(secondAccepted.presence.state).toBe('queued');

    const supersededTurn = await service.getTurn(firstAccepted.turn.id);
    expect(supersededTurn).toEqual(
      expect.objectContaining({
        internalStatus: AsyncConversationTurnStatus.SUPERSEDED,
        supersededByTurnId: secondAccepted.turn.id,
      }),
    );

    await jest.advanceTimersByTimeAsync(1500);

    expect(semanticTurnExecutionService.projectAssistantReply).not.toHaveBeenCalled();
    expect(traceLogService.recordStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'reply_projection',
        status: 'superseded',
        payload: expect.objectContaining({
          turnId: firstAccepted.turn.id,
          supersededByTurnId: secondAccepted.turn.id,
        }),
      }),
    );
  });

  it('supersedes a processing turn and discards its pending reply when newer inbound input arrives', async () => {
    const asyncTurnRepository = createInMemoryAsyncTurnRepository();
    const traceLogService = {
      recordStage: jest.fn(async () => undefined),
    };
    let activeAbortSignal: AbortSignal | undefined;
    const semanticTurnExecutionService = {
      executeClosedTurn: jest.fn(
        async (_input: any, options?: { abortSignal?: AbortSignal }) => {
          activeAbortSignal = options?.abortSignal;

          return new Promise((_resolve, reject) => {
            options?.abortSignal?.addEventListener(
              'abort',
              () => {
                reject(createAbortError(options.abortSignal?.reason));
              },
              { once: true },
            );
          });
        },
      ),
      projectAssistantReply: jest.fn(async () => ({
        id: 'msg-assistant-1',
      })),
    };
    const service = new AsyncTurnIntakeService(
      {
        findById: jest.fn(async () => ({
          id: 'conv-1',
          language: 'es',
          channel: 'webchat_async',
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          updatedAt: new Date('2026-04-04T10:00:00.000Z'),
          messages: [],
        })),
        createConversation: jest.fn(async () => ({
          id: 'conv-1',
          language: 'es',
          channel: 'webchat_async',
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          updatedAt: new Date('2026-04-04T10:00:00.000Z'),
          messages: [],
        })),
      } as any,
      asyncTurnRepository as any,
      {
        getTenantId: () => 'tenant-alpha',
        getTraceId: () => 'trace-request',
        run: (_context: any, callback: () => unknown) => callback(),
      } as any,
      traceLogService as any,
      {
        calculateFlushAt: jest.fn(({ acceptedAt }: { acceptedAt: Date }) => ({
          stabilizationDelayMs: 1000,
          flushAt: new Date(acceptedAt.getTime() + 1000),
        })),
        buildSemanticInput: jest.fn((messages: string[]) => messages.join('\n')),
        estimateReplyDelay: jest.fn(() => 2000),
      } as any,
      new AsyncTurnExecutionControlService(),
      semanticTurnExecutionService as any,
    );

    const firstAccepted = await service.acceptMessage({
      message: 'reservar para manana',
      locale: 'es',
      channel: 'webchat_async',
    });

    await jest.advanceTimersByTimeAsync(1000);

    const processingSession = await service.getSession(firstAccepted.conversationId);
    expect(processingSession.presence).toEqual(
      expect.objectContaining({
        state: 'processing',
        awaitingReply: true,
        turnId: firstAccepted.turn.id,
      }),
    );

    const secondAccepted = await service.acceptMessage({
      conversationId: firstAccepted.conversationId,
      message: 'espera, mejor para pasado manana',
      locale: 'es',
    });

    const supersededTurn = await service.getTurn(firstAccepted.turn.id);
    expect(supersededTurn).toEqual(
      expect.objectContaining({
        internalStatus: AsyncConversationTurnStatus.SUPERSEDED,
        supersededByTurnId: secondAccepted.turn.id,
      }),
    );
    expect(activeAbortSignal?.aborted).toBe(true);

    await Promise.resolve();
    await Promise.resolve();
    await jest.runOnlyPendingTimersAsync();

    expect(semanticTurnExecutionService.projectAssistantReply).not.toHaveBeenCalled();
    expect(traceLogService.recordStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'async_turn',
        status: 'superseded',
        payload: expect.objectContaining({
          turnId: firstAccepted.turn.id,
          supersededByTurnId: secondAccepted.turn.id,
          previousStatus: AsyncConversationTurnStatus.PROCESSING,
        }),
      }),
    );
    expect(traceLogService.recordStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'async_turn',
        status: 'canceled',
        payload: expect.objectContaining({
          turnId: firstAccepted.turn.id,
          supersededByTurnId: secondAccepted.turn.id,
        }),
      }),
    );
  });
});

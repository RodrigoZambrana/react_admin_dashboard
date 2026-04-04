import {
  AsyncConversationTurn,
  AsyncConversationTurnInput,
  AsyncConversationTurnStatus,
  Prisma,
} from '@prisma/client';
import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { ConversationRepository } from '../persistence/repositories/conversation.repository';
import { AsyncConversationTurnRepository } from '../persistence/repositories/async-conversation-turn.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { TraceLogService } from './trace-log.service';
import { AsyncChatMessageDto } from './dto/async-chat-message.dto';
import {
  AsyncChatAcceptedResponse,
  AsyncChatConversationSummary,
  AsyncChatSessionView,
  AsyncChatTurnView,
  AsyncPresenceState,
} from './async-chat.types';
import { AsyncTurnTimingPolicyService } from './async-turn-timing-policy.service';
import { AsyncTurnExecutionControlService } from './async-turn-execution-control.service';
import { SemanticTurnExecutionService } from './semantic-turn-execution.service';
import { isAbortError } from '../shared/abort.utils';

type AsyncTurnRecord = AsyncConversationTurn & {
  inputs: AsyncConversationTurnInput[];
};

const ACTIVE_ASYNC_TURN_STATUSES = new Set<AsyncConversationTurnStatus>([
  AsyncConversationTurnStatus.STABILIZING,
  AsyncConversationTurnStatus.PROCESSING,
  AsyncConversationTurnStatus.AWAITING_REPLY,
]);

@Injectable()
export class AsyncTurnIntakeService implements OnModuleInit, OnModuleDestroy {
  private readonly stabilizationTimers = new Map<string, NodeJS.Timeout>();
  private readonly projectionTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly asyncTurnRepository: AsyncConversationTurnRepository,
    private readonly tenantContext: TenantContextService,
    private readonly traceLogService: TraceLogService,
    private readonly timingPolicy: AsyncTurnTimingPolicyService,
    private readonly asyncTurnExecutionControl: AsyncTurnExecutionControlService,
    private readonly semanticTurnExecutionService: SemanticTurnExecutionService,
  ) {}

  async onModuleInit() {
    const recoverableTurns = await this.asyncTurnRepository.listRecoverableTurns();

    for (const turn of recoverableTurns) {
      if (turn.status === AsyncConversationTurnStatus.STABILIZING) {
        this.scheduleStabilization(turn);
        continue;
      }

      if (turn.status === AsyncConversationTurnStatus.AWAITING_REPLY) {
        this.scheduleReplyProjection(turn);
        continue;
      }

      await this.runWithTurnContext(turn, async () => {
        await this.asyncTurnRepository.markFailed({
          turnId: turn.id,
          errorCode: 'recovery_interrupted',
          errorMessage:
            'Async processing was interrupted before completion and must be retried by a new inbound message.',
          metadata: {
            recovery: 'module_init',
          },
        });
        await this.traceLogService.recordStage({
          conversationId: turn.conversationId,
          stage: 'async_turn',
          status: 'failed',
          payload: {
            turnId: turn.id,
            errorCode: 'recovery_interrupted',
            errorMessage:
              'Async processing was interrupted before completion and must be retried by a new inbound message.',
          },
        });
      });
    }
  }

  async onModuleDestroy() {
    this.clearAllTimers();
  }

  async acceptMessage(input: AsyncChatMessageDto): Promise<AsyncChatAcceptedResponse> {
    const conversation = await this.resolveConversation(input);
    const activeTurns = await this.asyncTurnRepository.listActiveTurns(
      conversation.id,
    );
    const existingTurn =
      [...activeTurns]
        .reverse()
        .find((turn) => turn.status === AsyncConversationTurnStatus.STABILIZING) ??
      null;
    const acceptedAt = new Date();
    const turn = existingTurn
      ? await this.appendToStabilizingTurn(existingTurn, input)
      : await this.createStabilizingTurn(conversation.id, input, acceptedAt);

    if (!existingTurn) {
      await this.supersedeActiveTurns({
        conversationId: conversation.id,
        activeTurns,
        supersededByTurnId: turn.id,
      });
    }

    await this.runWithTurnContext(turn, async () => {
      await this.traceLogService.recordStage({
        conversationId: turn.conversationId,
        stage: 'async_intake',
        status: existingTurn ? 'coalesced' : 'accepted',
        payload: {
          turnId: turn.id,
          acceptedAt: turn.acceptedAt.toISOString(),
          flushAt: turn.flushAt.toISOString(),
          coalescedInputCount: turn.inputCount,
          stabilizationDelayMs: turn.stabilizationDelayMs,
          channel: conversation.channel,
        },
      });
    });

    this.scheduleStabilization(turn);

    return {
      conversationId: conversation.id,
      turn: this.mapTurn(turn),
      presence: this.buildPresence(turn),
    };
  }

  async listRecentConversations(
    limit = 12,
  ): Promise<AsyncChatConversationSummary[]> {
    const conversations = await this.conversationRepository.listRecentByChannel(
      'webchat_async',
      limit,
    );

    return Promise.all(
      conversations.map(async (conversation) => {
        const activeTurn =
          (await this.asyncTurnRepository.listActiveTurns(conversation.id)).at(-1) ??
          null;
        const latestMessage = conversation.messages[0] ?? null;
        const latestPendingInput = activeTurn?.inputs.at(-1) ?? null;
        const latestPreview =
          latestPendingInput?.content?.trim() ||
          latestMessage?.content?.trim() ||
          null;
        const latestTimestamp =
          latestPendingInput?.receivedAt?.toISOString() ??
          latestMessage?.createdAt?.toISOString() ??
          null;
        const presence = this.buildPresence(activeTurn);

        return {
          conversationId: conversation.id,
          language: conversation.language ?? null,
          channel: conversation.channel,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
          presence: presence.state,
          awaitingReply: presence.awaitingReply,
          activeTurnId: activeTurn?.id ?? null,
          latestPreview,
          latestMessageRole: latestMessage?.role ?? null,
          latestTimestamp,
        };
      }),
    );
  }

  async getSession(conversationId: string): Promise<AsyncChatSessionView> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new NotFoundException(
        `Conversation "${conversationId}" was not found for async chat session sync.`,
      );
    }

    const turns = await this.asyncTurnRepository.getSessionTurns(conversationId);
    const activeTurn =
      turns.find((turn) => ACTIVE_ASYNC_TURN_STATUSES.has(turn.status)) ?? null;
    const latestCompletedTurn =
      turns.find((turn) => turn.status === AsyncConversationTurnStatus.COMPLETED) ??
      null;

    return {
      conversation: {
        id: conversation.id,
        language: conversation.language ?? null,
        channel: conversation.channel,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      },
      presence: this.buildPresence(activeTurn),
      activeTurn: activeTurn ? this.mapTurn(activeTurn) : null,
      latestCompletedTurn: latestCompletedTurn
        ? this.mapTurn(latestCompletedTurn)
        : null,
      turns: turns.map((turn) => this.mapTurn(turn)),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        metadata: (message.metadata ?? null) as Record<string, unknown> | null,
      })),
    };
  }

  async getTurn(turnId: string): Promise<AsyncChatTurnView> {
    const turn = await this.asyncTurnRepository.findById(turnId);

    if (!turn) {
      throw new NotFoundException(`Async turn "${turnId}" was not found.`);
    }

    return this.mapTurn(turn);
  }

  private async createStabilizingTurn(
    conversationId: string,
    input: AsyncChatMessageDto,
    acceptedAt: Date,
  ) {
    const timing = await this.timingPolicy.calculateFlushAt({
      acceptedAt,
      messages: [input.message],
      locale: input.locale ?? null,
    });

    return this.asyncTurnRepository.createTurnWithInitialInput({
      conversationId,
      traceId: randomUUID(),
      content: input.message,
      locale: input.locale ?? null,
      semanticInput: this.timingPolicy.buildSemanticInput([input.message]),
      acceptedAt,
      flushAt: timing.flushAt,
      stabilizationDelayMs: timing.stabilizationDelayMs,
      metadata: {
        source: 'async_chat',
      },
    });
  }

  private async appendToStabilizingTurn(
    turn: AsyncTurnRecord,
    input: AsyncChatMessageDto,
  ) {
    const messages = [...turn.inputs.map((entry) => entry.content), input.message];
    const timing = await this.timingPolicy.calculateFlushAt({
      acceptedAt: turn.acceptedAt,
      messages,
      locale: input.locale ?? turn.locale,
    });

    return this.asyncTurnRepository.appendInputAndRefreshTurn({
      turnId: turn.id,
      content: input.message,
      locale: input.locale ?? null,
      semanticInput: this.timingPolicy.buildSemanticInput(messages),
      inputCount: messages.length,
      stabilizationDelayMs: timing.stabilizationDelayMs,
      flushAt: timing.flushAt,
    });
  }

  private scheduleStabilization(turn: AsyncTurnRecord) {
    this.clearTimer(this.stabilizationTimers, turn.id);

    const delayMs = Math.max(0, turn.flushAt.getTime() - Date.now());
    const timer = setTimeout(() => {
      void this.flushSemanticTurn(turn.id);
    }, delayMs);

    this.stabilizationTimers.set(turn.id, timer);
  }

  private scheduleReplyProjection(turn: AsyncTurnRecord) {
    this.clearTimer(this.projectionTimers, turn.id);

    const delayMs = Math.max(
      0,
      (turn.replyDueAt?.getTime() ?? Date.now()) - Date.now(),
    );
    const timer = setTimeout(() => {
      void this.projectPendingReply(turn.id);
    }, delayMs);

    this.projectionTimers.set(turn.id, timer);
  }

  private async flushSemanticTurn(turnId: string) {
    this.clearTimer(this.stabilizationTimers, turnId);

    const turn = await this.asyncTurnRepository.findById(turnId);

    if (!turn || turn.status !== AsyncConversationTurnStatus.STABILIZING) {
      return;
    }

    const processingStartedAt = new Date();

    await this.runWithTurnContext(turn, async () => {
      await this.asyncTurnRepository.markProcessing(turn.id, processingStartedAt);
      await this.traceLogService.recordStage({
        conversationId: turn.conversationId,
        stage: 'async_turn',
        status: 'closed',
        payload: {
          turnId: turn.id,
          coalescedInputCount: turn.inputCount,
          semanticInput: turn.semanticInput,
          flushAt: turn.flushAt.toISOString(),
        },
      });
    });

    const executionControl = this.asyncTurnExecutionControl.acquire(turn.id);

    try {
      const result = await this.runWithTurnContext(turn, () =>
        this.semanticTurnExecutionService.executeClosedTurn(
          {
            conversationId: turn.conversationId,
            message: turn.semanticInput,
            locale: turn.locale ?? undefined,
          },
          {
            projectReplyImmediately: false,
            abortSignal: executionControl.signal,
          },
        ),
      );
      const currentTurn = await this.asyncTurnRepository.findById(turn.id);

      if (!currentTurn) {
        return;
      }

      if (currentTurn.status === AsyncConversationTurnStatus.SUPERSEDED) {
        await this.runWithTurnContext(currentTurn, async () => {
          await this.traceLogService.recordStage({
            conversationId: currentTurn.conversationId,
            stage: 'reply_projection',
            status: 'superseded',
            payload: {
              turnId: currentTurn.id,
              supersededByTurnId: currentTurn.supersededByTurnId,
              replyProjectionStatus: 'discarded_before_queue',
            },
          });
        });
        return;
      }

      if (currentTurn.status !== AsyncConversationTurnStatus.PROCESSING) {
        return;
      }

      const processingCompletedAt = new Date();
      const replyDelayMs = await this.timingPolicy.estimateReplyDelay(result.response);
      const replyDueAt = new Date(
        processingCompletedAt.getTime() + replyDelayMs,
      );

      const awaitingReplyTurn = await this.runWithTurnContext(currentTurn, async () => {
        const updatedTurn = await this.asyncTurnRepository.markAwaitingReply({
          turnId: currentTurn.id,
          completedAt: processingCompletedAt,
          replyDueAt,
          replyDelayMs,
          replyText: result.response,
          replyMessageMetadata: result.assistantMessageMetadata,
          resultSummary: {
            intent: result.intent,
            decisionAction: result.decision.action,
            toolName: result.decision.toolName ?? null,
            executionStatus: result.execution
              ? result.execution.ok
                ? 'completed'
                : 'failed'
              : 'not_applicable',
            responseFallbackReason:
              result.approvedResponse.fallbackReason ?? null,
          },
        });

        await this.traceLogService.recordStage({
          conversationId: currentTurn.conversationId,
          stage: 'reply_projection',
          status: 'queued',
          payload: {
            turnId: currentTurn.id,
            replyDueAt: replyDueAt.toISOString(),
            replyDelayMs,
          },
        });

        return updatedTurn;
      });

      this.scheduleReplyProjection(awaitingReplyTurn);
    } catch (error) {
      const currentTurn = await this.asyncTurnRepository.findById(turn.id);

      if (
        isAbortError(error) &&
        currentTurn?.status === AsyncConversationTurnStatus.SUPERSEDED
      ) {
        await this.runWithTurnContext(currentTurn, async () => {
          await this.traceLogService.recordStage({
            conversationId: currentTurn.conversationId,
            stage: 'async_turn',
            status: 'canceled',
            payload: {
              turnId: currentTurn.id,
              supersededByTurnId: currentTurn.supersededByTurnId,
              reason: 'superseded_during_processing',
            },
          });
        });
        return;
      }

      await this.runWithTurnContext(turn, async () => {
        await this.asyncTurnRepository.markFailed({
          turnId: turn.id,
          errorCode: 'processing_failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          metadata: {
            source: 'flushSemanticTurn',
          },
        });
        await this.traceLogService.recordStage({
          conversationId: turn.conversationId,
          stage: 'async_turn',
          status: 'failed',
          payload: {
            turnId: turn.id,
            errorCode: 'processing_failed',
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        });
      });
    } finally {
      executionControl.release();
    }
  }

  private async projectPendingReply(turnId: string) {
    this.clearTimer(this.projectionTimers, turnId);

    const turn = await this.asyncTurnRepository.findById(turnId);

    if (
      !turn ||
      turn.status !== AsyncConversationTurnStatus.AWAITING_REPLY ||
      !turn.replyText
    ) {
      return;
    }

    try {
      const assistantMessage = await this.runWithTurnContext(turn, async () => {
        const projected = await this.semanticTurnExecutionService.projectAssistantReply({
          conversationId: turn.conversationId,
          response: turn.replyText!,
          assistantMessageMetadata:
            (turn.replyMessageMetadata ?? null) as Prisma.InputJsonValue,
        });

        await this.traceLogService.recordStage({
          conversationId: turn.conversationId,
          stage: 'reply_projection',
          status: 'completed',
          payload: {
            turnId: turn.id,
            assistantMessageId: projected.id,
          },
        });

        return projected;
      });

      await this.runWithTurnContext(turn, async () => {
        await this.asyncTurnRepository.markCompleted({
          turnId: turn.id,
          projectedAt: new Date(),
          assistantMessageId: assistantMessage.id,
        });
      });
    } catch (error) {
      await this.runWithTurnContext(turn, async () => {
        await this.asyncTurnRepository.markFailed({
          turnId: turn.id,
          errorCode: 'reply_projection_failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          metadata: {
            source: 'projectPendingReply',
          },
        });
        await this.traceLogService.recordStage({
          conversationId: turn.conversationId,
          stage: 'reply_projection',
          status: 'failed',
          payload: {
            turnId: turn.id,
            errorCode: 'reply_projection_failed',
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        });
      });
    }
  }

  private async supersedeActiveTurns(input: {
    conversationId: string;
    activeTurns: AsyncTurnRecord[];
    supersededByTurnId: string;
  }) {
    const candidates = input.activeTurns.filter(
      (turn) =>
        turn.id !== input.supersededByTurnId &&
        turn.status !== AsyncConversationTurnStatus.STABILIZING,
    );

    if (candidates.length === 0) {
      return;
    }

    const supersededAt = new Date();

    for (const turn of candidates) {
      this.clearTimer(this.stabilizationTimers, turn.id);
      this.clearTimer(this.projectionTimers, turn.id);
      const cancellationRequested = this.asyncTurnExecutionControl.cancel(
        turn.id,
        'superseded_by_new_inbound_message',
      );

      await this.runWithTurnContext(turn, async () => {
        await this.asyncTurnRepository.markSuperseded({
          turnId: turn.id,
          supersededByTurnId: input.supersededByTurnId,
          supersededAt,
          metadata: {
            source: 'new_inbound_message',
            previousStatus: turn.status,
          },
        });
        await this.traceLogService.recordStage({
          conversationId: input.conversationId,
          stage: 'async_turn',
          status: 'superseded',
          payload: {
            turnId: turn.id,
            supersededByTurnId: input.supersededByTurnId,
            previousStatus: turn.status,
            supersededAt: supersededAt.toISOString(),
            reason: 'new_inbound_message',
            cancellationRequested,
          },
        });

        if (turn.status === AsyncConversationTurnStatus.AWAITING_REPLY) {
          await this.traceLogService.recordStage({
            conversationId: input.conversationId,
            stage: 'reply_projection',
            status: 'superseded',
            payload: {
              turnId: turn.id,
              supersededByTurnId: input.supersededByTurnId,
              previousStatus: turn.status,
              supersededAt: supersededAt.toISOString(),
            },
          });
        }
      });
    }
  }

  private buildPresence(turn: AsyncTurnRecord | null): AsyncChatSessionView['presence'] {
    if (!turn) {
      return {
        state: 'idle',
        awaitingReply: false,
        turnId: null,
        acceptedAt: null,
        flushAt: null,
        replyDueAt: null,
      };
    }

    const state = this.mapStatus(turn.status);
    return {
      state,
      awaitingReply:
        state === 'queued' ||
        state === 'processing' ||
        state === 'awaiting_reply',
      turnId: turn.id,
      acceptedAt: turn.acceptedAt.toISOString(),
      flushAt: turn.flushAt.toISOString(),
      replyDueAt: turn.replyDueAt?.toISOString() ?? null,
    };
  }

  private mapTurn(turn: AsyncTurnRecord): AsyncChatTurnView {
    return {
      id: turn.id,
      conversationId: turn.conversationId,
      status: this.mapStatus(turn.status),
      internalStatus: turn.status,
      traceId: turn.traceId,
      locale: turn.locale ?? null,
      acceptedAt: turn.acceptedAt.toISOString(),
      firstInputAt: turn.firstInputAt.toISOString(),
      lastInputAt: turn.lastInputAt.toISOString(),
      processingStartedAt: turn.processingStartedAt?.toISOString() ?? null,
      processingCompletedAt: turn.processingCompletedAt?.toISOString() ?? null,
      flushAt: turn.flushAt.toISOString(),
      replyDueAt: turn.replyDueAt?.toISOString() ?? null,
      projectedAt: turn.projectedAt?.toISOString() ?? null,
      supersededAt: turn.supersededAt?.toISOString() ?? null,
      stabilizationDelayMs: turn.stabilizationDelayMs,
      replyDelayMs: turn.replyDelayMs,
      inputCount: turn.inputCount,
      semanticInput: turn.semanticInput,
      assistantMessageId: turn.assistantMessageId ?? null,
      supersededByTurnId: turn.supersededByTurnId ?? null,
      errorCode: turn.errorCode ?? null,
      errorMessage: turn.errorMessage ?? null,
      resultSummary:
        (turn.resultSummary ?? null) as Record<string, unknown> | null,
      inputs: turn.inputs.map((entry) => ({
        id: entry.id,
        sequence: entry.sequence,
        content: entry.content,
        locale: entry.locale ?? null,
        receivedAt: entry.receivedAt.toISOString(),
      })),
    };
  }

  private mapStatus(status: AsyncConversationTurnStatus): AsyncPresenceState {
    switch (status) {
      case AsyncConversationTurnStatus.STABILIZING:
        return 'queued';
      case AsyncConversationTurnStatus.PROCESSING:
        return 'processing';
      case AsyncConversationTurnStatus.AWAITING_REPLY:
        return 'awaiting_reply';
      case AsyncConversationTurnStatus.COMPLETED:
        return 'completed';
      case AsyncConversationTurnStatus.SUPERSEDED:
        return 'superseded';
      case AsyncConversationTurnStatus.FAILED:
        return 'failed';
      default:
        return 'idle';
    }
  }

  private async resolveConversation(input: AsyncChatMessageDto) {
    if (input.conversationId) {
      const existing = await this.conversationRepository.findById(
        input.conversationId,
      );

      if (existing) {
        return existing;
      }
    }

    return this.conversationRepository.createConversation(
      input.locale,
      input.channel ?? 'webchat_async',
    );
  }

  private async runWithTurnContext<T>(
    turn: {
      tenantId: string;
      traceId: string;
    },
    callback: () => Promise<T>,
  ) {
    return this.tenantContext.run(
      {
        tenantId: turn.tenantId,
        traceId: turn.traceId,
      },
      callback,
    );
  }

  private clearTimer(
    timers: Map<string, NodeJS.Timeout>,
    turnId: string,
  ) {
    const timer = timers.get(turnId);

    if (timer) {
      clearTimeout(timer);
      timers.delete(turnId);
    }
  }

  private clearAllTimers() {
    for (const timer of this.stabilizationTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.projectionTimers.values()) {
      clearTimeout(timer);
    }
    this.stabilizationTimers.clear();
    this.projectionTimers.clear();
  }
}

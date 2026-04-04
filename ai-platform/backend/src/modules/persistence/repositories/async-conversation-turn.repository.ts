import {
  AsyncConversationTurnStatus,
  Prisma,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class AsyncConversationTurnRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  createTurn(input: {
    conversationId: string;
    traceId: string;
    locale?: string | null;
    semanticInput: string;
    acceptedAt: Date;
    flushAt: Date;
    stabilizationDelayMs: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    const tenantId = this.tenantContext.getTenantId();

    return this.prisma.asyncConversationTurn.create({
      data: {
        tenantId,
        conversationId: input.conversationId,
        status: AsyncConversationTurnStatus.STABILIZING,
        traceId: input.traceId,
        locale: input.locale ?? null,
        acceptedAt: input.acceptedAt,
        firstInputAt: input.acceptedAt,
        lastInputAt: input.acceptedAt,
        flushAt: input.flushAt,
        stabilizationDelayMs: input.stabilizationDelayMs,
        semanticInput: input.semanticInput,
        metadata: input.metadata,
      },
    });
  }

  findById(turnId: string) {
    return this.prisma.asyncConversationTurn.findFirst({
      where: { id: turnId },
      include: {
        inputs: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  findLatestStabilizingTurn(conversationId: string) {
    return this.prisma.asyncConversationTurn.findFirst({
      where: {
        conversationId,
        status: AsyncConversationTurnStatus.STABILIZING,
      },
      orderBy: {
        acceptedAt: 'desc',
      },
      include: {
        inputs: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  listRecoverableTurns() {
    return this.prisma.asyncConversationTurn.findMany({
      where: {
        status: {
          in: [
            AsyncConversationTurnStatus.STABILIZING,
            AsyncConversationTurnStatus.PROCESSING,
            AsyncConversationTurnStatus.AWAITING_REPLY,
          ],
        },
      },
      orderBy: {
        acceptedAt: 'asc',
      },
      include: {
        inputs: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  listActiveTurns(conversationId: string) {
    return this.prisma.asyncConversationTurn.findMany({
      where: {
        conversationId,
        status: {
          in: [
            AsyncConversationTurnStatus.STABILIZING,
            AsyncConversationTurnStatus.PROCESSING,
            AsyncConversationTurnStatus.AWAITING_REPLY,
          ],
        },
      },
      orderBy: {
        acceptedAt: 'asc',
      },
      include: {
        inputs: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  getSessionTurns(conversationId: string) {
    return this.prisma.asyncConversationTurn.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        acceptedAt: 'desc',
      },
      take: 10,
      include: {
        inputs: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  async appendInputAndRefreshTurn(input: {
    turnId: string;
    content: string;
    locale?: string | null;
    semanticInput: string;
    inputCount: number;
    stabilizationDelayMs: number;
    flushAt: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const currentTurn = await tx.asyncConversationTurn.findFirst({
        where: {
          id: input.turnId,
        },
        include: {
          inputs: {
            orderBy: {
              sequence: 'desc',
            },
            take: 1,
          },
        },
      });

      if (!currentTurn) {
        throw new Error(`Async turn "${input.turnId}" was not found.`);
      }

      const nextSequence = (currentTurn.inputs[0]?.sequence ?? -1) + 1;
      const receivedAt = new Date();

      await tx.asyncConversationTurnInput.create({
        data: {
          tenantId: this.tenantContext.getTenantId(),
          turnId: input.turnId,
          sequence: nextSequence,
          content: input.content,
          locale: input.locale ?? null,
          receivedAt,
        },
      });

      return tx.asyncConversationTurn.update({
        where: {
          id: input.turnId,
        },
        data: {
          locale: input.locale ?? currentTurn.locale,
          lastInputAt: receivedAt,
          inputCount: input.inputCount,
          semanticInput: input.semanticInput,
          stabilizationDelayMs: input.stabilizationDelayMs,
          flushAt: input.flushAt,
        },
        include: {
          inputs: {
            orderBy: {
              sequence: 'asc',
            },
          },
        },
      });
    });
  }

  async createTurnWithInitialInput(input: {
    conversationId: string;
    traceId: string;
    content: string;
    locale?: string | null;
    semanticInput: string;
    acceptedAt: Date;
    flushAt: Date;
    stabilizationDelayMs: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    const tenantId = this.tenantContext.getTenantId();

    return this.prisma.$transaction(async (tx) => {
      const turn = await tx.asyncConversationTurn.create({
        data: {
          tenantId,
          conversationId: input.conversationId,
          status: AsyncConversationTurnStatus.STABILIZING,
          traceId: input.traceId,
          locale: input.locale ?? null,
          acceptedAt: input.acceptedAt,
          firstInputAt: input.acceptedAt,
          lastInputAt: input.acceptedAt,
          flushAt: input.flushAt,
          stabilizationDelayMs: input.stabilizationDelayMs,
          inputCount: 1,
          semanticInput: input.semanticInput,
          metadata: input.metadata,
        },
      });

      await tx.asyncConversationTurnInput.create({
        data: {
          tenantId,
          turnId: turn.id,
          sequence: 0,
          content: input.content,
          locale: input.locale ?? null,
          receivedAt: input.acceptedAt,
        },
      });

      return tx.asyncConversationTurn.findUniqueOrThrow({
        where: {
          id: turn.id,
        },
        include: {
          inputs: {
            orderBy: {
              sequence: 'asc',
            },
          },
        },
      });
    });
  }

  markProcessing(turnId: string, startedAt: Date) {
    return this.prisma.asyncConversationTurn.update({
      where: { id: turnId },
      data: {
        status: AsyncConversationTurnStatus.PROCESSING,
        processingStartedAt: startedAt,
      },
      include: {
        inputs: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  markAwaitingReply(input: {
    turnId: string;
    completedAt: Date;
    replyDueAt: Date;
    replyDelayMs: number;
    replyText: string;
    replyMessageMetadata: Prisma.InputJsonValue;
    resultSummary: Prisma.InputJsonValue;
  }) {
    return this.prisma.asyncConversationTurn.update({
      where: { id: input.turnId },
      data: {
        status: AsyncConversationTurnStatus.AWAITING_REPLY,
        processingCompletedAt: input.completedAt,
        replyDueAt: input.replyDueAt,
        replyDelayMs: input.replyDelayMs,
        replyText: input.replyText,
        replyMessageMetadata: input.replyMessageMetadata,
        resultSummary: input.resultSummary,
      },
      include: {
        inputs: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  markCompleted(input: {
    turnId: string;
    projectedAt: Date;
    assistantMessageId: string;
  }) {
    return this.prisma.asyncConversationTurn.update({
      where: { id: input.turnId },
      data: {
        status: AsyncConversationTurnStatus.COMPLETED,
        projectedAt: input.projectedAt,
        assistantMessageId: input.assistantMessageId,
      },
      include: {
        inputs: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  markSuperseded(input: {
    turnId: string;
    supersededByTurnId: string;
    supersededAt: Date;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.asyncConversationTurn.update({
      where: { id: input.turnId },
      data: {
        status: AsyncConversationTurnStatus.SUPERSEDED,
        supersededAt: input.supersededAt,
        supersededByTurnId: input.supersededByTurnId,
        metadata: input.metadata,
      },
      include: {
        inputs: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  markFailed(input: {
    turnId: string;
    errorCode: string;
    errorMessage: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.asyncConversationTurn.update({
      where: { id: input.turnId },
      data: {
        status: AsyncConversationTurnStatus.FAILED,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        metadata: input.metadata,
      },
      include: {
        inputs: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }
}

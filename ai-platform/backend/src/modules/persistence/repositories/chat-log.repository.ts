import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type CreateChatLogInput = {
  conversationId?: string;
  traceId: string;
  stage: string;
  status: string;
  payload: Prisma.InputJsonValue;
  latencyMs?: number;
};

@Injectable()
export class ChatLogRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  createLog(input: CreateChatLogInput) {
    const tenantId = this.tenantContext.getTenantId();

    return this.prisma.chatLog.create({
      data: {
        tenantId,
        traceId: input.traceId,
        stage: input.stage,
        status: input.status,
        payload: input.payload,
        latencyMs: input.latencyMs,
        conversationId: input.conversationId,
      },
    });
  }

  findById(id: string) {
    return this.prisma.chatLog.findFirst({
      where: { id },
    });
  }

  listRecent(limit = 100) {
    return this.prisma.chatLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  getTrace(traceId: string) {
    return this.prisma.chatLog.findMany({
      where: { traceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  listByConversationId(conversationId: string) {
    return this.prisma.chatLog.findMany({
      where: {
        conversationId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

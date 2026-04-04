import { Injectable } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class ConversationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  createConversation(language?: string, channel = 'web') {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.conversation.create({
      data: {
        tenantId,
        language,
        channel,
      },
    });
  }

  findById(id: string) {
    return this.prisma.conversation.findFirst({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  listRecent(limit = 20) {
    return this.prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  listRecentByChannel(channel: string, limit = 20) {
    return this.prisma.conversation.findMany({
      where: {
        channel,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  appendMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.message.create({
      data: {
        tenantId,
        conversationId,
        role,
        content,
        metadata,
      },
    });
  }
}

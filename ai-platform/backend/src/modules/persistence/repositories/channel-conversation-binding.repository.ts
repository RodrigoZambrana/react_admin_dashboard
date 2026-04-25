import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type UpsertChannelConversationBindingInput = {
  conversationId: string;
  channel: string;
  threadId: string;
  userId: string;
  inboxAccountId?: string | null;
  inboxAddress?: string | null;
  displayName?: string | null;
  email?: string | null;
  queueSlug?: string | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class ChannelConversationBindingRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  findByThread(channel: string, threadId: string) {
    const tenantId = this.tenantContext.getTenantId();
    return (this.prisma as any).channelConversationBinding.findFirst({
      where: {
        tenantId,
        channel,
        threadId,
      },
    });
  }

  upsert(input: UpsertChannelConversationBindingInput) {
    const tenantId = this.tenantContext.getTenantId();
    return (this.prisma as any).channelConversationBinding.upsert({
      where: {
        tenantId_channel_threadId: {
          tenantId,
          channel: input.channel,
          threadId: input.threadId,
        },
      },
      update: {
        conversationId: input.conversationId,
        userId: input.userId,
        inboxAccountId: input.inboxAccountId ?? null,
        inboxAddress: input.inboxAddress ?? null,
        displayName: input.displayName ?? null,
        email: input.email ?? null,
        queueSlug: input.queueSlug ?? null,
        metadata: input.metadata,
      },
      create: {
        tenantId,
        conversationId: input.conversationId,
        channel: input.channel,
        threadId: input.threadId,
        userId: input.userId,
        inboxAccountId: input.inboxAccountId ?? null,
        inboxAddress: input.inboxAddress ?? null,
        displayName: input.displayName ?? null,
        email: input.email ?? null,
        queueSlug: input.queueSlug ?? null,
        metadata: input.metadata,
      },
    });
  }
}

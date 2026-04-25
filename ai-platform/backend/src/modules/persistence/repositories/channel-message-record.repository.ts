import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type UpsertChannelMessageRecordInput = {
  conversationId: string;
  channel: string;
  externalMessageId: string;
  providerMessageId?: string | null;
  remoteId?: string | null;
  direction: string;
  status?: string | null;
  occurredAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class ChannelMessageRecordRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  findByExternalMessageId(channel: string, externalMessageId: string) {
    const tenantId = this.tenantContext.getTenantId();
    return (this.prisma as any).channelMessageRecord.findFirst({
      where: {
        tenantId,
        channel,
        externalMessageId,
      },
    });
  }

  upsert(input: UpsertChannelMessageRecordInput) {
    const tenantId = this.tenantContext.getTenantId();
    return (this.prisma as any).channelMessageRecord.upsert({
      where: {
        tenantId_channel_externalMessageId: {
          tenantId,
          channel: input.channel,
          externalMessageId: input.externalMessageId,
        },
      },
      update: {
        conversationId: input.conversationId,
        providerMessageId: input.providerMessageId ?? null,
        remoteId: input.remoteId ?? null,
        direction: input.direction,
        status: input.status ?? null,
        occurredAt: input.occurredAt ?? null,
        metadata: input.metadata,
      },
      create: {
        tenantId,
        conversationId: input.conversationId,
        channel: input.channel,
        externalMessageId: input.externalMessageId,
        providerMessageId: input.providerMessageId ?? null,
        remoteId: input.remoteId ?? null,
        direction: input.direction,
        status: input.status ?? null,
        occurredAt: input.occurredAt ?? null,
        metadata: input.metadata,
      },
    });
  }
}

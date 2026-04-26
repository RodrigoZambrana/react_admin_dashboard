import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

export const DEFAULT_CONVERSATION_ACTOR_KEY = 'global';

export type ConversationMutePreset = 'off' | '8h' | '7d';

export type UpsertConversationOperatorStateInput = {
  conversationId: string;
  actorKey?: string | null;
  lastReadAt?: Date | null;
  manualUnread?: boolean;
  pinnedAt?: Date | null;
  archivedAt?: Date | null;
  mutedUntil?: Date | null;
  mutePreset?: string | null;
  deletedAt?: Date | null;
  metadata?: Prisma.InputJsonValue | null;
};

@Injectable()
export class ConversationOperatorStateRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  listByConversationIds(conversationIds: string[], actorKey?: string | null) {
    const tenantId = this.tenantContext.getTenantId();

    if (!conversationIds.length) {
      return Promise.resolve([]);
    }

    return this.prisma.conversationOperatorState.findMany({
      where: {
        tenantId,
        conversationId: {
          in: conversationIds,
        },
        actorKey: this.resolveActorKey(actorKey),
      },
    });
  }

  find(conversationId: string, actorKey?: string | null) {
    const tenantId = this.tenantContext.getTenantId();

    return this.prisma.conversationOperatorState.findUnique({
      where: {
        tenantId_conversationId_actorKey: {
          tenantId,
          conversationId,
          actorKey: this.resolveActorKey(actorKey),
        },
      },
    });
  }

  upsert(input: UpsertConversationOperatorStateInput) {
    const tenantId = this.tenantContext.getTenantId();
    const actorKey = this.resolveActorKey(input.actorKey);
    const data = this.buildStateData(input);

    return this.prisma.conversationOperatorState.upsert({
      where: {
        tenantId_conversationId_actorKey: {
          tenantId,
          conversationId: input.conversationId,
          actorKey,
        },
      },
      create: {
        tenantId,
        conversationId: input.conversationId,
        actorKey,
        ...data,
      },
      update: data,
    });
  }

  private buildStateData(input: UpsertConversationOperatorStateInput) {
    const data: {
      lastReadAt?: Date | null;
      manualUnread?: boolean;
      pinnedAt?: Date | null;
      archivedAt?: Date | null;
      mutedUntil?: Date | null;
      mutePreset?: string | null;
      deletedAt?: Date | null;
      metadata?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    } = {};

    if ('lastReadAt' in input) {
      data.lastReadAt = input.lastReadAt;
    }

    if ('manualUnread' in input && typeof input.manualUnread === 'boolean') {
      data.manualUnread = input.manualUnread;
    }

    if ('pinnedAt' in input) {
      data.pinnedAt = input.pinnedAt;
    }

    if ('archivedAt' in input) {
      data.archivedAt = input.archivedAt;
    }

    if ('mutedUntil' in input) {
      data.mutedUntil = input.mutedUntil;
    }

    if ('mutePreset' in input) {
      data.mutePreset = input.mutePreset;
    }

    if ('deletedAt' in input) {
      data.deletedAt = input.deletedAt;
    }

    if ('metadata' in input) {
      data.metadata = input.metadata ?? Prisma.JsonNull;
    }

    return data;
  }

  private resolveActorKey(actorKey?: string | null) {
    return actorKey?.trim() || DEFAULT_CONVERSATION_ACTOR_KEY;
  }
}

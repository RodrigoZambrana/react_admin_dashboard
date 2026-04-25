import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type UpsertChannelConnectionStateInput = {
  channelKey: string;
  driver: string;
  enabled: boolean;
  connectionState: string;
  health: string;
  summary?: string | null;
  capabilities?: Prisma.InputJsonValue;
  payload: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  observedAt: Date;
};

@Injectable()
export class ChannelConnectionStateRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  findByChannelKey(channelKey: string) {
    const tenantId = this.tenantContext.getTenantId();

    return this.prisma.channelConnectionState.findFirst({
      where: {
        tenantId,
        channelKey,
      },
    });
  }

  listAll() {
    const tenantId = this.tenantContext.getTenantId();

    return this.prisma.channelConnectionState.findMany({
      where: {
        tenantId,
      },
      orderBy: [{ channelKey: 'asc' }],
    });
  }

  upsert(input: UpsertChannelConnectionStateInput) {
    const tenantId = this.tenantContext.getTenantId();

    return this.prisma.channelConnectionState.upsert({
      where: {
        tenantId_channelKey: {
          tenantId,
          channelKey: input.channelKey,
        },
      },
      update: {
        driver: input.driver,
        enabled: input.enabled,
        connectionState: input.connectionState,
        health: input.health,
        summary: input.summary ?? null,
        capabilities: input.capabilities,
        payload: input.payload,
        metadata: input.metadata,
        observedAt: input.observedAt,
      },
      create: {
        tenantId,
        channelKey: input.channelKey,
        driver: input.driver,
        enabled: input.enabled,
        connectionState: input.connectionState,
        health: input.health,
        summary: input.summary ?? null,
        capabilities: input.capabilities,
        payload: input.payload,
        metadata: input.metadata,
        observedAt: input.observedAt,
      },
    });
  }
}

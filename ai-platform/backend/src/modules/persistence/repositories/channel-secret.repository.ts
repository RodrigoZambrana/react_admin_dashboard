import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type UpsertChannelSecretInput = {
  key: string;
  value: string;
  label?: string | null;
};

@Injectable()
export class ChannelSecretRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  findByKey(key: string) {
    const tenantId = this.tenantContext.getTenantId();

    return this.prisma.channelSecret.findFirst({
      where: {
        tenantId,
        key,
      },
    });
  }

  async upsert(input: UpsertChannelSecretInput) {
    const tenantId = this.tenantContext.getTenantId();
    const lastFour = input.value.length > 4 ? input.value.slice(-4) : null;

    return this.prisma.channelSecret.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key: input.key,
        },
      },
      update: {
        value: input.value,
        label: input.label ?? null,
        lastFour,
      },
      create: {
        tenantId,
        key: input.key,
        value: input.value,
        label: input.label ?? null,
        lastFour,
      },
    });
  }
}

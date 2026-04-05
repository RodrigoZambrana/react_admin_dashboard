import { Injectable } from '@nestjs/common';
import { ManagedResourceStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type CreateCriticalConfigVersionInput = {
  key: string;
  value: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  createdBy?: string;
  activate?: boolean;
};

@Injectable()
export class CriticalConfigVersionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getActiveByKey(key: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.criticalConfigVersion.findFirst({
      where: {
        tenantId,
        key,
        status: ManagedResourceStatus.ACTIVE,
      },
      orderBy: { version: 'desc' },
    });
  }

  list(key?: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.criticalConfigVersion.findMany({
      where: {
        tenantId,
        ...(key ? { key } : {}),
      },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  findById(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.criticalConfigVersion.findFirst({
      where: { id, tenantId },
    });
  }

  hasAnyVersions() {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.criticalConfigVersion
      .count({
        where: { tenantId },
      })
      .then((count) => count > 0);
  }

  hasVersionsForKey(key: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.criticalConfigVersion
      .count({
        where: {
          tenantId,
          key,
        },
      })
      .then((count) => count > 0);
  }

  listActive() {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.criticalConfigVersion.findMany({
      where: { tenantId, status: ManagedResourceStatus.ACTIVE },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  async createVersion(input: CreateCriticalConfigVersionInput) {
    const tenantId = this.tenantContext.getTenantId();
    const latest = await this.prisma.criticalConfigVersion.findFirst({
      where: { tenantId, key: input.key },
      orderBy: { version: 'desc' },
    });

    if (input.activate) {
      await this.prisma.criticalConfigVersion.updateMany({
        where: {
          tenantId,
          key: input.key,
          status: ManagedResourceStatus.ACTIVE,
        },
        data: {
          status: ManagedResourceStatus.ARCHIVED,
        },
      });
    }

    return this.prisma.criticalConfigVersion.create({
      data: {
        tenantId,
        key: input.key,
        value: input.value,
        metadata: input.metadata,
        createdBy: input.createdBy,
        version: (latest?.version ?? 0) + 1,
        status: input.activate
          ? ManagedResourceStatus.ACTIVE
          : ManagedResourceStatus.DRAFT,
      },
    });
  }
}

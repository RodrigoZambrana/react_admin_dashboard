import { Injectable } from '@nestjs/common';
import { ManagedResourceStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type CreatePromptVersionInput = {
  key: string;
  template: string;
  metadata?: Prisma.InputJsonValue;
  createdBy?: string;
  activate?: boolean;
};

@Injectable()
export class PromptVersionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getActiveByKey(key: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.promptVersion.findFirst({
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
    return this.prisma.promptVersion.findMany({
      where: {
        tenantId,
        ...(key ? { key } : {}),
      },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  findById(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.promptVersion.findFirst({
      where: { id, tenantId },
    });
  }

  archiveVersion(input: {
    id: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.$transaction(async (tx) => {
      await tx.promptVersion.updateMany({
        where: {
          id: input.id,
          tenantId,
        },
        data: {
          status: ManagedResourceStatus.ARCHIVED,
          metadata: input.metadata,
        },
      });

      return tx.promptVersion.findFirstOrThrow({
        where: {
          id: input.id,
          tenantId,
        },
      });
    });
  }

  hasAnyVersions() {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.promptVersion
      .count({
        where: { tenantId },
      })
      .then((count) => count > 0);
  }

  listActive() {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.promptVersion.findMany({
      where: { tenantId, status: ManagedResourceStatus.ACTIVE },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  async createVersion(input: CreatePromptVersionInput) {
    const tenantId = this.tenantContext.getTenantId();
    const latest = await this.prisma.promptVersion.findFirst({
      where: { tenantId, key: input.key },
      orderBy: { version: 'desc' },
    });

    if (input.activate) {
      await this.prisma.promptVersion.updateMany({
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

    return this.prisma.promptVersion.create({
      data: {
        tenantId,
        key: input.key,
        template: input.template,
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

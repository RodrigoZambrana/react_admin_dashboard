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
    return this.prisma.promptVersion.findFirst({
      where: {
        key,
        status: ManagedResourceStatus.ACTIVE,
      },
      orderBy: { version: 'desc' },
    });
  }

  list(key?: string) {
    return this.prisma.promptVersion.findMany({
      where: key ? { key } : undefined,
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  hasAnyVersions() {
    return this.prisma.promptVersion.count().then((count) => count > 0);
  }

  listActive() {
    return this.prisma.promptVersion.findMany({
      where: { status: ManagedResourceStatus.ACTIVE },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  async createVersion(input: CreatePromptVersionInput) {
    const tenantId = this.tenantContext.getTenantId();
    const latest = await this.prisma.promptVersion.findFirst({
      where: { key: input.key },
      orderBy: { version: 'desc' },
    });

    if (input.activate) {
      await this.prisma.promptVersion.updateMany({
        where: {
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

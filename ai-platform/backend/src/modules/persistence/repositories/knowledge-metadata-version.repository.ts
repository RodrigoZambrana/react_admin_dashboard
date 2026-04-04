import { Injectable } from '@nestjs/common';
import { ManagedResourceStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type CreateKnowledgeMetadataVersionInput = {
  key: string;
  resource: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  createdBy?: string;
  activate?: boolean;
};

@Injectable()
export class KnowledgeMetadataVersionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getActiveByKey(key: string) {
    return this.prisma.knowledgeMetadataVersion.findFirst({
      where: {
        key,
        status: ManagedResourceStatus.ACTIVE,
      },
      orderBy: { version: 'desc' },
    });
  }

  list(key?: string) {
    return this.prisma.knowledgeMetadataVersion.findMany({
      where: key ? { key } : undefined,
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  hasAnyVersions() {
    return this.prisma.knowledgeMetadataVersion
      .count()
      .then((count) => count > 0);
  }

  listActive() {
    return this.prisma.knowledgeMetadataVersion.findMany({
      where: { status: ManagedResourceStatus.ACTIVE },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  async createVersion(input: CreateKnowledgeMetadataVersionInput) {
    const tenantId = this.tenantContext.getTenantId();
    const latest = await this.prisma.knowledgeMetadataVersion.findFirst({
      where: { key: input.key },
      orderBy: { version: 'desc' },
    });

    if (input.activate) {
      await this.prisma.knowledgeMetadataVersion.updateMany({
        where: {
          key: input.key,
          status: ManagedResourceStatus.ACTIVE,
        },
        data: {
          status: ManagedResourceStatus.ARCHIVED,
        },
      });
    }

    return this.prisma.knowledgeMetadataVersion.create({
      data: {
        tenantId,
        key: input.key,
        resource: input.resource,
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

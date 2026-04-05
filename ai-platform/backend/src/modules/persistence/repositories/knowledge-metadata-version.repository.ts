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
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.knowledgeMetadataVersion.findFirst({
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
    return this.prisma.knowledgeMetadataVersion.findMany({
      where: {
        tenantId,
        ...(key ? { key } : {}),
      },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  findById(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.knowledgeMetadataVersion.findFirst({
      where: { id, tenantId },
    });
  }

  hasAnyVersions() {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.knowledgeMetadataVersion
      .count({
        where: { tenantId },
      })
      .then((count) => count > 0);
  }

  listActive() {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.knowledgeMetadataVersion.findMany({
      where: { tenantId, status: ManagedResourceStatus.ACTIVE },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  async createVersion(input: CreateKnowledgeMetadataVersionInput) {
    const tenantId = this.tenantContext.getTenantId();
    const latest = await this.prisma.knowledgeMetadataVersion.findFirst({
      where: { tenantId, key: input.key },
      orderBy: { version: 'desc' },
    });

    if (input.activate) {
      await this.prisma.knowledgeMetadataVersion.updateMany({
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

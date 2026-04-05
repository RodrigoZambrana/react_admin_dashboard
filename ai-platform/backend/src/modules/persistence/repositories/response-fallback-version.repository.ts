import { Injectable } from '@nestjs/common';
import { ManagedResourceStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type CreateResponseFallbackVersionInput = {
  locale: string;
  resource: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  createdBy?: string;
  activate?: boolean;
};

@Injectable()
export class ResponseFallbackVersionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getActiveByLocale(locale: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.responseFallbackVersion.findFirst({
      where: {
        tenantId,
        locale,
        status: ManagedResourceStatus.ACTIVE,
      },
      orderBy: { version: 'desc' },
    });
  }

  list(locale?: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.responseFallbackVersion.findMany({
      where: {
        tenantId,
        ...(locale ? { locale } : {}),
      },
      orderBy: [{ locale: 'asc' }, { version: 'desc' }],
    });
  }

  findById(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.responseFallbackVersion.findFirst({
      where: { id, tenantId },
    });
  }

  hasAnyVersions() {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.responseFallbackVersion
      .count({
        where: { tenantId },
      })
      .then((count) => count > 0);
  }

  listActive() {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.responseFallbackVersion.findMany({
      where: { tenantId, status: ManagedResourceStatus.ACTIVE },
      orderBy: [{ locale: 'asc' }, { version: 'desc' }],
    });
  }

  async createVersion(input: CreateResponseFallbackVersionInput) {
    const tenantId = this.tenantContext.getTenantId();
    const latest = await this.prisma.responseFallbackVersion.findFirst({
      where: { tenantId, locale: input.locale },
      orderBy: { version: 'desc' },
    });

    if (input.activate) {
      await this.prisma.responseFallbackVersion.updateMany({
        where: {
          tenantId,
          locale: input.locale,
          status: ManagedResourceStatus.ACTIVE,
        },
        data: {
          status: ManagedResourceStatus.ARCHIVED,
        },
      });
    }

    return this.prisma.responseFallbackVersion.create({
      data: {
        tenantId,
        locale: input.locale,
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

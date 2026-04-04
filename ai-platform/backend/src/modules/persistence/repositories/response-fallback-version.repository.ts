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
    return this.prisma.responseFallbackVersion.findFirst({
      where: {
        locale,
        status: ManagedResourceStatus.ACTIVE,
      },
      orderBy: { version: 'desc' },
    });
  }

  list(locale?: string) {
    return this.prisma.responseFallbackVersion.findMany({
      where: locale ? { locale } : undefined,
      orderBy: [{ locale: 'asc' }, { version: 'desc' }],
    });
  }

  findById(id: string) {
    return this.prisma.responseFallbackVersion.findFirst({
      where: { id },
    });
  }

  hasAnyVersions() {
    return this.prisma.responseFallbackVersion
      .count()
      .then((count) => count > 0);
  }

  listActive() {
    return this.prisma.responseFallbackVersion.findMany({
      where: { status: ManagedResourceStatus.ACTIVE },
      orderBy: [{ locale: 'asc' }, { version: 'desc' }],
    });
  }

  async createVersion(input: CreateResponseFallbackVersionInput) {
    const tenantId = this.tenantContext.getTenantId();
    const latest = await this.prisma.responseFallbackVersion.findFirst({
      where: { locale: input.locale },
      orderBy: { version: 'desc' },
    });

    if (input.activate) {
      await this.prisma.responseFallbackVersion.updateMany({
        where: {
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

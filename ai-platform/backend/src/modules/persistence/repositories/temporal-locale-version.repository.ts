import { Injectable } from '@nestjs/common';
import { ManagedResourceStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type CreateTemporalLocaleVersionInput = {
  locale: string;
  resource: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  createdBy?: string;
  activate?: boolean;
};

@Injectable()
export class TemporalLocaleVersionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getActiveByLocale(locale: string) {
    return this.prisma.temporalLocaleVersion.findFirst({
      where: {
        locale: normalizeLocaleCode(locale),
        status: ManagedResourceStatus.ACTIVE,
      },
      orderBy: { version: 'desc' },
    });
  }

  list(locale?: string) {
    return this.prisma.temporalLocaleVersion.findMany({
      where: locale ? { locale: normalizeLocaleCode(locale) } : undefined,
      orderBy: [{ locale: 'asc' }, { version: 'desc' }],
    });
  }

  async listActive() {
    return this.prisma.temporalLocaleVersion.findMany({
      where: { status: ManagedResourceStatus.ACTIVE },
      orderBy: [{ locale: 'asc' }, { version: 'desc' }],
    });
  }

  async createVersion(input: CreateTemporalLocaleVersionInput) {
    const tenantId = this.tenantContext.getTenantId();
    const locale = normalizeLocaleCode(input.locale);
    const latest = await this.prisma.temporalLocaleVersion.findFirst({
      where: { locale },
      orderBy: { version: 'desc' },
    });

    if (input.activate) {
      await this.prisma.temporalLocaleVersion.updateMany({
        where: {
          locale,
          status: ManagedResourceStatus.ACTIVE,
        },
        data: {
          status: ManagedResourceStatus.ARCHIVED,
        },
      });
    }

    return this.prisma.temporalLocaleVersion.create({
      data: {
        tenantId,
        locale,
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

function normalizeLocaleCode(locale: string) {
  return locale.trim().toLowerCase();
}

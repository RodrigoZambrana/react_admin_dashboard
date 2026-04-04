import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type ReplaceCatalogItemsInput = {
  sourceId: string;
  items: Array<{
    externalId?: string | null;
    sku?: string | null;
    name: string;
    description?: string | null;
    price?: number | null;
    currency?: string | null;
    availability?: string | null;
    attributes?: Prisma.InputJsonValue | null;
    searchText: string;
  }>;
};

@Injectable()
export class CatalogItemRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async replaceForSource(input: ReplaceCatalogItemsInput) {
    const tenantId = this.tenantContext.getTenantId();

    await this.prisma.$transaction(async (tx) => {
      await tx.catalogItemRecord.deleteMany({
        where: {
          sourceId: input.sourceId,
        },
      });

      if (input.items.length === 0) {
        return;
      }

      await tx.catalogItemRecord.createMany({
        data: input.items.map((item) => ({
          tenantId,
          sourceId: input.sourceId,
          externalId: item.externalId ?? null,
          sku: item.sku ?? null,
          name: item.name,
          description: item.description ?? null,
          price: item.price ?? null,
          currency: item.currency ?? null,
          availability: item.availability ?? null,
          attributes: this.toJsonValue(item.attributes),
          searchText: item.searchText,
        })),
      });
    });

    return this.listBySourceId(input.sourceId);
  }

  listBySourceId(sourceId: string) {
    return this.prisma.catalogItemRecord.findMany({
      where: {
        sourceId,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  listByActiveSources(limit = 500) {
    return this.prisma.catalogItemRecord.findMany({
      where: {
        source: {
          status: 'ACTIVE',
          syncStatus: 'READY',
        },
      },
      orderBy: [
        {
          source: {
            updatedAt: 'desc',
          },
        },
        {
          name: 'asc',
        },
      ],
      take: limit,
      include: {
        source: true,
      },
    });
  }

  private toJsonValue(
    value: Prisma.InputJsonValue | null | undefined,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value;
  }
}

import {
  CatalogSourceKind,
  CatalogSyncStatus,
  ManagedResourceStatus,
  Prisma,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type CreateCatalogSourceInput = {
  title: string;
  kind: CatalogSourceKind;
  status?: ManagedResourceStatus;
  syncStatus?: CatalogSyncStatus;
  sourceName?: string | null;
  mimeType?: string | null;
  endpointUrl?: string | null;
  sourceConfig?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
};

@Injectable()
export class CatalogSourceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  create(input: CreateCatalogSourceInput) {
    return this.prisma.catalogSourceRecord.create({
      data: {
        tenantId: this.tenantContext.getTenantId(),
        title: input.title,
        kind: input.kind,
        status: input.status ?? ManagedResourceStatus.DRAFT,
        syncStatus: input.syncStatus ?? CatalogSyncStatus.PENDING,
        sourceName: input.sourceName ?? null,
        mimeType: input.mimeType ?? null,
        endpointUrl: input.endpointUrl ?? null,
        sourceConfig: this.toJsonValue(input.sourceConfig),
        metadata: this.toJsonValue(input.metadata),
      },
      include: {
        items: {
          take: 5,
          orderBy: {
            name: 'asc',
          },
        },
      },
    });
  }

  list(filters?: {
    status?: ManagedResourceStatus;
    kind?: CatalogSourceKind;
    limit?: number;
  }) {
    return this.prisma.catalogSourceRecord.findMany({
      where: {
        status: filters?.status,
        kind: filters?.kind,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: filters?.limit,
      include: {
        items: {
          take: 5,
          orderBy: {
            name: 'asc',
          },
        },
      },
    });
  }

  findById(sourceId: string) {
    return this.prisma.catalogSourceRecord.findFirst({
      where: {
        id: sourceId,
      },
      include: {
        items: {
          orderBy: {
            name: 'asc',
          },
        },
      },
    });
  }

  listActive(limit = 50) {
    return this.prisma.catalogSourceRecord.findMany({
      where: {
        status: ManagedResourceStatus.ACTIVE,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });
  }

  async markSyncing(sourceId: string) {
    await this.prisma.catalogSourceRecord.updateMany({
      where: {
        id: sourceId,
      },
      data: {
        syncStatus: CatalogSyncStatus.SYNCING,
        lastError: null,
      },
    });

    return this.findByIdOrThrow(sourceId);
  }

  async markReady(input: {
    sourceId: string;
    status: ManagedResourceStatus;
    itemCount: number;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    await this.prisma.catalogSourceRecord.updateMany({
      where: {
        id: input.sourceId,
      },
      data: {
        syncStatus: CatalogSyncStatus.READY,
        status: input.status,
        itemCount: input.itemCount,
        lastSyncedAt: new Date(),
        lastError: null,
        metadata: this.toJsonValue(input.metadata),
      },
    });

    return this.findByIdOrThrow(input.sourceId);
  }

  async markFailed(sourceId: string, errorMessage: string) {
    await this.prisma.catalogSourceRecord.updateMany({
      where: {
        id: sourceId,
      },
      data: {
        syncStatus: CatalogSyncStatus.FAILED,
        lastError: errorMessage,
      },
    });

    return this.findByIdOrThrow(sourceId);
  }

  async activate(sourceId: string) {
    await this.prisma.catalogSourceRecord.updateMany({
      where: {
        id: sourceId,
      },
      data: {
        status: ManagedResourceStatus.ACTIVE,
      },
    });

    return this.findByIdOrThrow(sourceId);
  }

  async archive(sourceId: string) {
    await this.prisma.catalogSourceRecord.updateMany({
      where: {
        id: sourceId,
      },
      data: {
        status: ManagedResourceStatus.ARCHIVED,
      },
    });

    return this.findByIdOrThrow(sourceId);
  }

  private async findByIdOrThrow(sourceId: string) {
    const source = await this.findById(sourceId);

    if (!source) {
      throw new Error(`Catalog source ${sourceId} was not found after update.`);
    }

    return source;
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

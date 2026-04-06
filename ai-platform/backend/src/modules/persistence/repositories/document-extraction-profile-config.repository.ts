import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class DocumentExtractionProfileConfigRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  upsertForDocument(input: {
    documentId: string;
    profileId: string;
    locale: string;
    hints: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    const tenantId = this.tenantContext.getTenantId();

    return this.prisma.documentExtractionProfileConfigRecord.upsert({
      where: {
        documentId_profileId_locale: {
          documentId: input.documentId,
          profileId: input.profileId,
          locale: input.locale,
        },
      },
      create: {
        tenantId,
        documentId: input.documentId,
        profileId: input.profileId,
        locale: input.locale,
        sourceKind: 'TENANT_DERIVED',
        hints: input.hints,
        metadata: toJsonValue(input.metadata),
      },
      update: {
        tenantId,
        hints: input.hints,
        metadata: toJsonValue(input.metadata),
      },
      include: {
        document: true,
      },
    });
  }

  listActiveByProfilesAndLocale(input: {
    profileIds: readonly string[];
    locale: string;
  }) {
    if (input.profileIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.documentExtractionProfileConfigRecord.findMany({
      where: {
        profileId: {
          in: [...input.profileIds],
        },
        locale: input.locale,
        document: {
          status: 'ACTIVE',
          ingestionStatus: 'READY',
        },
      },
      include: {
        document: true,
      },
      orderBy: [
        {
          updatedAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
  }

  listByDocumentAndProfiles(input: {
    documentId: string;
    profileIds: readonly string[];
    locale?: string;
  }) {
    if (input.profileIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.documentExtractionProfileConfigRecord.findMany({
      where: {
        documentId: input.documentId,
        profileId: {
          in: [...input.profileIds],
        },
        ...(input.locale
          ? {
              locale: input.locale,
            }
          : {}),
      },
      include: {
        document: true,
      },
      orderBy: [
        {
          updatedAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
  }

  clearByDocument(documentId: string) {
    return this.prisma.documentExtractionProfileConfigRecord.deleteMany({
      where: {
        documentId,
      },
    });
  }
}

function toJsonValue(
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

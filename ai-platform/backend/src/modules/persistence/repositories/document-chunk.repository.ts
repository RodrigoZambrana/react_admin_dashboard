import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type ReplaceDocumentChunksInput = {
  documentId: string;
  chunks: Array<{
    sequence: number;
    content: string;
    searchText: string;
    metadata?: Prisma.InputJsonValue | null;
  }>;
};

@Injectable()
export class DocumentChunkRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async replaceForDocument(input: ReplaceDocumentChunksInput) {
    const tenantId = this.tenantContext.getTenantId();

    await this.prisma.$transaction(async (tx) => {
      await tx.documentChunk.deleteMany({
        where: {
          documentId: input.documentId,
        },
      });

      if (input.chunks.length === 0) {
        return;
      }

      await tx.documentChunk.createMany({
        data: input.chunks.map((chunk) => ({
          tenantId,
          documentId: input.documentId,
          sequence: chunk.sequence,
          content: chunk.content,
          searchText: chunk.searchText,
          metadata: this.toJsonValue(chunk.metadata),
        })),
      });
    });

    return this.listByDocumentId(input.documentId);
  }

  listByDocumentId(documentId: string) {
    return this.prisma.documentChunk.findMany({
      where: {
        documentId,
      },
      orderBy: {
        sequence: 'asc',
      },
    });
  }

  listActiveReadyChunks(limit = 500, documentIds?: string[]) {
    return this.prisma.documentChunk.findMany({
      where: {
        document: {
          status: 'ACTIVE',
          ingestionStatus: 'READY',
          ...(Array.isArray(documentIds) && documentIds.length > 0
            ? {
                id: {
                  in: documentIds,
                },
              }
            : {}),
        },
      },
      orderBy: [
        {
          document: {
            updatedAt: 'desc',
          },
        },
        {
          sequence: 'asc',
        },
      ],
      take: limit,
      include: {
        document: true,
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

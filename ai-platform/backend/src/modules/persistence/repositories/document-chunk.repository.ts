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
    retrievalProjection?: string | null;
    metadata?: Prisma.InputJsonValue | null;
    structuredItems?: Array<{
      sequence: number;
      kind: 'entity' | 'claim';
      label: string;
      valueText: string;
      normalizedValue?: string;
      supportClass: 'explicit_fact' | 'partial_fact' | 'bounded_inference';
      evidenceTextSpan: string;
      metadata?: Prisma.InputJsonValue | null;
    }>;
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
          retrievalProjection: chunk.retrievalProjection ?? null,
          metadata: this.toJsonValue(chunk.metadata),
        })),
      });

      const persistedChunks = await tx.documentChunk.findMany({
        where: {
          documentId: input.documentId,
        },
        orderBy: {
          sequence: 'asc',
        },
      });
      const chunkIdBySequence = new Map(
        persistedChunks.map((chunk) => [chunk.sequence, chunk.id]),
      );
      const structuredItems = input.chunks.flatMap((chunk) =>
        (chunk.structuredItems ?? []).map((item) => ({
          chunkId: chunkIdBySequence.get(chunk.sequence),
          sequence: item.sequence,
          kind: item.kind,
          label: item.label,
          valueText: item.valueText,
          normalizedValue: item.normalizedValue ?? null,
          supportClass: item.supportClass,
          evidenceTextSpan: item.evidenceTextSpan,
          metadata: item.metadata ?? null,
        })),
      );

      if (structuredItems.length > 0) {
        await tx.documentKnowledgeItem.createMany({
          data: structuredItems
            .filter(
              (
                item,
              ): item is typeof item & {
                chunkId: string;
              } => typeof item.chunkId === 'string' && item.chunkId.length > 0,
            )
            .map((item) => ({
              tenantId,
              documentId: input.documentId,
              chunkId: item.chunkId,
              sequence: item.sequence,
              kind: mapKnowledgeItemKind(item.kind),
              label: item.label,
              valueText: item.valueText,
              normalizedValue: item.normalizedValue,
              supportClass: mapKnowledgeSupportClass(item.supportClass),
              evidenceTextSpan: item.evidenceTextSpan,
              metadata: this.toJsonValue(item.metadata),
            })),
        });
      }
    });

    return this.listByDocumentId(input.documentId);
  }

  clearForDocument(documentId: string) {
    return this.prisma.documentChunk.deleteMany({
      where: {
        documentId,
      },
    });
  }

  listByDocumentId(documentId: string) {
    return this.prisma.documentChunk.findMany({
      where: {
        documentId,
      },
      orderBy: {
        sequence: 'asc',
      },
      include: {
        knowledgeItems: {
          orderBy: [
            {
              sequence: 'asc',
            },
            {
              createdAt: 'asc',
            },
          ],
        },
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
        knowledgeItems: {
          orderBy: [
            {
              sequence: 'asc',
            },
            {
              createdAt: 'asc',
            },
          ],
        },
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

function mapKnowledgeItemKind(value: 'entity' | 'claim') {
  return value === 'entity' ? 'ENTITY' : 'CLAIM';
}

function mapKnowledgeSupportClass(
  value: 'explicit_fact' | 'partial_fact' | 'bounded_inference',
) {
  if (value === 'partial_fact') {
    return 'PARTIAL_FACT';
  }

  if (value === 'bounded_inference') {
    return 'BOUNDED_INFERENCE';
  }

  return 'EXPLICIT_FACT';
}

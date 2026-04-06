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
    structuredPropositions?: Array<{
      sequence: number;
      label: string;
      normalizedValue?: string;
      supportClass: 'explicit_fact' | 'partial_fact' | 'bounded_inference';
      evidenceTextSpan: string;
      metadata?: Prisma.InputJsonValue | null;
      proposition: {
        predicate: string;
        facet?: string;
        objectValue: string;
        objectNormalizedValue?: string;
        polarity: 'affirmed' | 'negated' | 'conditional' | 'comparative' | 'unknown';
        relationScope?: Prisma.InputJsonValue | null;
        confidence: number;
        canonicalKey: string;
        patternKey: string;
        evidenceTier?: 'typed_claim' | 'normalized_proposition' | 'excerpt_only';
        promotionState?: 'unclassified' | 'candidate' | 'promoted' | 'rejected';
        promotedAxis?: string;
        promotedFacet?: string;
      };
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

      const structuredPropositions = input.chunks.flatMap((chunk) =>
        (chunk.structuredPropositions ?? []).map((proposition) => ({
          chunkId: chunkIdBySequence.get(chunk.sequence),
          sequence: proposition.sequence,
          label: proposition.label,
          normalizedValue: proposition.normalizedValue ?? null,
          supportClass: proposition.supportClass,
          evidenceTextSpan: proposition.evidenceTextSpan,
          metadata: proposition.metadata ?? null,
          proposition: proposition.proposition,
        })),
      );

      if (structuredPropositions.length > 0) {
        await tx.documentKnowledgeProposition.createMany({
          data: structuredPropositions
            .filter(
              (
                proposition,
              ): proposition is typeof proposition & {
                chunkId: string;
              } =>
                typeof proposition.chunkId === 'string' &&
                proposition.chunkId.length > 0,
            )
            .map((proposition) => ({
              tenantId,
              documentId: input.documentId,
              chunkId: proposition.chunkId,
              sequence: proposition.sequence,
              layer: extractPropositionLayer(proposition.metadata),
              extractionScope: extractExtractionScope(proposition.metadata),
              profileKey: extractProfileKey(proposition.metadata),
              subjectAxis: extractSubjectValue(proposition.metadata)?.axis ?? null,
              subjectValue: extractSubjectValue(proposition.metadata)?.value ?? null,
              subjectNormalized:
                extractSubjectValue(proposition.metadata)?.normalizedValue ?? null,
              predicate: proposition.proposition.predicate,
              facet: proposition.proposition.facet ?? null,
              objectValue: proposition.proposition.objectValue,
              objectNormalized:
                proposition.proposition.objectNormalizedValue ?? null,
              polarity: mapKnowledgePolarity(proposition.proposition.polarity),
              supportClass: mapKnowledgeSupportClass(proposition.supportClass),
              evidenceTier: mapKnowledgeEvidenceTier(
                proposition.proposition.evidenceTier ?? 'normalized_proposition',
              ),
              confidence: proposition.proposition.confidence,
              relationScope: this.toJsonValue(
                (proposition.proposition.relationScope ?? null) as Prisma.InputJsonValue | null,
              ),
              canonicalKey: proposition.proposition.canonicalKey,
              patternKey: proposition.proposition.patternKey,
              evidenceTextSpan: proposition.evidenceTextSpan,
              metadata: this.toJsonValue(proposition.metadata),
              promotionState: mapKnowledgePromotionState(
                proposition.proposition.promotionState ?? 'unclassified',
              ),
              promotedAxis: proposition.proposition.promotedAxis ?? null,
              promotedFacet: proposition.proposition.promotedFacet ?? null,
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
        propositions: {
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
        propositions: {
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

function mapKnowledgePolarity(
  value: 'affirmed' | 'negated' | 'conditional' | 'comparative' | 'unknown',
) {
  switch (value) {
    case 'negated':
      return 'NEGATED';
    case 'conditional':
      return 'CONDITIONAL';
    case 'comparative':
      return 'COMPARATIVE';
    case 'unknown':
      return 'UNKNOWN';
    default:
      return 'AFFIRMED';
  }
}

function mapKnowledgeEvidenceTier(
  value: 'typed_claim' | 'normalized_proposition' | 'excerpt_only',
) {
  switch (value) {
    case 'typed_claim':
      return 'TYPED_CLAIM';
    case 'excerpt_only':
      return 'EXCERPT_ONLY';
    default:
      return 'NORMALIZED_PROPOSITION';
  }
}

function mapKnowledgePromotionState(
  value: 'unclassified' | 'candidate' | 'promoted' | 'rejected',
) {
  switch (value) {
    case 'candidate':
      return 'CANDIDATE';
    case 'promoted':
      return 'PROMOTED';
    case 'rejected':
      return 'REJECTED';
    default:
      return 'UNCLASSIFIED';
  }
}

function extractExtractionScope(metadata: Prisma.InputJsonValue | null | undefined) {
  const record = asMetadataRecord(metadata);
  return typeof record?.extractionScope === 'string'
    ? record.extractionScope
    : null;
}

function extractProfileKey(metadata: Prisma.InputJsonValue | null | undefined) {
  const record = asMetadataRecord(metadata);
  return typeof record?.profileKey === 'string' ? record.profileKey : null;
}

function extractPropositionLayer(metadata: Prisma.InputJsonValue | null | undefined) {
  const record = asMetadataRecord(metadata);
  const claim =
    record?.claim && typeof record.claim === 'object' && !Array.isArray(record.claim)
      ? (record.claim as Record<string, unknown>)
      : null;
  return typeof claim?.layer === 'string' ? claim.layer : null;
}

function extractSubjectValue(metadata: Prisma.InputJsonValue | null | undefined) {
  const record = asMetadataRecord(metadata);
  const claim =
    record?.claim && typeof record.claim === 'object' && !Array.isArray(record.claim)
      ? (record.claim as Record<string, unknown>)
      : null;
  const subject =
    claim?.subject && typeof claim.subject === 'object' && !Array.isArray(claim.subject)
      ? (claim.subject as Record<string, unknown>)
      : null;

  if (typeof subject?.axis !== 'string' || typeof subject?.value !== 'string') {
    return null;
  }

  return {
    axis: subject.axis,
    value: subject.value,
    normalizedValue:
      typeof subject.normalizedValue === 'string'
        ? subject.normalizedValue
        : null,
  };
}

function asMetadataRecord(
  value: Prisma.InputJsonValue | null | undefined,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

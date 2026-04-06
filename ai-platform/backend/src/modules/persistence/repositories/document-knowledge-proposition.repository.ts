import { Injectable } from '@nestjs/common';
import {
  DocumentKnowledgeEvidenceTier as PrismaEvidenceTier,
  DocumentKnowledgePolarity as PrismaPolarity,
  DocumentKnowledgePromotionState as PrismaPromotionState,
  DocumentKnowledgeSupportClass as PrismaSupportClass,
  DocumentIngestionStatus,
  ManagedResourceStatus,
} from '@prisma/client';

import {
  DocumentKnowledgeEvidenceTier,
  DocumentKnowledgePolarity,
  DocumentKnowledgePromotionState,
  DocumentKnowledgePropositionScope,
  DocumentKnowledgeScopedValue,
  DocumentKnowledgeSupportClass,
} from '../../documents/document.types';
import { PrismaService } from '../prisma/prisma.service';

export type DocumentKnowledgePromotionAnalysisRow = {
  patternKey: string;
  predicate: string;
  facet?: string;
  layer?: string;
  profileKey?: string;
  promotionState: DocumentKnowledgePromotionState;
  promotedAxis?: string;
  promotedFacet?: string;
  supportClass: DocumentKnowledgeSupportClass;
  polarity: DocumentKnowledgePolarity;
  evidenceTier: Exclude<DocumentKnowledgeEvidenceTier, 'none'>;
  confidence: number;
  subject?: DocumentKnowledgeScopedValue;
  relationScope: DocumentKnowledgePropositionScope[];
  objectValue: string;
  objectNormalizedValue?: string;
  evidenceTextSpan: string;
  document: {
    id: string;
    title: string;
    updatedAt: string;
  };
};

@Injectable()
export class DocumentKnowledgePropositionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPromotionAnalysisRows(input?: {
    profileKey?: string;
    predicate?: string;
    promotionStates?: DocumentKnowledgePromotionState[];
    activeOnly?: boolean;
    limit?: number;
  }): Promise<DocumentKnowledgePromotionAnalysisRow[]> {
    const records = await this.prisma.documentKnowledgeProposition.findMany({
      where: {
        ...(input?.profileKey
          ? {
              profileKey: input.profileKey,
            }
          : {}),
        ...(input?.predicate
          ? {
              predicate: input.predicate,
            }
          : {}),
        ...(input?.promotionStates && input.promotionStates.length > 0
          ? {
              promotionState: {
                in: input.promotionStates.map(mapPromotionStateToPrisma),
              },
            }
          : {}),
        ...(input?.activeOnly === false
          ? {}
          : {
              document: {
                status: ManagedResourceStatus.ACTIVE,
                ingestionStatus: DocumentIngestionStatus.READY,
              },
            }),
      },
      orderBy: [
        {
          confidence: 'desc',
        },
        {
          updatedAt: 'desc',
        },
      ],
      take: normalizeRepositoryLimit(input?.limit),
      include: {
        document: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
          },
        },
      },
    });

    return records.map((record) => ({
      patternKey: record.patternKey,
      predicate: record.predicate,
      facet: record.facet ?? undefined,
      layer: record.layer ?? undefined,
      profileKey: record.profileKey ?? undefined,
      promotionState: mapPromotionStateFromPrisma(record.promotionState),
      promotedAxis: record.promotedAxis ?? undefined,
      promotedFacet: record.promotedFacet ?? undefined,
      supportClass: mapSupportClassFromPrisma(record.supportClass),
      polarity: mapPolarityFromPrisma(record.polarity),
      evidenceTier: mapEvidenceTierFromPrisma(record.evidenceTier),
      confidence: record.confidence,
      subject: buildScopedValue({
        axis: record.subjectAxis,
        value: record.subjectValue,
        normalizedValue: record.subjectNormalized,
      }),
      relationScope: asRelationScope(record.relationScope),
      objectValue: record.objectValue,
      objectNormalizedValue: record.objectNormalized ?? undefined,
      evidenceTextSpan: record.evidenceTextSpan,
      document: {
        id: record.document.id,
        title: record.document.title,
        updatedAt: record.document.updatedAt.toISOString(),
      },
    }));
  }

  markPatternAsCandidate(patternKey: string) {
    return this.prisma.documentKnowledgeProposition.updateMany({
      where: {
        patternKey,
      },
      data: {
        promotionState: PrismaPromotionState.CANDIDATE,
      },
    });
  }

  promotePattern(input: {
    patternKey: string;
    axis: string;
    facet?: string | null;
  }) {
    return this.prisma.documentKnowledgeProposition.updateMany({
      where: {
        patternKey: input.patternKey,
      },
      data: {
        promotionState: PrismaPromotionState.PROMOTED,
        promotedAxis: input.axis,
        promotedFacet: input.facet ?? null,
      },
    });
  }

  rejectPattern(patternKey: string) {
    return this.prisma.documentKnowledgeProposition.updateMany({
      where: {
        patternKey,
      },
      data: {
        promotionState: PrismaPromotionState.REJECTED,
      },
    });
  }
}

function normalizeRepositoryLimit(value?: number) {
  if (!Number.isFinite(value) || !value || value < 1) {
    return 2000;
  }

  return Math.min(Math.floor(value), 5000);
}

function mapSupportClassFromPrisma(
  value: PrismaSupportClass,
): DocumentKnowledgeSupportClass {
  switch (value) {
    case PrismaSupportClass.EXPLICIT_FACT:
      return 'explicit_fact';
    case PrismaSupportClass.PARTIAL_FACT:
      return 'partial_fact';
    case PrismaSupportClass.BOUNDED_INFERENCE:
      return 'bounded_inference';
    default:
      return 'explicit_fact';
  }
}

function mapEvidenceTierFromPrisma(
  value: PrismaEvidenceTier,
): Exclude<DocumentKnowledgeEvidenceTier, 'none'> {
  switch (value) {
    case PrismaEvidenceTier.TYPED_CLAIM:
      return 'typed_claim';
    case PrismaEvidenceTier.EXCERPT_ONLY:
      return 'excerpt_only';
    case PrismaEvidenceTier.NORMALIZED_PROPOSITION:
    default:
      return 'normalized_proposition';
  }
}

function mapPolarityFromPrisma(value: PrismaPolarity): DocumentKnowledgePolarity {
  switch (value) {
    case PrismaPolarity.NEGATED:
      return 'negated';
    case PrismaPolarity.CONDITIONAL:
      return 'conditional';
    case PrismaPolarity.COMPARATIVE:
      return 'comparative';
    case PrismaPolarity.UNKNOWN:
      return 'unknown';
    case PrismaPolarity.AFFIRMED:
    default:
      return 'affirmed';
  }
}

function mapPromotionStateFromPrisma(
  value: PrismaPromotionState,
): DocumentKnowledgePromotionState {
  switch (value) {
    case PrismaPromotionState.CANDIDATE:
      return 'candidate';
    case PrismaPromotionState.PROMOTED:
      return 'promoted';
    case PrismaPromotionState.REJECTED:
      return 'rejected';
    case PrismaPromotionState.UNCLASSIFIED:
    default:
      return 'unclassified';
  }
}

function mapPromotionStateToPrisma(
  value: DocumentKnowledgePromotionState,
): PrismaPromotionState {
  switch (value) {
    case 'candidate':
      return PrismaPromotionState.CANDIDATE;
    case 'promoted':
      return PrismaPromotionState.PROMOTED;
    case 'rejected':
      return PrismaPromotionState.REJECTED;
    case 'unclassified':
    default:
      return PrismaPromotionState.UNCLASSIFIED;
  }
}

function buildScopedValue(input: {
  axis?: string | null;
  value?: string | null;
  normalizedValue?: string | null;
}): DocumentKnowledgeScopedValue | undefined {
  if (!input.axis || !input.value) {
    return undefined;
  }

  return {
    axis: input.axis,
    value: input.value,
    normalizedValue: input.normalizedValue ?? undefined,
  };
}

function asRelationScope(value: unknown): DocumentKnowledgePropositionScope[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const axis = typeof (entry as { axis?: unknown }).axis === 'string'
      ? (entry as { axis: string }).axis
      : null;
    const relation = typeof (entry as { relation?: unknown }).relation === 'string'
      ? (entry as { relation: string }).relation
      : undefined;
    const scopedValue = typeof (entry as { value?: unknown }).value === 'string'
      ? (entry as { value: string }).value
      : null;
    const normalizedValue =
      typeof (entry as { normalizedValue?: unknown }).normalizedValue === 'string'
        ? (entry as { normalizedValue: string }).normalizedValue
        : undefined;

    if (!axis || !scopedValue) {
      return [];
    }

    return [
      {
        axis,
        value: scopedValue,
        normalizedValue,
        relation,
      },
    ];
  });
}

import { Injectable } from '@nestjs/common';

import {
  DocumentKnowledgeLayer,
  DocumentKnowledgePromotionCandidate,
  DocumentKnowledgePromotionState,
  DocumentKnowledgePropositionScope,
  DocumentKnowledgeScopedValue,
} from './document.types';
import {
  DocumentKnowledgePromotionAnalysisRow,
  DocumentKnowledgePropositionRepository,
} from '../persistence/repositories/document-knowledge-proposition.repository';

type PromotionCandidateAccumulator = {
  patternKey: string;
  predicate: string;
  facet?: string;
  layer?: DocumentKnowledgeLayer;
  profileKey?: string;
  promotionState: DocumentKnowledgePromotionState;
  promotedAxis?: string;
  promotedFacet?: string;
  occurrenceCount: number;
  documentIds: Set<string>;
  confidenceSum: number;
  supportClasses: Set<string>;
  polarities: Set<string>;
  evidenceTiers: Set<string>;
  subjects: Map<string, DocumentKnowledgeScopedValue>;
  exampleValues: Set<string>;
  examples: DocumentKnowledgePromotionCandidate['examples'];
};

@Injectable()
export class DocumentKnowledgePromotionService {
  constructor(
    private readonly propositionRepository: DocumentKnowledgePropositionRepository,
  ) {}

  async listPromotionCandidates(input?: {
    profileKey?: string;
    predicate?: string;
    promotionStates?: DocumentKnowledgePromotionState[];
    minOccurrences?: number;
    limit?: number;
    activeOnly?: boolean;
  }): Promise<DocumentKnowledgePromotionCandidate[]> {
    const rows = await this.propositionRepository.listPromotionAnalysisRows({
      profileKey: input?.profileKey,
      predicate: input?.predicate,
      promotionStates:
        input?.promotionStates && input.promotionStates.length > 0
          ? input.promotionStates
          : ['unclassified', 'candidate'],
      activeOnly: input?.activeOnly ?? true,
      limit: input?.limit ? Math.max(input.limit * 20, input.limit) : 2000,
    });

    const grouped = new Map<string, PromotionCandidateAccumulator>();

    for (const row of rows) {
      const existing = grouped.get(row.patternKey);

      if (existing) {
        accumulatePromotionRow(existing, row);
        continue;
      }

      grouped.set(row.patternKey, createPromotionAccumulator(row));
    }

    return Array.from(grouped.values())
      .filter(
        (candidate) =>
          candidate.occurrenceCount >= normalizeMinOccurrences(input?.minOccurrences),
      )
      .sort((left, right) => {
        if (right.occurrenceCount !== left.occurrenceCount) {
          return right.occurrenceCount - left.occurrenceCount;
        }

        const confidenceDelta =
          right.confidenceSum / right.occurrenceCount -
          left.confidenceSum / left.occurrenceCount;

        if (confidenceDelta !== 0) {
          return confidenceDelta;
        }

        return left.patternKey.localeCompare(right.patternKey);
      })
      .slice(0, normalizeCandidateLimit(input?.limit))
      .map((candidate) => ({
        patternKey: candidate.patternKey,
        predicate: candidate.predicate,
        facet: candidate.facet,
        layer: candidate.layer,
        profileKey: candidate.profileKey,
        promotionState: candidate.promotionState,
        promotedAxis: candidate.promotedAxis,
        promotedFacet: candidate.promotedFacet,
        occurrenceCount: candidate.occurrenceCount,
        documentCount: candidate.documentIds.size,
        averageConfidence: Number(
          (candidate.confidenceSum / candidate.occurrenceCount).toFixed(4),
        ),
        supportClasses: Array.from(candidate.supportClasses) as DocumentKnowledgePromotionCandidate['supportClasses'],
        polarities: Array.from(candidate.polarities) as DocumentKnowledgePromotionCandidate['polarities'],
        evidenceTiers: Array.from(candidate.evidenceTiers) as DocumentKnowledgePromotionCandidate['evidenceTiers'],
        subjects: Array.from(candidate.subjects.values()).slice(0, 5),
        exampleValues: Array.from(candidate.exampleValues).slice(0, 5),
        examples: candidate.examples,
      }));
  }

  markPatternAsCandidate(patternKey: string) {
    return this.propositionRepository.markPatternAsCandidate(patternKey);
  }

  promotePattern(input: { patternKey: string; axis: string; facet?: string | null }) {
    return this.propositionRepository.promotePattern(input);
  }

  rejectPattern(patternKey: string) {
    return this.propositionRepository.rejectPattern(patternKey);
  }
}

function createPromotionAccumulator(
  row: DocumentKnowledgePromotionAnalysisRow,
): PromotionCandidateAccumulator {
  const accumulator: PromotionCandidateAccumulator = {
    patternKey: row.patternKey,
    predicate: row.predicate,
    facet: row.facet,
    layer: normalizeDocumentKnowledgeLayer(row.layer),
    profileKey: row.profileKey,
    promotionState: row.promotionState,
    promotedAxis: row.promotedAxis,
    promotedFacet: row.promotedFacet,
    occurrenceCount: 0,
    documentIds: new Set<string>(),
    confidenceSum: 0,
    supportClasses: new Set<string>(),
    polarities: new Set<string>(),
    evidenceTiers: new Set<string>(),
    subjects: new Map<string, DocumentKnowledgeScopedValue>(),
    exampleValues: new Set<string>(),
    examples: [],
  };

  accumulatePromotionRow(accumulator, row);
  return accumulator;
}

function accumulatePromotionRow(
  accumulator: PromotionCandidateAccumulator,
  row: DocumentKnowledgePromotionAnalysisRow,
) {
  accumulator.occurrenceCount += 1;
  accumulator.documentIds.add(row.document.id);
  accumulator.confidenceSum += row.confidence;
  accumulator.supportClasses.add(row.supportClass);
  accumulator.polarities.add(row.polarity);
  accumulator.evidenceTiers.add(row.evidenceTier);

  if (row.subject) {
    const subjectKey = [
      row.subject.axis,
      row.subject.normalizedValue ?? row.subject.value.toLowerCase(),
    ].join(':');

    if (!accumulator.subjects.has(subjectKey)) {
      accumulator.subjects.set(subjectKey, row.subject);
    }
  }

  accumulator.exampleValues.add(row.objectValue);

  if (accumulator.examples.length < 3) {
    accumulator.examples.push({
      documentId: row.document.id,
      documentTitle: row.document.title,
      documentUpdatedAt: row.document.updatedAt,
      evidenceTextSpan: row.evidenceTextSpan,
      objectValue: row.objectValue,
      objectNormalizedValue: row.objectNormalizedValue,
      confidence: row.confidence,
      subject: row.subject,
      relationScope: dedupeRelationScope(row.relationScope),
    });
  }
}

function normalizeMinOccurrences(value?: number) {
  if (!Number.isFinite(value) || !value || value < 1) {
    return 2;
  }

  return Math.min(Math.floor(value), 100);
}

function normalizeCandidateLimit(value?: number) {
  if (!Number.isFinite(value) || !value || value < 1) {
    return 50;
  }

  return Math.min(Math.floor(value), 200);
}

function normalizeDocumentKnowledgeLayer(
  value?: string,
): DocumentKnowledgeLayer | undefined {
  if (
    value === 'factual' ||
    value === 'prudence' ||
    value === 'workflow' ||
    value === 'guidance'
  ) {
    return value;
  }

  return undefined;
}

function dedupeRelationScope(
  scopes: DocumentKnowledgePropositionScope[],
): DocumentKnowledgePropositionScope[] {
  const seen = new Set<string>();

  return scopes.filter((scope) => {
    const key = [
      scope.axis,
      scope.relation ?? '',
      scope.normalizedValue ?? scope.value,
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

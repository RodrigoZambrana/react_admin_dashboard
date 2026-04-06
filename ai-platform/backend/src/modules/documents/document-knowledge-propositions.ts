import {
  DocumentKnowledgeEvidenceTier,
  DocumentKnowledgeExtractionScope,
  DocumentKnowledgeItemMetadata,
  DocumentKnowledgeLayer,
  DocumentKnowledgePolarity,
  DocumentKnowledgePromotionState,
  DocumentKnowledgePropositionCandidate,
  DocumentKnowledgePropositionPayload,
  DocumentKnowledgePropositionScope,
  DocumentKnowledgePropositionSummary,
  DocumentKnowledgeScopedValue,
  DocumentKnowledgeSupportClass,
} from './document.types';
import { resolveStructuralKnowledgeAxisLabel } from './document-knowledge-claims';

type PropositionRecordLike = {
  predicate: string;
  facet?: string | null;
  objectValue: string;
  objectNormalized?: string | null;
  polarity: string;
  supportClass: string;
  evidenceTier: string;
  confidence: number;
  relationScope?: unknown;
  metadata?: unknown;
  patternKey: string;
  canonicalKey?: string | null;
  promotionState?: string | null;
  promotedAxis?: string | null;
  promotedFacet?: string | null;
};

export type StructuredKnowledgeProposition = {
  predicate: string;
  facet?: string;
  layer?: DocumentKnowledgeLayer;
  supportClass: DocumentKnowledgeSupportClass;
  evidenceTier: Exclude<DocumentKnowledgeEvidenceTier, 'none'>;
  polarity: DocumentKnowledgePolarity;
  confidence: number;
  subject?: DocumentKnowledgeScopedValue;
  relationScope: DocumentKnowledgePropositionScope[];
  objectValue: string;
  objectNormalizedValue?: string;
  patternKey: string;
  canonicalKey: string;
  extractionScope?: DocumentKnowledgeExtractionScope;
  promotionState: DocumentKnowledgePromotionState;
  promotedAxis?: string;
  promotedFacet?: string;
};

export function extractStructuredKnowledgePropositions(
  records: PropositionRecordLike[],
  input?: {
    layers?: DocumentKnowledgeLayer[];
  },
): StructuredKnowledgeProposition[] {
  const allowedLayers =
    input?.layers && input.layers.length > 0 ? new Set(input.layers) : null;

  return records
    .map(asStructuredKnowledgeProposition)
    .filter(
      (
        proposition,
      ): proposition is StructuredKnowledgeProposition => Boolean(proposition),
    )
    .filter((proposition) =>
      allowedLayers ? allowedLayers.has(proposition.layer ?? 'factual') : true,
    );
}

export function buildStructuralKnowledgePropositionSummary(input: {
  locale?: string | null;
  propositions: StructuredKnowledgeProposition[];
  limit?: number;
}) {
  const selected = input.propositions.slice(0, Math.max(1, input.limit ?? 2));

  return selected
    .map((proposition) => renderPropositionSummary(proposition, input.locale))
    .filter((value): value is string => value.length > 0)
    .join('; ')
    .trim();
}

export function buildKnowledgePropositionRetrievalProjection(input: {
  propositions: Array<{
    predicate: string;
    facet?: string | null;
    objectValue: string;
    objectNormalized?: string | null;
    relationScope?: unknown;
    metadata?: unknown;
  }>;
  locale?: string | null;
}) {
  const signals = new Set<string>();

  for (const proposition of input.propositions) {
    pushNormalizedSignal(
      signals,
      resolveStructuralKnowledgeAxisLabel(proposition.predicate, input.locale),
    );
    pushNormalizedSignal(signals, proposition.facet ?? '');
    pushNormalizedSignal(
      signals,
      proposition.objectNormalized ?? proposition.objectValue,
    );

    const metadata = asKnowledgeMetadata(proposition.metadata);
    pushNormalizedSignal(signals, metadata?.claim?.subject?.value ?? '');

    for (const scope of asRelationScope(proposition.relationScope)) {
      pushNormalizedSignal(signals, scope.axis);
      pushNormalizedSignal(
        signals,
        scope.normalizedValue ?? scope.value,
      );
      pushNormalizedSignal(signals, scope.relation ?? '');
    }
  }

  return Array.from(signals.values()).join(' ').trim();
}

export function buildKnowledgePropositionCanonicalKey(input: {
  predicate: string;
  facet?: string;
  objectValue: string;
  objectNormalizedValue?: string;
  polarity: DocumentKnowledgePolarity;
  subject?: DocumentKnowledgeScopedValue;
  relationScope?: DocumentKnowledgePropositionScope[];
}) {
  return JSON.stringify({
    predicate: input.predicate,
    facet: input.facet ?? null,
    polarity: input.polarity,
    subject: input.subject
      ? {
          axis: input.subject.axis,
          value: normalizeSignal(input.subject.normalizedValue ?? input.subject.value),
        }
      : null,
    relationScope: (input.relationScope ?? [])
      .map((scope) => ({
        axis: scope.axis,
        relation: scope.relation ?? null,
        value: normalizeSignal(scope.normalizedValue ?? scope.value),
      }))
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      ),
    object: normalizeSignal(input.objectNormalizedValue ?? input.objectValue),
  });
}

export function buildKnowledgePropositionPatternKey(input: {
  predicate: string;
  facet?: string;
  polarity: DocumentKnowledgePolarity;
  subject?: DocumentKnowledgeScopedValue;
  relationScope?: DocumentKnowledgePropositionScope[];
}) {
  return [
    input.predicate,
    input.facet ?? '',
    input.polarity,
    `subject:${input.subject?.axis ?? 'none'}`,
    `scopes:${(input.relationScope ?? [])
      .map((scope) => `${scope.axis}:${scope.relation ?? 'direct'}`)
      .sort()
      .join('|')}`,
  ].join('|');
}

export function buildKnowledgePropositionSummary(
  proposition: StructuredKnowledgeProposition,
) {
  return {
    predicate: proposition.predicate,
    facet: proposition.facet,
    layer: proposition.layer,
    supportClass: proposition.supportClass,
    evidenceTier: proposition.evidenceTier,
    polarity: proposition.polarity,
    confidence: proposition.confidence,
    subject: proposition.subject,
    relationScope: proposition.relationScope,
    objectValue: proposition.objectValue,
    objectNormalizedValue: proposition.objectNormalizedValue,
    patternKey: proposition.patternKey,
  } satisfies DocumentKnowledgePropositionSummary;
}

export function asStructuredKnowledgeProposition(
  record: PropositionRecordLike,
): StructuredKnowledgeProposition | null {
  if (!record.predicate || !record.objectValue) {
    return null;
  }

  const metadata = asKnowledgeMetadata(record.metadata);
  const payload: DocumentKnowledgePropositionPayload = {
    predicate: record.predicate,
    facet: record.facet ?? undefined,
    objectValue: record.objectValue,
    objectNormalizedValue: record.objectNormalized ?? undefined,
    polarity: normalizePolarity(record.polarity),
    relationScope: asRelationScope(record.relationScope),
    confidence:
      typeof record.confidence === 'number' && Number.isFinite(record.confidence)
        ? record.confidence
        : 0.5,
    canonicalKey:
      typeof record.canonicalKey === 'string' && record.canonicalKey.trim().length > 0
        ? record.canonicalKey
        : buildKnowledgePropositionCanonicalKey({
            predicate: record.predicate,
            facet: record.facet ?? undefined,
            objectValue: record.objectValue,
            objectNormalizedValue: record.objectNormalized ?? undefined,
            polarity: normalizePolarity(record.polarity),
            subject: metadata?.claim?.subject,
            relationScope: asRelationScope(record.relationScope),
          }),
    patternKey: record.patternKey,
    evidenceTier: normalizeEvidenceTier(record.evidenceTier),
    promotionState: normalizePromotionState(record.promotionState),
    promotedAxis: record.promotedAxis ?? undefined,
    promotedFacet: record.promotedFacet ?? undefined,
  };

  return {
    predicate: payload.predicate,
    facet: payload.facet,
    layer: metadata?.claim?.layer,
    supportClass: normalizeSupportClass(record.supportClass),
    evidenceTier: payload.evidenceTier ?? 'normalized_proposition',
    polarity: payload.polarity,
    confidence: payload.confidence,
    subject: metadata?.claim?.subject,
    relationScope: payload.relationScope ?? [],
    objectValue: payload.objectValue,
    objectNormalizedValue: payload.objectNormalizedValue,
    patternKey: payload.patternKey,
    canonicalKey: payload.canonicalKey,
    extractionScope: metadata?.extractionScope,
    promotionState: payload.promotionState ?? 'unclassified',
    promotedAxis: payload.promotedAxis,
    promotedFacet: payload.promotedFacet,
  };
}

function renderPropositionSummary(
  proposition: StructuredKnowledgeProposition,
  locale?: string | null,
) {
  const predicateLabel = resolveStructuralKnowledgeAxisLabel(
    proposition.predicate,
    locale,
  );
  const subject = proposition.subject?.value?.trim();
  const scopes = formatScopedContext(proposition.relationScope);
  const value = proposition.objectValue.trim();

  if (!value) {
    return '';
  }

  if (proposition.predicate === 'feature_support') {
    const compatibilitySummary =
      proposition.polarity === 'negated'
        ? `no soporta ${value}`
        : proposition.polarity === 'conditional'
          ? `puede requerir confirmacion para ${value}`
          : proposition.polarity === 'comparative'
            ? `relacionado con ${value}`
            : `soporta ${value}`;

    if (subject && scopes) {
      return `${predicateLabel} (${subject}; ${scopes}): ${compatibilitySummary}`;
    }

    if (subject) {
      return `${predicateLabel} (${subject}): ${compatibilitySummary}`;
    }

    if (scopes) {
      return `${predicateLabel} (${scopes}): ${compatibilitySummary}`;
    }

    return `${predicateLabel}: ${compatibilitySummary}`;
  }

  if (subject && scopes) {
    return `${predicateLabel} (${subject}; ${scopes}): ${value}`;
  }

  if (subject) {
    return `${predicateLabel} (${subject}): ${value}`;
  }

  if (scopes) {
    return `${predicateLabel} (${scopes}): ${value}`;
  }

  return `${predicateLabel}: ${value}`;
}

function formatScopedContext(values: DocumentKnowledgePropositionScope[]) {
  return values
    .map((scope) => {
      const relationPrefix =
        scope.relation && scope.relation !== 'direct' ? `${scope.relation} ` : '';
      return `${scope.axis} ${relationPrefix}${scope.value}`.trim();
    })
    .join('; ');
}

function asRelationScope(
  value: unknown,
): DocumentKnowledgePropositionScope[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((scope) => {
      if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
        return null;
      }

      const record = scope as Record<string, unknown>;

      if (typeof record.axis !== 'string' || typeof record.value !== 'string') {
        return null;
      }

      return {
        axis: record.axis,
        value: record.value,
        normalizedValue:
          typeof record.normalizedValue === 'string'
            ? record.normalizedValue
            : undefined,
        relation:
          typeof record.relation === 'string' ? record.relation : undefined,
      } satisfies DocumentKnowledgePropositionScope;
    })
    .filter((scope) => scope !== null) as DocumentKnowledgePropositionScope[];
}

function asKnowledgeMetadata(value: unknown): DocumentKnowledgeItemMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as DocumentKnowledgeItemMetadata;
}

function normalizeSupportClass(value: string): DocumentKnowledgeSupportClass {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'partial_fact') {
    return 'partial_fact';
  }

  if (normalized === 'bounded_inference') {
    return 'bounded_inference';
  }

  return 'explicit_fact';
}

function normalizePolarity(value: string): DocumentKnowledgePolarity {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'negated') {
    return 'negated';
  }

  if (normalized === 'conditional') {
    return 'conditional';
  }

  if (normalized === 'comparative') {
    return 'comparative';
  }

  if (normalized === 'unknown') {
    return 'unknown';
  }

  return 'affirmed';
}

function normalizeEvidenceTier(
  value: string,
): Exclude<DocumentKnowledgeEvidenceTier, 'none'> {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'typed_claim') {
    return 'typed_claim';
  }

  if (normalized === 'excerpt_only') {
    return 'excerpt_only';
  }

  return 'normalized_proposition';
}

function normalizePromotionState(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'candidate') {
    return 'candidate';
  }

  if (normalized === 'promoted') {
    return 'promoted';
  }

  if (normalized === 'rejected') {
    return 'rejected';
  }

  return 'unclassified';
}

function pushNormalizedSignal(collection: Set<string>, value: string) {
  const normalized = normalizeSignal(value);

  if (!normalized) {
    return;
  }

  collection.add(normalized);
}

function normalizeSignal(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

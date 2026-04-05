import {
  DocumentKnowledgeAxisSummary,
  DocumentKnowledgeClaimPayload,
  DocumentKnowledgeExtractionScope,
  DocumentKnowledgeItemMetadata,
  DocumentKnowledgeSupportClass,
} from './document.types';

type KnowledgeItemLike = {
  kind: string;
  label: string;
  valueText: string;
  normalizedValue?: string | null;
  supportClass: string;
  metadata?: unknown;
};

const structuralAxisLabels = {
  default: {
    product_types: 'types',
    materials: 'materials',
    operation_modes: 'operation modes',
    color_options: 'colors',
    suitability: 'recommended for',
  },
  en: {
    product_types: 'types',
    materials: 'materials',
    operation_modes: 'operation modes',
    color_options: 'colors',
    suitability: 'recommended for',
  },
  es: {
    product_types: 'tipos',
    materials: 'materiales',
    operation_modes: 'accionamiento',
    color_options: 'colores',
    suitability: 'recomendado para',
  },
} as const;

export function buildKnowledgeRetrievalProjection(input: {
  topic: string;
  supportedAxes: string[];
  unspecifiedAxes: string[];
  section?: string;
  items: Array<Pick<KnowledgeItemLike, 'normalizedValue' | 'valueText' | 'metadata'>>;
}) {
  const signals = new Set<string>();

  pushNormalizedSignal(signals, input.topic);
  pushNormalizedSignal(signals, input.section ?? '');

  for (const axis of input.supportedAxes) {
    pushNormalizedSignal(signals, axis);
  }

  for (const axis of input.unspecifiedAxes) {
    pushNormalizedSignal(signals, axis);
  }

  for (const item of input.items) {
    if (typeof item.normalizedValue === 'string' && item.normalizedValue.trim()) {
      pushNormalizedSignal(signals, item.normalizedValue);
    } else {
      pushNormalizedSignal(signals, item.valueText);
    }

    const metadata = asKnowledgeMetadata(item.metadata);
    const claimValues = metadata?.claim?.values ?? [];

    for (const value of claimValues) {
      pushNormalizedSignal(signals, value);
    }
  }

  return Array.from(signals.values()).join(' ').trim();
}

export function buildStructuralKnowledgeSummary(input: {
  locale?: string | null;
  claims: DocumentKnowledgeAxisSummary[];
  limit?: number;
}) {
  const labels = resolveStructuralAxisLabels(input.locale);
  const selectedClaims = input.claims.slice(0, Math.max(1, input.limit ?? 2));
  const rendered = selectedClaims
    .map((claim) => {
      const label =
        labels[claim.axis as keyof typeof labels] ??
        claim.axis.replace(/_/gu, ' ');
      const values = claim.values.filter((value) => value.trim().length > 0);

      if (values.length === 0) {
        return null;
      }

      return `${label}: ${values.join(', ')}`;
    })
    .filter((value): value is string => Boolean(value));

  return rendered.join('; ').trim();
}

export function extractKnowledgeAxisSummaries(
  items: Array<Pick<KnowledgeItemLike, 'kind' | 'label' | 'valueText' | 'supportClass' | 'metadata'>>,
) {
  const summaries: DocumentKnowledgeAxisSummary[] = [];

  for (const item of items) {
    if (item.kind !== 'CLAIM' && item.kind !== 'claim') {
      continue;
    }

    const metadata = asKnowledgeMetadata(item.metadata);
    const claim = metadata?.claim;

    if (!claim) {
      continue;
    }

    const values = claim.values.filter((value) => value.trim().length > 0);

    if (values.length === 0) {
      continue;
    }

    summaries.push({
      axis: claim.axis,
      values,
      supportClass: normalizeSupportClass(item.supportClass),
      extractionScope: metadata?.extractionScope,
      unspecifiedAxes: metadata?.unspecifiedAxes,
    });
  }

  return dedupeAxisSummaries(summaries);
}

export function asKnowledgeMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const claim = asClaimPayload(record.claim);
  const unspecifiedAxes = Array.isArray(record.unspecifiedAxes)
    ? record.unspecifiedAxes.filter(
        (current): current is string => typeof current === 'string' && current.trim().length > 0,
      )
    : undefined;
  const extractionScope =
    record.extractionScope === 'core_universal' ||
    record.extractionScope === 'domain_profile' ||
    record.extractionScope === 'tenant_only'
      ? (record.extractionScope as DocumentKnowledgeExtractionScope)
      : undefined;

  const metadata: DocumentKnowledgeItemMetadata = {};

  if (typeof record.section === 'string' && record.section.trim().length > 0) {
    metadata.section = record.section.trim();
  }

  if (typeof record.page === 'number') {
    metadata.page = record.page;
  }

  if (typeof record.sheet === 'string' && record.sheet.trim().length > 0) {
    metadata.sheet = record.sheet.trim();
  }

  if (extractionScope) {
    metadata.extractionScope = extractionScope;
  }

  if (unspecifiedAxes && unspecifiedAxes.length > 0) {
    metadata.unspecifiedAxes = unspecifiedAxes;
  }

  if (claim) {
    metadata.claim = claim;
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

export function buildClaimValueText(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean).join(' | ');
}

function asClaimPayload(value: unknown): DocumentKnowledgeClaimPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.axis !== 'string' || record.axis.trim().length === 0) {
    return null;
  }

  if (
    record.kind !== 'value_list' &&
    record.kind !== 'qualifier' &&
    record.kind !== 'relation_target'
  ) {
    return null;
  }

  const values = Array.isArray(record.values)
    ? record.values.filter(
        (current): current is string => typeof current === 'string' && current.trim().length > 0,
      )
    : [];

  return {
    axis: record.axis.trim(),
    kind: record.kind,
    values,
  };
}

function normalizeSupportClass(value: string): DocumentKnowledgeSupportClass {
  if (value === 'PARTIAL_FACT' || value === 'partial_fact') {
    return 'partial_fact';
  }

  if (value === 'BOUNDED_INFERENCE' || value === 'bounded_inference') {
    return 'bounded_inference';
  }

  return 'explicit_fact';
}

function dedupeAxisSummaries(values: DocumentKnowledgeAxisSummary[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = [
      value.axis,
      value.supportClass,
      value.extractionScope ?? '',
      value.values.join('|'),
      (value.unspecifiedAxes ?? []).join('|'),
    ].join('::');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function resolveStructuralAxisLabels(locale?: string | null) {
  const family = String(locale ?? '')
    .toLowerCase()
    .split(/[-_]/u)[0]
    .trim();

  if (family === 'es' || family === 'en') {
    return structuralAxisLabels[family];
  }

  return structuralAxisLabels.default;
}

function pushNormalizedSignal(target: Set<string>, value: string) {
  const normalized = normalizeSignalText(value);

  if (!normalized) {
    return;
  }

  target.add(normalized);
}

function normalizeSignalText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

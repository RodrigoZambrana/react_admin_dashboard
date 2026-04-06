import {
  DocumentKnowledgeAxisSummary,
  DocumentKnowledgeClaimPayload,
  DocumentKnowledgeExtractionScope,
  DocumentKnowledgeItemMetadata,
  DocumentKnowledgeMetadataSummary,
  DocumentKnowledgeLayer,
  DocumentKnowledgeScopedValue,
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

export type StructuredKnowledgeClaim = {
  axis: string;
  facet?: string;
  layer: DocumentKnowledgeLayer;
  values: string[];
  supportClass: DocumentKnowledgeSupportClass;
  extractionScope?: DocumentKnowledgeExtractionScope;
  unspecifiedAxes?: string[];
  subject?: DocumentKnowledgeScopedValue;
  appliesTo?: DocumentKnowledgeScopedValue[];
};

const structuralAxisLabels = {
  default: {
    product_types: 'types',
    materials: 'materials',
    operation_modes: 'operation modes',
    color_options: 'colors',
    suitability: 'recommended for',
    payment_methods: 'payment methods',
    payment_terms: 'payment terms',
    construction_components: 'construction components',
    installment_count: 'installments',
    warranty_terms: 'warranty',
    feature_support: 'feature compatibility',
    coverage_locations: 'coverage',
    commercial_visit_cost: 'visit cost',
    travel_cost_responsibility: 'travel cost',
    service_offers: 'services',
    quote_fields: 'quote fields',
    exact_hours: 'hours',
    exact_color_options: 'exact colors',
    informative_flow: 'informative guidance',
    quote_transition: 'quote transition',
    confirmation_policy: 'confirmation policy',
    organic_response_pattern: 'organic response',
    comparison_guidance: 'comparison guidance',
  },
  en: {
    product_types: 'types',
    materials: 'materials',
    operation_modes: 'operation modes',
    color_options: 'colors',
    suitability: 'recommended for',
    payment_methods: 'payment methods',
    payment_terms: 'payment terms',
    construction_components: 'construction components',
    installment_count: 'installments',
    warranty_terms: 'warranty',
    feature_support: 'feature compatibility',
    coverage_locations: 'coverage',
    commercial_visit_cost: 'visit cost',
    travel_cost_responsibility: 'travel cost',
    service_offers: 'services',
    quote_fields: 'quote fields',
    exact_hours: 'hours',
    exact_color_options: 'exact colors',
    informative_flow: 'informative guidance',
    quote_transition: 'quote transition',
    confirmation_policy: 'confirmation policy',
    organic_response_pattern: 'organic response',
    comparison_guidance: 'comparison guidance',
  },
  es: {
    product_types: 'tipos',
    materials: 'materiales',
    operation_modes: 'accionamiento',
    color_options: 'colores',
    suitability: 'recomendado para',
    payment_methods: 'medios de pago',
    payment_terms: 'condiciones de pago',
    construction_components: 'componentes constructivos',
    installment_count: 'cuotas',
    warranty_terms: 'garantía',
    feature_support: 'compatibilidad',
    coverage_locations: 'cobertura',
    commercial_visit_cost: 'costo de visita',
    travel_cost_responsibility: 'costo de traslado',
    service_offers: 'servicios',
    quote_fields: 'datos para presupuesto',
    exact_hours: 'horarios exactos',
    exact_color_options: 'colores exactos',
    informative_flow: 'orientación informativa',
    quote_transition: 'paso a presupuesto',
    confirmation_policy: 'política de confirmación',
    organic_response_pattern: 'respuesta orgánica',
    comparison_guidance: 'guía comparativa',
  },
} as const;

export function buildKnowledgeRetrievalProjection(input: {
  topic: string;
  supportedAxes: string[];
  unspecifiedAxes: string[];
  section?: string;
  items: Array<
    Pick<KnowledgeItemLike, 'normalizedValue' | 'valueText' | 'metadata' | 'kind' | 'label' | 'supportClass'>
  >;
}) {
  const signals = new Set<string>();
  const claims = extractStructuredKnowledgeClaims(input.items);

  pushNormalizedSignal(signals, input.topic);
  pushNormalizedSignal(signals, input.section ?? '');

  for (const axis of input.supportedAxes) {
    pushNormalizedSignal(signals, axis);
  }

  for (const axis of input.unspecifiedAxes) {
    pushNormalizedSignal(signals, axis);
  }

  for (const claim of claims) {
    pushNormalizedSignal(signals, claim.axis);
    pushNormalizedSignal(signals, claim.subject?.value ?? '');

    for (const scope of claim.appliesTo ?? []) {
      pushNormalizedSignal(signals, scope.axis);
      pushNormalizedSignal(signals, scope.value);
    }

    for (const value of claim.values) {
      pushNormalizedSignal(signals, value);
    }
  }

  for (const item of input.items) {
    if (typeof item.normalizedValue === 'string' && item.normalizedValue.trim()) {
      pushNormalizedSignal(signals, item.normalizedValue);
      continue;
    }

    pushNormalizedSignal(signals, item.valueText);
  }

  return Array.from(signals.values()).join(' ').trim();
}

export function buildStructuralKnowledgeSummary(input: {
  locale?: string | null;
  claims: Array<DocumentKnowledgeAxisSummary | StructuredKnowledgeClaim>;
  limit?: number;
}) {
  const labels = resolveStructuralAxisLabels(input.locale);
  const selectedClaims = input.claims.slice(0, Math.max(1, input.limit ?? 2));
  const rendered = selectedClaims
    .map((claim) => {
      const label =
        labels[claim.axis as keyof typeof labels] ??
        claim.axis.replace(/_/gu, ' ');
      const facetLabel = claim.facet
        ? resolveStructuralKnowledgeFacetLabel(claim.facet, input.locale)
        : '';
      const values = claim.values.filter((value) => value.trim().length > 0);
      const supportState = (claim.appliesTo ?? []).find(
        (scope) => scope.axis === 'support_state',
      );
      const visibleScopes = (claim.appliesTo ?? []).filter(
        (scope) => scope.axis !== 'support_state',
      );

      if (values.length === 0) {
        return null;
      }

      const scopedBy = formatScopedContext(visibleScopes);
      const subject = claim.subject?.value?.trim();
      const scopedLabel = facetLabel ? `${label} ${facetLabel}` : label;

      if (claim.axis === 'feature_support' && supportState) {
        const compatibilitySummary = renderFeatureSupportSummary(
          supportState.value ?? supportState.normalizedValue ?? '',
          values,
        );

        if (scopedBy && subject) {
          return `${scopedLabel} (${subject}; ${scopedBy}): ${compatibilitySummary}`;
        }

        if (scopedBy) {
          return `${scopedLabel} (${scopedBy}): ${compatibilitySummary}`;
        }

        if (subject) {
          return `${scopedLabel} (${subject}): ${compatibilitySummary}`;
        }

        return `${scopedLabel}: ${compatibilitySummary}`;
      }

      if (scopedBy) {
        return `${scopedLabel} (${scopedBy}): ${values.join(', ')}`;
      }

      if (subject) {
        return `${scopedLabel} (${subject}): ${values.join(', ')}`;
      }

      return `${scopedLabel}: ${values.join(', ')}`;
    })
    .filter((value): value is string => Boolean(value));

  return rendered.join('; ').trim();
}

export function resolveStructuralKnowledgeAxisLabel(
  axis: string,
  locale?: string | null,
) {
  const labels = resolveStructuralAxisLabels(locale);
  return labels[axis as keyof typeof labels] ?? axis.replace(/_/gu, ' ');
}

export function resolveStructuralKnowledgeFacetLabel(
  facet: string,
  locale?: string | null,
) {
  const normalizedFacet = facet.trim().toLowerCase();

  if (locale?.toLowerCase().startsWith('es')) {
    if (normalizedFacet === 'installment_count') {
      return '(cuotas)';
    }

    if (normalizedFacet === 'card_brands') {
      return '(tarjetas)';
    }

    if (normalizedFacet === 'surcharge') {
      return '(recargo)';
    }
  }

  if (normalizedFacet === 'installment_count') {
    return '(installments)';
  }

  if (normalizedFacet === 'card_brands') {
    return '(cards)';
  }

  if (normalizedFacet === 'surcharge') {
    return '(surcharge)';
  }

  return `(${normalizedFacet.replace(/_/gu, ' ')})`;
}

export function extractStructuredKnowledgeClaims(
  items: Array<
    Pick<KnowledgeItemLike, 'kind' | 'label' | 'valueText' | 'supportClass' | 'metadata'>
  >,
  options?: {
    layers?: DocumentKnowledgeLayer[];
  },
) {
  const summaries: StructuredKnowledgeClaim[] = [];
  const allowedLayers =
    options?.layers && options.layers.length > 0
      ? new Set(options.layers)
      : null;

  for (const item of items) {
    if (item.kind !== 'CLAIM' && item.kind !== 'claim') {
      continue;
    }

    const metadata = asKnowledgeMetadata(item.metadata);
    const claim = metadata?.claim;

    if (!claim) {
      continue;
    }

    const layer = claim.layer ?? 'factual';

    if (allowedLayers && !allowedLayers.has(layer)) {
      continue;
    }

    const values = claim.values.filter((value) => value.trim().length > 0);

    if (values.length === 0) {
      continue;
    }

    summaries.push({
      axis: claim.axis,
      facet: claim.facet,
      layer,
      values,
      supportClass: normalizeSupportClass(item.supportClass),
      extractionScope: metadata?.extractionScope,
      unspecifiedAxes: metadata?.unspecifiedAxes,
      subject: claim.subject,
      appliesTo: claim.appliesTo,
    });
  }

  return dedupeStructuredKnowledgeClaims(summaries);
}

export function extractKnowledgeAxisSummaries(
  items: Array<
    Pick<KnowledgeItemLike, 'kind' | 'label' | 'valueText' | 'supportClass' | 'metadata'>
  >,
) {
  return extractStructuredKnowledgeClaims(items, {
    layers: ['factual'],
  }).map<DocumentKnowledgeAxisSummary>((claim) => ({
    axis: claim.axis,
    facet: claim.facet,
    values: claim.values,
    supportClass: claim.supportClass,
    layer: claim.layer,
    extractionScope: claim.extractionScope,
    unspecifiedAxes: claim.unspecifiedAxes,
    subject: claim.subject,
    appliesTo: claim.appliesTo,
  }));
}

export function extractKnowledgeMetadataSummaries(
  items: Array<
    Pick<KnowledgeItemLike, 'kind' | 'label' | 'valueText' | 'supportClass' | 'metadata'>
  >,
  options?: {
    layers?: Array<'prudence' | 'workflow' | 'guidance'>;
  },
) {
  const allowedLayers =
    options?.layers && options.layers.length > 0
      ? new Set(options.layers)
      : null;

  return extractStructuredKnowledgeClaims(items)
    .filter(
      (claim): claim is StructuredKnowledgeClaim & {
        layer: 'prudence' | 'workflow' | 'guidance';
      } =>
        claim.layer === 'prudence' ||
        claim.layer === 'workflow' ||
        claim.layer === 'guidance',
    )
    .filter((claim) => (allowedLayers ? allowedLayers.has(claim.layer) : true))
    .map<DocumentKnowledgeMetadataSummary>((claim) => ({
      axis: claim.axis,
      facet: claim.facet,
      values: claim.values,
      supportClass: claim.supportClass,
      layer: claim.layer,
      extractionScope: claim.extractionScope,
      unspecifiedAxes: claim.unspecifiedAxes,
      subject: claim.subject,
      appliesTo: claim.appliesTo,
    }));
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
  const profileKey =
    typeof record.profileKey === 'string' && record.profileKey.trim().length > 0
      ? record.profileKey.trim()
      : undefined;

  const metadata: DocumentKnowledgeItemMetadata = {};

  if (typeof record.section === 'string' && record.section.trim().length > 0) {
    metadata.section = record.section.trim();
  }

  if (
    typeof record.parentSection === 'string' &&
    record.parentSection.trim().length > 0
  ) {
    metadata.parentSection = record.parentSection.trim();
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

  if (profileKey) {
    metadata.profileKey = profileKey as DocumentKnowledgeItemMetadata['profileKey'];
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
    record.kind !== 'relation_target' &&
    record.kind !== 'relational_fact' &&
    record.kind !== 'coverage_gap' &&
    record.kind !== 'workflow_signal' &&
    record.kind !== 'guidance_signal'
  ) {
    return null;
  }

  const values = Array.isArray(record.values)
    ? record.values.filter(
        (current): current is string => typeof current === 'string' && current.trim().length > 0,
      )
    : [];
  const subject = asScopedValue(record.subject);
  const appliesTo = Array.isArray(record.appliesTo)
    ? record.appliesTo
        .map((scope) => asScopedValue(scope))
        .filter((scope): scope is DocumentKnowledgeScopedValue => Boolean(scope))
    : [];
  const layer = normalizeKnowledgeLayer(record.layer);

  return {
    axis: record.axis.trim(),
    facet:
      typeof record.facet === 'string' && record.facet.trim().length > 0
        ? record.facet.trim()
        : undefined,
    kind: record.kind,
    layer,
    values,
    subject: subject ?? undefined,
    appliesTo: appliesTo.length > 0 ? appliesTo : undefined,
  };
}

function asScopedValue(value: unknown): DocumentKnowledgeScopedValue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.axis !== 'string' || record.axis.trim().length === 0) {
    return null;
  }

  if (typeof record.value !== 'string' || record.value.trim().length === 0) {
    return null;
  }

  return {
    axis: record.axis.trim(),
    value: record.value.trim(),
    normalizedValue:
      typeof record.normalizedValue === 'string' && record.normalizedValue.trim().length > 0
        ? record.normalizedValue.trim()
        : undefined,
  };
}

function normalizeKnowledgeLayer(value: unknown): DocumentKnowledgeLayer | undefined {
  if (
    value === 'prudence' ||
    value === 'workflow' ||
    value === 'guidance' ||
    value === 'factual'
  ) {
    return value;
  }

  return undefined;
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

function dedupeStructuredKnowledgeClaims(values: StructuredKnowledgeClaim[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = [
      value.axis,
      value.facet ?? '',
      value.layer,
      value.supportClass,
      value.extractionScope ?? '',
      value.subject?.axis ?? '',
      value.subject?.normalizedValue ?? normalizeSignalText(value.subject?.value ?? ''),
      (value.appliesTo ?? [])
        .map((scope) => `${scope.axis}:${scope.normalizedValue ?? normalizeSignalText(scope.value)}`)
        .join('|'),
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

function formatScopedContext(values: DocumentKnowledgeScopedValue[]) {
  if (values.length === 0) {
    return '';
  }

  return values
    .map((value) => `${value.axis.replace(/_/gu, ' ')} ${value.value}`.trim())
    .join(', ');
}

function renderFeatureSupportSummary(state: string, values: string[]) {
  const features = values.join(', ');

  switch (state) {
    case 'does_not_support':
      return `no soporta ${features}`;
    case 'supports':
      return `admite ${features}`;
    case 'related_to':
      return `más ligado a ${features}`;
    default:
      return `${state.replace(/_/gu, ' ')} ${features}`.trim();
  }
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

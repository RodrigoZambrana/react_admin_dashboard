import { Injectable } from '@nestjs/common';

import {
  DocumentExtractionContext,
  DocumentExtractionProfile,
  DocumentExtractionProfileInput,
} from '../document-extraction-profile.types';
import {
  DocumentKnowledgeClaimPayload,
  DocumentKnowledgeExtractionScope,
  DocumentKnowledgeItemMetadata,
  DocumentKnowledgeItemSeed,
} from '../document.types';
import {
  cleanDocumentKnowledgeRecord,
  normalizeDocumentKnowledgeText,
} from '../document-knowledge-extraction.utils';

const productCatalogExtractionCatalog = {
  operationModeTerms: [
    'manual',
    'manuales',
    'motorizado',
    'motorizada',
    'motorizados',
    'motorizadas',
    'automatizado',
    'automatizada',
    'automatizados',
    'automatizadas',
  ],
  patterns: {
    productTypes:
      /(?:tipos?(?:\s+principales)?|modelos?|lineas?|líneas?|opciones)\s*[:\-]?\s*(.+)$/iu,
    materialListLeads: [
      /(?:disponibles?|disponible|fabricad[oa]s?|hech[oa]s?|realizad[oa]s?)\s+en\s+(.+?)(?:,?\s+(?:con|para)\b|[.;]|$)/iu,
      /material(?:es)?\s*[:\-]?\s*(.+)$/iu,
    ],
    suitability: /(?:ideal|recomendad[oa]s?|adecuad[oa]s?)\s+para\s+(.+)$/iu,
    colorList: /colores?\s*[:\-]?\s*(.+)$/iu,
    oversizedClaimTail:
      /\b(?:pueden ser|puede ser|con opciones|opciones manuales?|opciones motorizadas?)\b.*$/iu,
  },
  colorVarietySignals: [
    'variedad de colores',
    'varios colores',
    'diferentes colores',
  ],
} as const;

@Injectable()
export class ProductCatalogDocumentProfile implements DocumentExtractionProfile {
  readonly id = 'product_catalog' as const;

  supports(context: DocumentExtractionContext) {
    if (
      Array.isArray(context.sourceMetadata?.extractionProfiles) &&
      context.sourceMetadata.extractionProfiles.includes(this.id)
    ) {
      return true;
    }

    return context.activeCapabilities?.includes('product_catalog_lookup') ?? false;
  }

  extractChunk(input: DocumentExtractionProfileInput) {
    const items: DocumentKnowledgeItemSeed[] = [];

    for (const sentence of input.sentences) {
      items.push(...extractProductTypeSeeds(sentence));
      items.push(...extractMaterialSeeds(sentence));
      items.push(...extractOperationModeSeeds(sentence));
      items.push(...extractColorSeeds(sentence));
      items.push(...extractSuitabilitySeeds(sentence));
    }

    return dedupeStructuredItemSeeds(items);
  }
}

function extractProductTypeSeeds(sentence: string) {
  const listMatch = sentence.match(
    productCatalogExtractionCatalog.patterns.productTypes,
  );

  if (!listMatch?.[1]) {
    return [];
  }

  const values = splitListValues(listMatch[1]);

  if (values.length < 2) {
    return [];
  }

  return buildClaimWithEntities({
    axis: 'product_types',
    claimKind: 'value_list',
    claimValues: values,
    entityLabel: 'product_type',
    entities: values,
    supportClass: 'explicit_fact',
    evidenceTextSpan: sentence,
    metadata: buildProfileMetadata('tenant_only'),
  });
}

function extractMaterialSeeds(sentence: string) {
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);
  const materialSource = firstPatternCapture(
    sentence,
    productCatalogExtractionCatalog.patterns.materialListLeads,
  );
  const explicitValues = Array.from(
    new Set(
      splitListValues(materialSource)
        .map((value) => value.replace(/[.;]+$/u, '').trim())
        .filter((value) => value.length > 1)
        .filter(
          (value) =>
            !normalizedSentence.includes(
              `colores ${normalizeDocumentKnowledgeText(value)}`,
            ),
        ),
    ),
  );

  if (explicitValues.length === 0) {
    return [];
  }

  return buildClaimWithEntities({
    axis: 'materials',
    claimKind: 'value_list',
    claimValues: explicitValues,
    entityLabel: 'material',
    entities: explicitValues,
    supportClass: 'explicit_fact',
    evidenceTextSpan: sentence,
    metadata: buildProfileMetadata('tenant_only'),
  });
}

function extractOperationModeSeeds(sentence: string) {
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);
  const values = Array.from(
    new Set(
      productCatalogExtractionCatalog.operationModeTerms
        .filter((term) =>
          normalizedSentence.includes(normalizeDocumentKnowledgeText(term)),
        )
        .map(normalizeOperationModeTerm),
    ),
  );

  if (values.length === 0) {
    return [];
  }

  return buildClaimWithEntities({
    axis: 'operation_modes',
    claimKind: 'value_list',
    claimValues: values,
    entityLabel: 'operation_mode',
    entities: values,
    supportClass: 'explicit_fact',
    evidenceTextSpan: sentence,
    metadata: buildProfileMetadata('core'),
  });
}

function extractColorSeeds(sentence: string) {
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);

  if (
    productCatalogExtractionCatalog.colorVarietySignals.some((value) =>
      normalizedSentence.includes(normalizeDocumentKnowledgeText(value)),
    )
  ) {
    return [
      {
        kind: 'claim',
        label: 'color_options',
        valueText: 'variety',
        normalizedValue: 'color variety',
        supportClass: 'partial_fact',
        evidenceTextSpan: sentence,
        metadata:
          cleanDocumentKnowledgeRecord({
            ...buildProfileMetadata('core'),
            unspecifiedAxes: ['exact_color_options'],
            claim: {
              axis: 'color_options',
              kind: 'qualifier',
              values: ['variety'],
            } satisfies DocumentKnowledgeClaimPayload,
          }) ?? undefined,
      } satisfies DocumentKnowledgeItemSeed,
    ];
  }

  const colorListMatch = sentence.match(
    productCatalogExtractionCatalog.patterns.colorList,
  );

  if (!colorListMatch?.[1]) {
    return [];
  }

  const values = splitListValues(colorListMatch[1]);

  if (values.length === 0) {
    return [];
  }

  return buildClaimWithEntities({
    axis: 'color_options',
    claimKind: 'value_list',
    claimValues: values,
    entityLabel: 'color',
    entities: values,
    supportClass: 'explicit_fact',
    evidenceTextSpan: sentence,
    metadata: buildProfileMetadata('tenant_only'),
  });
}

function extractSuitabilitySeeds(sentence: string) {
  const match = sentence.match(productCatalogExtractionCatalog.patterns.suitability);

  if (!match?.[1]) {
    return [];
  }

  const cleaned = match[1].trim().replace(/[.;]+$/u, '');

  if (!cleaned) {
    return [];
  }

  return [
    {
      kind: 'claim',
      label: 'suitability',
      valueText: cleaned,
      normalizedValue: normalizeDocumentKnowledgeText(cleaned),
      supportClass: 'bounded_inference',
      evidenceTextSpan: sentence,
      metadata:
        cleanDocumentKnowledgeRecord({
          ...buildProfileMetadata('core'),
          claim: {
            axis: 'suitability',
            kind: 'relation_target',
            values: [cleaned],
          } satisfies DocumentKnowledgeClaimPayload,
        }) ?? undefined,
    } satisfies DocumentKnowledgeItemSeed,
  ];
}

function buildClaimWithEntities(input: {
  axis: string;
  claimKind: DocumentKnowledgeClaimPayload['kind'];
  claimValues: string[];
  entityLabel: string;
  entities: string[];
  supportClass: 'explicit_fact' | 'partial_fact' | 'bounded_inference';
  evidenceTextSpan: string;
  metadata: DocumentKnowledgeItemMetadata;
}) {
  const normalizedClaimValues = input.claimValues
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const items: DocumentKnowledgeItemSeed[] = [
    {
      kind: 'claim',
      label: input.axis,
      valueText: normalizedClaimValues.join(' | '),
      normalizedValue: normalizeDocumentKnowledgeText(
        normalizedClaimValues.join(' '),
      ),
      supportClass: input.supportClass,
      evidenceTextSpan: input.evidenceTextSpan,
      metadata:
        cleanDocumentKnowledgeRecord({
          ...input.metadata,
          claim: {
            axis: input.axis,
            kind: input.claimKind,
            values: normalizedClaimValues,
          } satisfies DocumentKnowledgeClaimPayload,
        }) ?? undefined,
    },
  ];

  input.entities.forEach((entity) => {
    items.push({
      kind: 'entity',
      label: input.entityLabel,
      valueText: entity,
      normalizedValue: normalizeDocumentKnowledgeText(entity),
      supportClass: input.supportClass,
      evidenceTextSpan: input.evidenceTextSpan,
      metadata: input.metadata,
    });
  });

  return items;
}

function buildProfileMetadata(scope: DocumentKnowledgeExtractionScope) {
  return cleanDocumentKnowledgeRecord({
    extractionScope: scope,
    profileKey: 'product_catalog' as const,
  }) as DocumentKnowledgeItemMetadata;
}

function firstPatternCapture(value: string, patterns: readonly RegExp[]) {
  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return '';
}

function splitListValues(value: string) {
  const truncated = value
    .replace(productCatalogExtractionCatalog.patterns.oversizedClaimTail, '')
    .replace(/[.;]+$/u, '')
    .trim();

  return truncated
    .replace(/\s+y\s+/giu, ', ')
    .split(/\s*[|,/]\s*|\s+-\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
    .slice(0, 8);
}

function normalizeOperationModeTerm(value: string) {
  const normalized = normalizeDocumentKnowledgeText(value);

  if (normalized.startsWith('manual')) {
    return 'manuales';
  }

  if (normalized.startsWith('motoriz')) {
    return 'motorizadas';
  }

  return 'automatizadas';
}

function dedupeStructuredItemSeeds(items: DocumentKnowledgeItemSeed[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = [
      item.kind,
      item.label,
      item.normalizedValue ?? normalizeDocumentKnowledgeText(item.valueText),
      item.supportClass,
      item.metadata?.profileKey ?? '',
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

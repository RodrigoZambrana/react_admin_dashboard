import { Injectable } from '@nestjs/common';

import { DocumentExtractionProfileConfigService } from '../document-extraction-profile-config.service';
import {
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

type ProductCatalogProfileConfig = ReturnType<
  DocumentExtractionProfileConfigService['resolveCompiledConfig']
>;

@Injectable()
export class ProductCatalogDocumentProfile implements DocumentExtractionProfile {
  readonly id = 'product_catalog' as const;

  constructor(
    private readonly configService: DocumentExtractionProfileConfigService = new DocumentExtractionProfileConfigService(),
  ) {}

  supports(input: DocumentExtractionProfileInput['context']) {
    if (
      Array.isArray(input.sourceMetadata?.extractionProfiles) &&
      input.sourceMetadata.extractionProfiles.includes(this.id)
    ) {
      return true;
    }

    return input.activeCapabilities?.includes('product_catalog_lookup') ?? false;
  }

  extractChunk(input: DocumentExtractionProfileInput) {
    const config = this.configService.resolveCompiledConfig({
      profileId: this.id,
      locale: input.context.locale,
    });
    const items: DocumentKnowledgeItemSeed[] = [];

    for (const sentence of input.sentences) {
      items.push(...extractProductTypeSeeds(sentence, config));
      items.push(...extractMaterialSeeds(sentence, config));
      items.push(...extractOperationModeSeeds(sentence, config));
      items.push(...extractColorSeeds(sentence, config));
      items.push(...extractSuitabilitySeeds(sentence, config));
    }

    return dedupeStructuredItemSeeds(items);
  }
}

function extractProductTypeSeeds(
  sentence: string,
  config: ProductCatalogProfileConfig,
) {
  const listMatch = sentence.match(config.productTypes?.listPattern ?? /^$/u);

  if (!listMatch?.[1]) {
    return [];
  }

  const values = splitListValues(listMatch[1], config);

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

function extractMaterialSeeds(
  sentence: string,
  config: ProductCatalogProfileConfig,
) {
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);
  const materialSource = firstPatternCapture(
    sentence,
    config.materials?.listPatterns ?? [],
  );
  const explicitValues = Array.from(
    new Set(
      splitListValues(materialSource, config)
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

function extractOperationModeSeeds(
  sentence: string,
  config: ProductCatalogProfileConfig,
) {
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);
  const values = Array.from(
    new Set(
      (config.operationModes?.normalizedTerms ?? [])
        .filter((termFamily) =>
          termFamily.sourceTerms.some((term) =>
            normalizedSentence.includes(normalizeDocumentKnowledgeText(term)),
          ),
        )
        .map((termFamily) => termFamily.normalizedValue),
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
    metadata: buildProfileMetadata('domain_profile'),
  });
}

function extractColorSeeds(sentence: string, config: ProductCatalogProfileConfig) {
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);

  if (
    (config.colorOptions?.varietySignals ?? []).some((signal) =>
      normalizedSentence.includes(signal),
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
            ...buildProfileMetadata('domain_profile'),
            unspecifiedAxes: config.colorOptions?.unspecifiedAxes ?? [],
            claim: {
              axis: 'color_options',
              kind: 'qualifier',
              values: ['variety'],
            } satisfies DocumentKnowledgeClaimPayload,
          }) ?? undefined,
      } satisfies DocumentKnowledgeItemSeed,
    ];
  }

  const colorListMatch = sentence.match(config.colorOptions?.listPattern ?? /^$/u);

  if (!colorListMatch?.[1]) {
    return [];
  }

  const values = splitListValues(colorListMatch[1], config);

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

function extractSuitabilitySeeds(
  sentence: string,
  config: ProductCatalogProfileConfig,
) {
  const match = sentence.match(config.suitability?.pattern ?? /^$/u);

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
          ...buildProfileMetadata('domain_profile'),
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

function splitListValues(value: string, config: ProductCatalogProfileConfig) {
  const conjunctionPattern = buildConjunctionPattern(
    config.matchingHints.conjunctionTerms,
  );
  const truncated = value
    .replace(config.matchingHints.oversizedClaimTailPattern ?? /$^/u, '')
    .replace(/[.;]+$/u, '')
    .trim();
  const normalized =
    conjunctionPattern === null
      ? truncated
      : truncated.replace(conjunctionPattern, ', ');

  return normalized
    .split(/\s*[|,/]\s*|\s+-\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
    .slice(0, 8);
}

function buildConjunctionPattern(terms: string[]) {
  const filtered = terms.map((term) => term.trim()).filter(Boolean);

  if (filtered.length === 0) {
    return null;
  }

  const alternation = filtered.map(escapeRegExp).join('|');
  return new RegExp(`\\s+(?:${alternation})\\s+`, 'giu');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

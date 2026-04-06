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
  DocumentKnowledgeLayer,
  DocumentKnowledgePolarity,
  DocumentKnowledgePromotionState,
  DocumentKnowledgePropositionScope,
  DocumentKnowledgePropositionSeed,
  DocumentKnowledgeScopedValue,
} from '../document.types';
import { buildClaimValueText } from '../document-knowledge-claims';
import {
  buildKnowledgePropositionCanonicalKey,
  buildKnowledgePropositionPatternKey,
} from '../document-knowledge-propositions';
import {
  captureDocumentKnowledgeLabeledValue,
  cleanDocumentKnowledgeRecord,
  dedupeDocumentKnowledgeValues,
  extractInlineDocumentKnowledgeAxisValues,
  isStructuredDocumentKnowledgeListEntry,
  matchesDocumentKnowledgeHeadingTerms,
  normalizeDocumentKnowledgeText,
  normalizeDocumentKnowledgeHeading,
  resolveDocumentKnowledgeSectionListEntry,
  sectionMatchesDocumentKnowledgeHeading,
  splitDocumentSemanticSentences,
  splitStructuredDocumentKnowledgeValues,
  stripDocumentKnowledgeBulletLead,
} from '../document-knowledge-extraction.utils';

type ProductCatalogProfileConfig = ReturnType<
  DocumentExtractionProfileConfigService['resolveCompiledConfig']
>;

type ChunkExtractionContext = {
  subject?: DocumentKnowledgeScopedValue;
  appliesTo: DocumentKnowledgeScopedValue[];
  rootHeading?: string;
  sectionHeading?: string;
  sectionScope?: ResolvedSectionScope;
};

type ProfileClaimContext = {
  layer: DocumentKnowledgeLayer;
  subject?: DocumentKnowledgeScopedValue;
  appliesTo?: DocumentKnowledgeScopedValue[];
};

type ResolvedSectionScope = {
  axis: 'materials' | 'product_types' | 'operation_modes';
  entityLabel: 'material' | 'product_type' | 'operation_mode';
  scopeValue: DocumentKnowledgeScopedValue;
  extractionScope: DocumentKnowledgeExtractionScope;
};

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
      derivedHints: input.context.profileConfigHints?.[this.id] ?? null,
    });
    const chunkContext = buildChunkContext(input, config);
    const items: DocumentKnowledgeItemSeed[] = [];
    const directPropositions: DocumentKnowledgePropositionSeed[] = [];

    items.push(...extractSectionScopeSeeds(chunkContext));

    for (const sentence of input.sentences) {
      items.push(...extractProductTypeSeeds(sentence, chunkContext, config));
      items.push(...extractMaterialSeeds(sentence, chunkContext, config));
      items.push(...extractOperationModeSeeds(sentence, chunkContext, config));
      items.push(...extractColorSeeds(sentence, chunkContext, config));
      items.push(...extractSuitabilitySeeds(sentence, chunkContext, config));
      items.push(...extractPaymentMethodSeeds(sentence, chunkContext, config));
      items.push(...extractConstructionComponentSeeds(sentence, chunkContext, config));
      items.push(...extractFeatureSupportSeeds(sentence, chunkContext, config));
      items.push(...extractInstallmentSeeds(sentence, chunkContext, config));
      items.push(...extractWarrantySeeds(sentence, chunkContext));
      items.push(...extractCoverageSeeds(sentence, chunkContext, config));
      items.push(...extractServiceOfferSeeds(sentence, chunkContext, config));
      items.push(...extractPrudenceSeeds(sentence, chunkContext, config));
      items.push(...extractWorkflowSeeds(sentence, chunkContext, config));
      directPropositions.push(
        ...extractIndependentPropositionSeeds(sentence, chunkContext, config),
      );
    }

    items.push(...extractGuidanceSeeds(input, chunkContext));
    const dedupedItems = dedupeStructuredItemSeeds(items);
    const propositions = dedupeStructuredPropositionSeeds(
      [...directPropositions, ...extractPropositionSeeds(dedupedItems)],
    );

    return {
      items: dedupedItems,
      propositions,
    };
  }
}

function extractProductTypeSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const headingEntry = resolveSectionListEntry(sentence, chunkContext.sectionHeading, {
    headingTerms: config.productTypes?.headingTerms ?? [],
  });
  const listMatch = sentence.match(config.productTypes?.listPattern ?? /^$/u);
  const source = headingEntry || listMatch?.[1] || '';

  if (!source) {
    return [];
  }

  const values = splitListValues(source, config);

  if (values.length === 0) {
    return [];
  }

  return buildRelationalClaimWithEntities({
    axis: 'product_types',
    claimKind: 'relational_fact',
    claimValues: values,
    entityLabel: 'product_type',
    entities: values,
    supportClass: 'explicit_fact',
    evidenceTextSpan: sentence,
    metadata: buildProfileMetadata({
      scope: 'tenant_only',
    }),
    claimContext: buildClaimContext('factual', chunkContext),
  });
}

function extractMaterialSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);
  const explicitValues = new Set<string>();
  const matchesMaterialSection = sectionMatchesHeading(
    chunkContext.sectionHeading,
    config.materials?.headingTerms ?? [],
  );
  const headingEntry = resolveSectionListEntry(sentence, chunkContext.sectionHeading, {
    headingTerms: config.materials?.headingTerms ?? [],
  });
  const materialSource = firstPatternCapture(
    sentence,
    config.materials?.listPatterns ?? [],
  );
  const phraseLedMaterialSource = /(?:disponibles?|disponible|fabricad[oa]s?|hech[oa]s?|realizad[oa]s?)\s+en\b/iu.test(
    sentence,
  )
    ? materialSource
    : '';

  splitListValues(
    headingEntry ||
      phraseLedMaterialSource ||
      (matchesMaterialSection ? materialSource : ''),
    config,
  )
    .map((value) => value.replace(/[.;]+$/u, '').trim())
    .filter((value) => value.length > 1)
    .filter(
      (value) =>
        !normalizedSentence.includes(
          `colores ${normalizeDocumentKnowledgeText(value)}`,
        ),
    )
    .forEach((value) => explicitValues.add(value));

  const offeredMaterialsMatch = sentence.match(
    /(?:se ofrecen|se ofrece)\s+en\s+([^.]+)/iu,
  );

  splitListValues(offeredMaterialsMatch?.[1] ?? '', config)
    .map((value) => value.replace(/[.;]+$/u, '').trim())
    .filter((value) => value.length > 1)
    .forEach((value) => explicitValues.add(value));

  for (const scope of chunkContext.appliesTo) {
    if (
      scope.axis === 'material' &&
      normalizedSentence.includes(scope.normalizedValue ?? normalizeDocumentKnowledgeText(scope.value))
    ) {
      explicitValues.add(scope.value);
    }
  }

  if (explicitValues.size === 0) {
    return [];
  }

  const values = Array.from(explicitValues.values());

  return buildRelationalClaimWithEntities({
    axis: 'materials',
    claimKind: 'relational_fact',
    claimValues: values,
    entityLabel: 'material',
    entities: values,
    supportClass: 'explicit_fact',
    evidenceTextSpan: sentence,
    metadata: buildProfileMetadata({
      scope: 'tenant_only',
    }),
    claimContext: buildClaimContext('factual', chunkContext),
  });
}

function extractOperationModeSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
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

  return buildRelationalClaimWithEntities({
    axis: 'operation_modes',
    claimKind: 'relational_fact',
    claimValues: values,
    entityLabel: 'operation_mode',
    entities: values,
    supportClass: 'explicit_fact',
    evidenceTextSpan: sentence,
    metadata: buildProfileMetadata({
      scope: 'domain_profile',
    }),
    claimContext: buildClaimContext('factual', chunkContext),
  });
}

function extractColorSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);
  const isWorkflowSection = sectionMatchesHeading(
    chunkContext.sectionHeading,
    config.workflow?.quoteFieldsHeadingTerms ?? [],
  );

  if (isWorkflowSection) {
    return [];
  }

  const headingEntry = resolveSectionListEntry(sentence, chunkContext.sectionHeading, {
    headingTerms: config.colorOptions?.headingTerms ?? [],
  });
  const colorListMatch = sentence.match(config.colorOptions?.listPattern ?? /^$/u);
  const source = headingEntry || colorListMatch?.[1] || '';
  const explicitValues = dedupeValues([
    ...splitListValues(source, config),
    ...extractInlineDocumentKnowledgeAxisValues({
      sentence,
      axisTerms: config.colorOptions?.headingTerms ?? [],
      options: {
        ...buildValueSplitOptions(config),
        pairedLeadTerms: ['color'],
      },
    }),
  ]);

  if (explicitValues.length > 0) {
    return buildRelationalClaimWithEntities({
      axis: 'color_options',
      claimKind: 'relational_fact',
      claimValues: explicitValues,
      entityLabel: 'color',
      entities: explicitValues,
      supportClass: 'explicit_fact',
      evidenceTextSpan: sentence,
      metadata: buildProfileMetadata({
        scope: 'tenant_only',
      }),
      claimContext: buildClaimContext('factual', chunkContext),
    });
  }

  if (
    (config.colorOptions?.varietySignals ?? []).some((signal) =>
      normalizedSentence.includes(signal),
    )
  ) {
    return [
      buildRelationalClaimSeed({
        axis: 'color_options',
        claimKind: 'coverage_gap',
        claimValues: ['variety'],
        supportClass: 'partial_fact',
        evidenceTextSpan: sentence,
        metadata: buildProfileMetadata({
          scope: 'domain_profile',
          unspecifiedAxes: config.colorOptions?.unspecifiedAxes ?? [],
        }),
        claimContext: buildClaimContext('factual', chunkContext),
      }),
      buildRelationalClaimSeed({
        axis: 'exact_color_options',
        claimKind: 'coverage_gap',
        claimValues: ['not_specified'],
        supportClass: 'partial_fact',
        evidenceTextSpan: sentence,
        metadata: buildProfileMetadata({
          scope: 'domain_profile',
          unspecifiedAxes: config.colorOptions?.unspecifiedAxes ?? [],
        }),
        claimContext: buildClaimContext('prudence', chunkContext),
      }),
    ];
  }

  return [];
}

function extractSuitabilitySeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
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
    buildRelationalClaimSeed({
      axis: 'suitability',
      claimKind: 'relational_fact',
      claimValues: [cleaned],
      supportClass: 'bounded_inference',
      evidenceTextSpan: sentence,
      metadata: buildProfileMetadata({
        scope: 'domain_profile',
      }),
      claimContext: buildClaimContext('factual', chunkContext),
    }),
  ];
}

function extractPaymentMethodSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const headingTerms = config.paymentMethods?.headingTerms ?? [];
  const source =
    captureListSection(sentence, headingTerms) ||
    (sectionMatchesHeading(chunkContext.sectionHeading, headingTerms) &&
    isStructuredListEntry(sentence)
      ? stripBulletLead(sentence)
      : '');

  if (!source) {
    return [];
  }

  const values = splitListValues(source, config).filter(
    (value) => !containsInstallmentTerm(value, config),
  );

  if (values.length === 0) {
    return [];
  }

  return buildRelationalClaimWithEntities({
    axis: 'payment_methods',
    claimKind: 'relational_fact',
    claimValues: values,
    entityLabel: 'payment_method',
    entities: values,
    supportClass: 'explicit_fact',
    evidenceTextSpan: sentence,
    metadata: buildProfileMetadata({
      scope: 'tenant_only',
    }),
    claimContext: buildClaimContext('factual', chunkContext),
  });
}

function extractInstallmentSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const strippedSentence = stripBulletLead(sentence);
  const paymentMethod = resolvePaymentMethodScope(
    strippedSentence,
    chunkContext,
    config,
  );
  const count = extractInstallmentCount(strippedSentence, config);
  const cardBrands = extractPaymentCardBrands(strippedSentence, config);
  const items: DocumentKnowledgeItemSeed[] = [];

  if (paymentMethod && count) {
    const claimContext = buildClaimContext('factual', chunkContext, [
      ...chunkContext.appliesTo,
      buildScopedValue('payment_method', paymentMethod),
    ]);

    items.push(
      buildRelationalClaimSeed({
        axis: 'payment_terms',
        facet: 'installment_count',
        claimKind: 'relational_fact',
        claimValues: [count],
        supportClass: 'explicit_fact',
        evidenceTextSpan: sentence,
        metadata: buildProfileMetadata({
          scope: 'tenant_only',
        }),
        claimContext,
      }),
      buildRelationalClaimSeed({
        axis: 'installment_count',
        claimKind: 'relational_fact',
        claimValues: [count],
        supportClass: 'explicit_fact',
        evidenceTextSpan: sentence,
        metadata: buildProfileMetadata({
          scope: 'tenant_only',
        }),
        claimContext,
      }),
      buildEntitySeed({
        label: 'payment_method',
        value: paymentMethod,
        supportClass: 'explicit_fact',
        evidenceTextSpan: sentence,
        metadata: buildProfileMetadata({
          scope: 'tenant_only',
        }),
      }),
    );
  }

  if (paymentMethod && cardBrands.length > 0) {
    items.push(
      buildRelationalClaimSeed({
        axis: 'payment_terms',
        facet: 'card_brands',
        claimKind: 'relational_fact',
        claimValues: cardBrands,
        supportClass: 'explicit_fact',
        evidenceTextSpan: sentence,
        metadata: buildProfileMetadata({
          scope: 'tenant_only',
        }),
        claimContext: buildClaimContext('factual', chunkContext, [
          ...chunkContext.appliesTo,
          buildScopedValue('payment_method', paymentMethod),
        ]),
      }),
    );
  }

  return items;
}

function resolvePaymentMethodScope(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const headingScope = resolveSpecificPaymentMethodHeading(chunkContext, config);

  if (headingScope) {
    return headingScope;
  }

  const installmentTerms = config.paymentMethods?.installmentTerms ?? [];
  const sentenceCandidates = [
    matchPaymentMethodBeforeInstallments(
      sentence,
      config.paymentMethods?.scopeVerbTerms ?? [],
      installmentTerms,
    ),
    matchPaymentMethodAfterInstallments(
      sentence,
      config.paymentMethods?.scopeLeadTerms ?? [],
      installmentTerms,
    ),
    matchPaymentMethodAfterLeadTerms(
      sentence,
      config.paymentMethods?.scopeLeadTerms ?? [],
    ),
  ];

  for (const candidate of sentenceCandidates) {
    const cleanedCandidate = cleanPaymentMethodScopeCandidate(candidate, config);
    if (cleanedCandidate) {
      return cleanedCandidate;
    }
  }

  return null;
}

function extractInstallmentCount(
  sentence: string,
  config: ProductCatalogProfileConfig,
) {
  const installmentTerms = config.paymentMethods?.installmentTerms ?? [];
  if (installmentTerms.length === 0) {
    return null;
  }

  const match = sentence.match(
    new RegExp(
      `\\b(?:hasta\\s+)?(\\d+)\\s+(?:${buildAlternationPattern(installmentTerms)})\\b`,
      'iu',
    ),
  );
  return match?.[1]?.trim() ?? null;
}

function extractPaymentCardBrands(
  sentence: string,
  config: ProductCatalogProfileConfig,
) {
  const normalized = normalizeDocumentKnowledgeText(sentence);
  const cardLeadTerms = config.paymentMethods?.cardLeadTerms ?? [];
  const brandListLeadTerms = config.paymentMethods?.brandListLeadTerms ?? [];

  if (
    cardLeadTerms.length > 0 &&
    !cardLeadTerms.some((term) => normalized.includes(term))
  ) {
    return [];
  }

  const listSource =
    matchPaymentTermTail(sentence, brandListLeadTerms) ??
    matchPaymentTermTail(sentence, cardLeadTerms) ??
    sentence.match(/:\s*([^.]+)/u)?.[1] ??
    '';
  const cleaned = listSource
    .replace(/\bseg[uú]n\b.*$/iu, '')
    .replace(/[.;]+$/u, '')
    .trim();

  if (!cleaned) {
    return [];
  }

  const values = splitListValues(cleaned, config)
    .map((value) => value.replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/u, '').trim())
    .filter((value) => value.length > 0);

  return dedupeDocumentKnowledgeValues(values);
}

function resolveSpecificPaymentMethodHeading(
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const genericHeadingTerms = config.paymentMethods?.headingTerms ?? [];
  const headingCandidates = [chunkContext.sectionHeading]
    .map((value) => value?.trim() ?? '')
    .filter((value) => value.length > 0);

  for (const heading of headingCandidates) {
    const normalizedHeading = normalizeDocumentKnowledgeHeading(heading);
    if (!normalizedHeading) {
      continue;
    }

    if (
      matchesDocumentKnowledgeHeadingTerms(normalizedHeading, genericHeadingTerms)
    ) {
      continue;
    }

    const tokenCount = normalizedHeading
      .split(/\s+/u)
      .map((token) => token.trim())
      .filter((token) => token.length > 0).length;

    if (tokenCount === 0 || tokenCount > 4) {
      continue;
    }

    return heading.replace(/^[\d.\-)\s]+/u, '').trim();
  }

  return null;
}

function cleanPaymentMethodScopeCandidate(
  candidate: string | null | undefined,
  config: ProductCatalogProfileConfig,
) {
  if (!candidate) {
    return null;
  }

  const normalizedCandidate = normalizeDocumentKnowledgeText(candidate);
  const genericHeadingTerms = config.paymentMethods?.headingTerms ?? [];

  if (
    !normalizedCandidate ||
    matchesDocumentKnowledgeHeadingTerms(normalizedCandidate, genericHeadingTerms)
  ) {
    return null;
  }

  const cleaned = candidate
    .replace(/[():]+/gu, ' ')
    .replace(buildInstallmentTailPattern(config), '')
    .replace(/[.,;]+$/u, '')
    .replace(/\s+/gu, ' ')
    .trim();

  if (!cleaned) {
    return null;
  }

  const tokenCount = cleaned
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0).length;

  if (tokenCount === 0 || tokenCount > 5) {
    return null;
  }

  return cleaned;
}

function matchPaymentMethodBeforeInstallments(
  sentence: string,
  verbTerms: readonly string[],
  installmentTerms: readonly string[],
) {
  if (verbTerms.length === 0 || installmentTerms.length === 0) {
    return null;
  }

  const verbPattern = buildAlternationPattern(verbTerms);
  const installmentPattern = buildAlternationPattern(installmentTerms);
  const match = sentence.match(
    new RegExp(
      `\\b([^.]{1,60}?)\\s+(?:${verbPattern})\\s+(?:hasta\\s+)?\\d+\\s+(?:${installmentPattern})\\b`,
      'iu',
    ),
  );

  return match?.[1]?.trim() ?? null;
}

function matchPaymentMethodAfterInstallments(
  sentence: string,
  leadTerms: readonly string[],
  installmentTerms: readonly string[],
) {
  if (leadTerms.length === 0 || installmentTerms.length === 0) {
    return null;
  }

  const leadPattern = buildAlternationPattern(leadTerms);
  const installmentPattern = buildAlternationPattern(installmentTerms);
  const match = sentence.match(
    new RegExp(
      `\\b(?:hasta\\s+)?\\d+\\s+(?:${installmentPattern})(?:[^.]{0,80})?\\b(?:${leadPattern})\\s+([^.]+)`,
      'iu',
    ),
  );

  return match?.[1]?.trim() ?? null;
}

function matchPaymentMethodAfterLeadTerms(
  sentence: string,
  leadTerms: readonly string[],
) {
  return matchPaymentTermTail(sentence, leadTerms);
}

function matchPaymentTermTail(sentence: string, leadTerms: readonly string[]) {
  if (leadTerms.length === 0) {
    return null;
  }

  const leadPattern = buildAlternationPattern(leadTerms);
  const match = sentence.match(
    new RegExp(`\\b(?:${leadPattern})\\s+([^.]+)`, 'iu'),
  );

  return match?.[1]?.trim() ?? null;
}

function buildAlternationPattern(terms: readonly string[]) {
  return terms.map((term) => escapeGuidanceRegExp(term)).join('|');
}

function containsInstallmentTerm(
  value: string,
  config: ProductCatalogProfileConfig,
) {
  const normalizedValue = normalizeDocumentKnowledgeText(value);
  return (config.paymentMethods?.installmentTerms ?? []).some((term) =>
    normalizedValue.includes(term),
  );
}

function buildInstallmentTailPattern(config: ProductCatalogProfileConfig) {
  const installmentTerms = config.paymentMethods?.installmentTerms ?? [];

  if (installmentTerms.length === 0) {
    return /^$/u;
  }

  return new RegExp(
    `\\b(?:hasta\\s+)?\\d+\\s+(?:${buildAlternationPattern(installmentTerms)})\\b.*$`,
    'iu',
  );
}

function extractWarrantySeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
) {
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);

  if (
    !normalizedSentence.includes('garantia') &&
    !/\b\d+\s+a[nñ]os?\b/iu.test(normalizedSentence)
  ) {
    return [];
  }

  const yearMatches = Array.from(sentence.matchAll(/(\d+)\s+a[nñ]os?/giu));

  if (yearMatches.length === 0) {
    return [];
  }

  const scopeValues = resolveWarrantyScopeValues(normalizedSentence);
  const items: DocumentKnowledgeItemSeed[] = [];

  for (const match of yearMatches) {
    const count = match[1]?.trim();

    if (!count) {
      continue;
    }

    const warrantyValue = `${count} ${count === '1' ? 'año' : 'años'}`;

    if (scopeValues.length === 0) {
      items.push(
        buildRelationalClaimSeed({
          axis: 'warranty_terms',
          claimKind: 'relational_fact',
          claimValues: [warrantyValue],
          supportClass: 'explicit_fact',
          evidenceTextSpan: sentence,
          metadata: buildProfileMetadata({
            scope: 'tenant_only',
          }),
          claimContext: buildClaimContext('factual', chunkContext),
        }),
      );
      continue;
    }

    for (const scopeValue of scopeValues) {
      items.push(
        buildRelationalClaimSeed({
          axis: 'warranty_terms',
          claimKind: 'relational_fact',
          claimValues: [warrantyValue],
          supportClass: 'explicit_fact',
          evidenceTextSpan: sentence,
          metadata: buildProfileMetadata({
            scope: 'tenant_only',
          }),
          claimContext: buildClaimContext('factual', chunkContext, [
            ...chunkContext.appliesTo,
            scopeValue,
          ]),
        }),
      );
    }
  }

  return items;
}

function extractConstructionComponentSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const headingTerms = config.constructionComponents?.headingTerms ?? [];

  if (
    headingTerms.length === 0 ||
    !sectionMatchesHeading(chunkContext.sectionHeading, headingTerms) ||
    !isStructuredListEntry(sentence)
  ) {
    return [];
  }

  const value = stripBulletLead(sentence).replace(/[.;]+$/u, '').trim();

  if (!value) {
    return [];
  }

  return [
    buildRelationalClaimSeed({
      axis: 'construction_components',
      claimKind: 'relational_fact',
      claimValues: [value],
      supportClass: 'explicit_fact',
      evidenceTextSpan: sentence,
      metadata: buildProfileMetadata({
        scope: 'tenant_only',
      }),
      claimContext: buildClaimContext('factual', chunkContext),
    }),
  ];
}

function extractFeatureSupportSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const statement = resolveFeatureSupportStatement(sentence, config);

  if (!statement || statement.features.length === 0) {
    return [];
  }

  return [
    buildRelationalClaimSeed({
      axis: 'feature_support',
      claimKind: 'relational_fact',
      claimValues: statement.features,
      supportClass: 'explicit_fact',
      evidenceTextSpan: sentence,
      metadata: buildProfileMetadata({
        scope: 'tenant_only',
      }),
      claimContext: buildClaimContext('factual', chunkContext, [
        ...chunkContext.appliesTo,
        buildScopedValue('support_state', statement.state),
      ]),
    }),
  ];
}

function extractCoverageSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const items: DocumentKnowledgeItemSeed[] = [];
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);

  if (normalizedSentence.includes('todo el pais')) {
    items.push(
      buildRelationalClaimSeed({
        axis: 'coverage_locations',
        claimKind: 'relational_fact',
        claimValues: ['todo el pais'],
        supportClass: 'explicit_fact',
        evidenceTextSpan: sentence,
        metadata: buildProfileMetadata({
          scope: 'tenant_only',
        }),
        claimContext: buildClaimContext('factual', chunkContext),
      }),
    );
  }

  const visitCostLocation =
    hasNormalizedPhrase(normalizedSentence, config.coverage?.visitTerms ?? []) &&
    hasNormalizedPhrase(normalizedSentence, config.coverage?.freeCostTerms ?? [])
      ? captureScopedLocation(sentence, {
          leadTerms: config.coverage?.insideLocationLeadTerms ?? [],
          stopTerms: config.coverage?.locationStopTerms ?? [],
        })
      : null;

  if (visitCostLocation) {
    items.push(
      buildRelationalClaimSeed({
        axis: 'commercial_visit_cost',
        claimKind: 'relational_fact',
        claimValues: ['sin costo'],
        supportClass: 'explicit_fact',
        evidenceTextSpan: sentence,
        metadata: buildProfileMetadata({
          scope: 'tenant_only',
        }),
        claimContext: buildClaimContext('factual', chunkContext, [
          ...chunkContext.appliesTo,
          buildScopedValue('location', visitCostLocation),
          buildScopedValue('location_relation', 'inside'),
        ]),
      }),
    );
  }

  const outsideLocation =
    hasNormalizedPhrase(
      normalizedSentence,
      config.coverage?.travelCostTerms ?? [],
    )
      ? captureScopedLocation(sentence, {
          leadTerms: config.coverage?.outsideLocationLeadTerms ?? [],
          stopTerms: config.coverage?.locationStopTerms ?? [],
        })
      : null;

  if (outsideLocation) {
    items.push(
      buildRelationalClaimSeed({
        axis: 'travel_cost_responsibility',
        claimKind: 'coverage_gap',
        claimValues: ['puede corresponder costo de traslado'],
        supportClass: 'partial_fact',
        evidenceTextSpan: sentence,
        metadata: buildProfileMetadata({
          scope: 'tenant_only',
        }),
        claimContext: buildClaimContext('factual', chunkContext, [
          ...chunkContext.appliesTo,
          buildScopedValue('location', outsideLocation),
          buildScopedValue('location_relation', 'outside'),
        ]),
      }),
    );
  }

  const montevideoBaseMatch = sentence.match(
    /(?:opera desde|base en)\s+([A-ZÁÉÍÓÚÜÑa-záéíóúüñ\s]+?)(?:[.,]|$)/iu,
  );

  if (montevideoBaseMatch?.[1]) {
    items.push(
      buildRelationalClaimSeed({
        axis: 'coverage_locations',
        claimKind: 'relational_fact',
        claimValues: [montevideoBaseMatch[1].trim()],
        supportClass: 'explicit_fact',
        evidenceTextSpan: sentence,
        metadata: buildProfileMetadata({
          scope: 'tenant_only',
        }),
        claimContext: buildClaimContext('factual', chunkContext),
      }),
    );
  }

  return items;
}

function resolveWarrantyScopeValues(normalizedSentence: string) {
  const scopes: DocumentKnowledgeScopedValue[] = [];

  if (/\bpvc\b/iu.test(normalizedSentence)) {
    scopes.push(buildScopedValue('material', 'PVC'));
  }

  if (/\baluminio\b/iu.test(normalizedSentence)) {
    scopes.push(buildScopedValue('material', 'ALUMINIO'));
  }

  if (/\broller\b/iu.test(normalizedSentence)) {
    scopes.push(buildScopedValue('product_type', 'roller'));
  }

  if (/\bmotorizaci[oó]n\b/iu.test(normalizedSentence)) {
    scopes.push(buildScopedValue('service_offer', 'motorizacion'));
  }

  return dedupeScopedValues(scopes);
}

function resolveFeatureSupportStatement(
  sentence: string,
  config: ProductCatalogProfileConfig,
) {
  const negativeFeatureSource = captureFeatureSupportTail(
    sentence,
    config.featureSupport?.negativeLeadTerms ?? [],
  );

  if (negativeFeatureSource) {
    return {
      state: 'does_not_support' as const,
      features: extractFeatureSupportValues(negativeFeatureSource, config),
    };
  }

  const positiveFeatureSource = captureFeatureSupportTail(
    sentence,
    config.featureSupport?.positiveLeadTerms ?? [],
  );

  if (positiveFeatureSource) {
    return {
      state: 'supports' as const,
      features: extractFeatureSupportValues(positiveFeatureSource, config),
    };
  }

  const relatedFeatureSource = captureFeatureSupportTail(
    sentence,
    config.featureSupport?.relatedLeadPhrases ?? [],
  );

  if (relatedFeatureSource) {
    return {
      state: 'related_to' as const,
      features: extractFeatureSupportValues(relatedFeatureSource, config),
    };
  }

  return null;
}

function extractFeatureSupportValues(
  value: string,
  config: ProductCatalogProfileConfig,
) {
  let cleaned = value.replace(/\([^)]*\)/gu, '').replace(/[.;]+$/u, '').trim();

  for (const tailTerm of config.featureSupport?.trimTailTerms ?? []) {
    const pattern = new RegExp(`\\b${escapeGuidanceRegExp(tailTerm)}\\b.*$`, 'iu');
    cleaned = cleaned.replace(pattern, '').trim();
  }

  if (!cleaned) {
    return [];
  }

  const parsedValues = splitListValues(cleaned, config);
  const normalizedValues = parsedValues
    .flatMap((entry) =>
      splitFeatureSupportAlternatives(
        entry,
        config.featureSupport?.alternativeConjunctionTerms ?? [],
      ),
    )
    .flatMap((entry) => expandFeatureSupportAliases(entry))
    .map((entry) =>
      entry
        .replace(
          buildLeadingNoisePattern(config.featureSupport?.removableLeadTerms ?? []),
          '',
        )
        .replace(/\s+/gu, ' ')
        .trim(),
    )
    .filter((entry) => isLikelyFeatureSupportValue(entry));

  return dedupeValues(normalizedValues);
}

function expandFeatureSupportAliases(value: string) {
  const cleaned = value.trim();
  const normalized = normalizeDocumentKnowledgeText(cleaned);

  if (!normalized) {
    return [];
  }

  if (normalized === 'dvh') {
    return ['DVH', 'doble vidrio'];
  }

  if (
    normalized.includes('doble vidrio') ||
    normalized.includes('doble vidriado')
  ) {
    return cleaned.toUpperCase() === 'DVH' ? ['DVH', 'doble vidrio'] : [cleaned, 'DVH'];
  }

  return [cleaned];
}

function isLikelyFeatureSupportValue(value: string) {
  const normalized = normalizeDocumentKnowledgeText(value);

  if (!normalized) {
    return false;
  }

  const tokenCount = normalized.split(/\s+/u).filter(Boolean).length;

  if (tokenCount === 0 || tokenCount > 5) {
    return false;
  }

  return !/^(?:girar|regular|desplazar|abrir|buscar|mejorar|sumar)\b/iu.test(
    normalized,
  );
}

function captureFeatureSupportTail(
  sentence: string,
  leadTerms: readonly string[],
) {
  if (leadTerms.length === 0) {
    return '';
  }

  const alternation = leadTerms.map((term) => escapeGuidanceRegExp(term)).join('|');
  const pattern = new RegExp(`\\b(?:${alternation})\\b\\s+([^.]+)`, 'iu');
  return firstPatternCapture(sentence, [pattern]);
}

function buildLeadingNoisePattern(leadTerms: readonly string[]) {
  if (leadTerms.length === 0) {
    return /^$/u;
  }

  const alternation = leadTerms.map((term) => escapeGuidanceRegExp(term)).join('|');
  return new RegExp(`^(?:${alternation})\\s+`, 'iu');
}

function splitFeatureSupportAlternatives(
  value: string,
  conjunctionTerms: readonly string[],
) {
  const cleaned = value.trim();

  if (!cleaned || conjunctionTerms.length === 0) {
    return cleaned ? [cleaned] : [];
  }

  const alternation = conjunctionTerms
    .map((term) => escapeGuidanceRegExp(term))
    .join('|');
  const parts = cleaned
    .split(new RegExp(`\\s+(?:${alternation})\\s+`, 'iu'))
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [cleaned];
}

function extractServiceOfferSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const values = new Set<string>();
  const combinedMatch = sentence.match(/(?:combina|incluye)\s+([^.]+)/iu);

  if (combinedMatch?.[1]) {
    splitListValues(combinedMatch[1], config).forEach((value) => values.add(value));
  }

  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);
  const affirmativeServiceSentence = hasNormalizedPhrase(
    normalizedSentence,
    config.serviceOffers?.affirmativeLeadPhrases ?? [],
  );

  if (affirmativeServiceSentence) {
    resolveMatchedServiceOfferValues(sentence, config).forEach((value) => values.add(value));
    resolveMatchedServiceOfferValues(chunkContext.sectionHeading ?? '', config).forEach((value) =>
      values.add(value),
    );
  }

  const serviceValues = Array.from(values.values());

  if (serviceValues.length > 0) {
    return buildRelationalClaimWithEntities({
      axis: 'service_offers',
      claimKind: 'relational_fact',
      claimValues: serviceValues,
      entityLabel: 'service_offer',
      entities: serviceValues,
      supportClass: 'explicit_fact',
      evidenceTextSpan: sentence,
      metadata: buildProfileMetadata({
        scope: 'tenant_only',
      }),
      claimContext: buildClaimContext('factual', chunkContext),
    });
  }

  return [];
}

function resolveMatchedServiceOfferValues(
  value: string,
  config: ProductCatalogProfileConfig,
) {
  const normalizedValue = normalizeDocumentKnowledgeText(value);

  if (!normalizedValue) {
    return [];
  }

  const matchedValues =
    config.serviceOffers?.normalizedTerms
      ?.filter(({ sourceTerms }) =>
        sourceTerms.some((term) =>
          normalizedValue.includes(normalizeDocumentKnowledgeText(term)),
        ),
      )
      .map(({ normalizedValue }) => normalizedValue) ?? [];

  return dedupeValues(matchedValues);
}

function hasNormalizedPhrase(value: string, phrases: readonly string[]) {
  return phrases.some((phrase) => value.includes(phrase));
}

function captureScopedLocation(
  sentence: string,
  input: {
    leadTerms: readonly string[];
    stopTerms: readonly string[];
  },
) {
  if (input.leadTerms.length === 0) {
    return null;
  }

  const alternation = input.leadTerms
    .map((term) => escapeGuidanceRegExp(term))
    .join('|');
  const stopAlternation = input.stopTerms
    .map((term) => escapeGuidanceRegExp(term))
    .join('|');
  const stopClause = stopAlternation.length > 0
    ? `(?=\\s+(?:${stopAlternation})\\b|[.,;]|$)`
    : `(?=[.,;]|$)`;
  const pattern = new RegExp(
    `\\b(?:${alternation})\\b\\s+([\\p{L}\\p{N}\\s]+?)${stopClause}`,
    'iu',
  );
  const match = sentence.match(pattern)?.[1]?.trim();

  return match && match.length > 0 ? match : null;
}

function extractPrudenceSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);
  const items: DocumentKnowledgeItemSeed[] = [];
  const exactHoursHeadingMatch = sectionMatchesHeading(
    chunkContext.sectionHeading,
    config.prudence?.exactHoursHeadingTerms ?? [],
  );
  const exactColorHeadingMatch = sectionMatchesHeading(
    chunkContext.sectionHeading,
    config.prudence?.exactColorHeadingTerms ?? [],
  );

  if (matchesPrudenceSignal(normalizedSentence, {
    axisTerms: config.prudence?.exactHoursAxisTerms ?? [],
    cautionTerms: config.prudence?.exactHoursCautionTerms ?? [],
    headingMatches: exactHoursHeadingMatch,
  })) {
    items.push(
      buildRelationalClaimSeed({
        axis: 'exact_hours',
        claimKind: 'coverage_gap',
        claimValues: ['not_unified'],
        supportClass: 'partial_fact',
        evidenceTextSpan: sentence,
        metadata: buildProfileMetadata({
          scope: 'domain_profile',
        }),
        claimContext: buildClaimContext('prudence', chunkContext),
      }),
    );
  }

  if (matchesPrudenceSignal(normalizedSentence, {
    axisTerms: config.prudence?.exactColorAxisTerms ?? [],
    cautionTerms: config.prudence?.exactColorCautionTerms ?? [],
    headingMatches: exactColorHeadingMatch,
  })) {
    items.push(
      buildRelationalClaimSeed({
        axis: 'exact_color_options',
        claimKind: 'coverage_gap',
        claimValues: ['requires_confirmation'],
        supportClass: 'partial_fact',
        evidenceTextSpan: sentence,
        metadata: buildProfileMetadata({
          scope: 'domain_profile',
          unspecifiedAxes:
            config.prudence?.exactColorUnspecifiedAxes ?? ['exact_color_options'],
        }),
        claimContext: buildClaimContext('prudence', chunkContext),
      }),
    );
  }

  return items;
}

function extractWorkflowSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const normalizedSection = normalizeDocumentKnowledgeText(
    chunkContext.sectionHeading ?? '',
  );

  if (normalizedSection.startsWith('si la consulta')) {
    return [];
  }

  const headingTerms = config.workflow?.quoteFieldsHeadingTerms ?? [];
  const quoteFields =
    captureListSection(sentence, headingTerms) ||
    (sectionMatchesHeading(chunkContext.sectionHeading, headingTerms) &&
    isStructuredListEntry(sentence)
      ? stripBulletLead(sentence)
      : '');

  if (quoteFields) {
    const values = splitListValues(quoteFields, config);

    if (values.length > 0) {
      return [
        buildRelationalClaimSeed({
          axis: 'quote_fields',
          claimKind: 'workflow_signal',
          claimValues: values,
          supportClass: 'explicit_fact',
          evidenceTextSpan: sentence,
          metadata: buildProfileMetadata({
            scope: 'domain_profile',
          }),
          claimContext: buildClaimContext('workflow', chunkContext),
        }),
      ];
    }
  }

  return [];
}

function extractGuidanceSeeds(
  input: DocumentExtractionProfileInput,
  chunkContext: ChunkExtractionContext,
) {
  const normalizedSection = normalizeDocumentKnowledgeText(
    chunkContext.sectionHeading ?? '',
  );
  const normalizedRoot = normalizeDocumentKnowledgeText(
    chunkContext.rootHeading ?? '',
  );
  const chunkContent = input.chunk.content.trim();

  if (!chunkContent) {
    return [];
  }

  const guidanceContext = buildGuidanceClaimContext(chunkContext);
  const processFlowValues = extractChunkBulletValues(chunkContent);
  const flowAxis = classifyConditionalGuidanceAxis({
    normalizedSection,
    processFlowValues,
  });

  if (flowAxis === 'informative_flow') {
    return buildGuidanceClaimSeeds({
      axis: 'informative_flow',
      values: processFlowValues,
      evidenceTextSpan: chunkContent,
      subjectOverride: buildScopedValue(
        'section_topic',
        chunkContext.sectionHeading ?? 'CONSULTA INFORMATIVA',
      ),
      claimContext: guidanceContext,
    });
  }

  if (flowAxis === 'quote_transition') {
    return buildGuidanceClaimSeeds({
      axis: 'quote_transition',
      values: processFlowValues,
      evidenceTextSpan: chunkContent,
      subjectOverride:
        buildGuidanceSectionSubject(chunkContext) ??
        buildScopedValue(
          'section_topic',
          chunkContext.sectionHeading ?? 'TRANSICION A PRESUPUESTO',
        ),
      claimContext: guidanceContext,
    });
  }

  if (flowAxis === 'confirmation_policy') {
    return buildGuidanceClaimSeeds({
      axis: 'confirmation_policy',
      values: processFlowValues,
      evidenceTextSpan: chunkContent,
      subjectOverride: buildScopedValue(
        'section_topic',
        chunkContext.sectionHeading ?? 'CONFIRMACION PUNTUAL',
      ),
      claimContext: guidanceContext,
    });
  }

  if (!looksLikeGuidanceResponseSection(normalizedRoot, normalizedSection)) {
    return [];
  }

  const paragraphValue = normalizeGuidanceParagraphContent({
    content: chunkContent,
    sectionHeading: chunkContext.sectionHeading,
  });

  if (!paragraphValue) {
    return [];
  }

  if (isComparisonGuidanceSection(normalizedSection)) {
    return buildGuidanceClaimSeeds({
      axis: 'comparison_guidance',
      values: [paragraphValue],
      evidenceTextSpan: chunkContent,
      subjectOverride:
        buildGuidanceSectionSubject(chunkContext) ??
        buildScopedValue(
          'section_topic',
          chunkContext.sectionHeading ?? 'RECOMENDACION',
        ),
      claimContext: guidanceContext,
    });
  }

  return buildGuidanceClaimSeeds({
    axis: 'organic_response_pattern',
    values: [paragraphValue],
    evidenceTextSpan: chunkContent,
    subjectOverride:
      buildScopedValue(
        'section_topic',
        chunkContext.sectionHeading ?? 'RESPUESTA ORGANICA',
      ) ?? undefined,
    claimContext: guidanceContext,
  });
}

function buildChunkContext(
  input: DocumentExtractionProfileInput,
  config: ProductCatalogProfileConfig,
): ChunkExtractionContext {
  const rawSectionHeading = input.chunk.section?.trim();
  const sectionHeading = sanitizeHeading(rawSectionHeading);
  const parentHeading = sanitizeHeading(input.chunk.parentSection);
  const shouldUseSectionHeading =
    Boolean(rawSectionHeading) &&
    /^\d+(?:\.\d+)*\.?\s+\S+/u.test(rawSectionHeading ?? '');
  const rootHeading = sanitizeHeading(
    shouldUseSectionHeading ? rawSectionHeading : input.chunk.parentSection ?? input.chunk.section,
  );

  if (!rootHeading) {
    return {
      sectionHeading,
      appliesTo: [],
    };
  }

  const scopedHeading = splitScopedHeading(rootHeading);
  const sectionScope = resolveSectionScope({
    rootHeading,
    sectionHeading,
    config,
  });

  return {
    rootHeading,
    sectionHeading,
    subject: buildScopedValue('section_topic', scopedHeading.subject),
    appliesTo: dedupeScopedValues([
      ...(scopedHeading.scopeValue
        ? [buildScopedValue('material', scopedHeading.scopeValue)]
        : []),
      ...(sectionScope ? [sectionScope.scopeValue] : []),
    ]),
    sectionScope,
  };
}

function buildClaimContext(
  layer: DocumentKnowledgeLayer,
  chunkContext: ChunkExtractionContext,
  appliesTo: DocumentKnowledgeScopedValue[] = chunkContext.appliesTo,
): ProfileClaimContext {
  return {
    layer,
    subject: chunkContext.subject,
    appliesTo,
  };
}

function buildGuidanceClaimContext(
  chunkContext: ChunkExtractionContext,
): ProfileClaimContext {
  return buildClaimContext('guidance', chunkContext);
}

function extractSectionScopeSeeds(chunkContext: ChunkExtractionContext) {
  if (!chunkContext.sectionScope) {
    return [];
  }

  return buildRelationalClaimWithEntities({
    axis: chunkContext.sectionScope.axis,
    claimKind: 'relational_fact',
    claimValues: [chunkContext.sectionScope.scopeValue.value],
    entityLabel: chunkContext.sectionScope.entityLabel,
    entities: [chunkContext.sectionScope.scopeValue.value],
    supportClass: 'explicit_fact',
    evidenceTextSpan: chunkContext.sectionHeading ?? chunkContext.sectionScope.scopeValue.value,
    metadata: buildProfileMetadata({
      scope: chunkContext.sectionScope.extractionScope,
    }),
    claimContext: {
      layer: 'factual',
      subject: chunkContext.subject,
      appliesTo: [],
    },
  });
}

function classifyConditionalGuidanceAxis(input: {
  normalizedSection: string;
  processFlowValues: string[];
}) {
  if (!input.normalizedSection.startsWith('si ') || input.processFlowValues.length === 0) {
    return null;
  }

  if (input.normalizedSection.includes('informativ')) {
    return 'informative_flow' as const;
  }

  if (
    input.normalizedSection.includes('presupuesto') ||
    input.normalizedSection.includes('cotizacion') ||
    input.processFlowValues.some((value) =>
      /\b(medid|cantidad|variante|configur|presupuesto|cotizacion)\b/iu.test(
        normalizeDocumentKnowledgeText(value),
      ),
    )
  ) {
    return 'quote_transition' as const;
  }

  if (
    input.normalizedSection.includes('confirm') ||
    input.processFlowValues.some((value) =>
      /\b(confirm|disponibilidad|detalle|tecnic|compatibilidad|plazo|costo|garantia)\b/iu.test(
        normalizeDocumentKnowledgeText(value),
      ),
    )
  ) {
    return 'confirmation_policy' as const;
  }

  return null;
}

function looksLikeGuidanceResponseSection(
  normalizedRoot: string,
  normalizedSection: string,
) {
  if (!normalizedSection) {
    return false;
  }

  if (
    normalizedRoot.includes('respuesta') ||
    normalizedRoot.includes('consulta')
  ) {
    return true;
  }

  return isComparisonGuidanceSection(normalizedSection);
}

function isComparisonGuidanceSection(normalizedSection: string) {
  return (
    normalizedSection.includes('recomendacion') ||
    normalizedSection.includes('compar')
  );
}

function extractChunkBulletValues(content: string) {
  return dedupeDocumentKnowledgeValues(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^\s*[-•]\s+/u.test(line))
      .map((line) => stripBulletLead(line))
      .map((value) => value.replace(/[.;]+$/u, '').trim())
      .filter((value) => value.length > 0),
  );
}

function normalizeGuidanceParagraphContent(input: {
  content: string;
  sectionHeading?: string;
}) {
  const lines = input.content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return '';
  }

  const paragraph = lines.join(' ').replace(/\s+/gu, ' ').trim();
  const sectionHeading = input.sectionHeading?.trim();

  if (!sectionHeading) {
    return paragraph;
  }

  const escapedHeading = escapeGuidanceRegExp(sectionHeading);
  return paragraph.replace(new RegExp(`^${escapedHeading}:?\\s*`, 'iu'), '').trim();
}

function buildGuidanceSectionSubject(
  chunkContext: ChunkExtractionContext,
) {
  const sectionHeading = chunkContext.sectionHeading?.trim();

  if (!sectionHeading) {
    return undefined;
  }

  const queryMatch = sectionHeading.match(/^Si\s+la\s+consulta\s+es\s+por\s+(.+)$/iu);

  if (queryMatch?.[1]) {
    return buildScopedValue('section_topic', queryMatch[1]);
  }

  const comparisonMatch = sectionHeading.match(
    /^Recomendaci[oó]n\s+entre\s+(.+)$/iu,
  );

  if (comparisonMatch?.[1]) {
    return buildScopedValue('section_topic', comparisonMatch[1]);
  }

  return buildScopedValue('section_topic', sectionHeading);
}

function buildRelationalClaimWithEntities(input: {
  axis: string;
  claimKind: DocumentKnowledgeClaimPayload['kind'];
  claimValues: string[];
  entityLabel: string;
  entities: string[];
  supportClass: 'explicit_fact' | 'partial_fact' | 'bounded_inference';
  evidenceTextSpan: string;
  metadata: DocumentKnowledgeItemMetadata;
  claimContext: ProfileClaimContext;
}) {
  const items: DocumentKnowledgeItemSeed[] = [
    buildRelationalClaimSeed({
      axis: input.axis,
      claimKind: input.claimKind,
      claimValues: input.claimValues,
      supportClass: input.supportClass,
      evidenceTextSpan: input.evidenceTextSpan,
      metadata: input.metadata,
      claimContext: input.claimContext,
    }),
  ];

  input.entities.forEach((entity) => {
    items.push(
      buildEntitySeed({
        label: input.entityLabel,
        value: entity,
        supportClass: input.supportClass,
        evidenceTextSpan: input.evidenceTextSpan,
        metadata: input.metadata,
      }),
    );
  });

  return items;
}

function buildGuidanceClaimSeeds(input: {
  axis: string;
  values: string[];
  evidenceTextSpan: string;
  claimContext: ProfileClaimContext;
  subjectOverride?: DocumentKnowledgeScopedValue;
}) {
  const values = dedupeDocumentKnowledgeValues(input.values);

  if (values.length === 0) {
    return [];
  }

  return [
    buildRelationalClaimSeed({
      axis: input.axis,
      claimKind: 'guidance_signal',
      claimValues: values,
      supportClass: 'explicit_fact',
      evidenceTextSpan: input.evidenceTextSpan,
      metadata: buildProfileMetadata({
        scope: 'tenant_only',
      }),
      claimContext: {
        ...input.claimContext,
        subject: input.subjectOverride ?? input.claimContext.subject,
      },
    }),
  ];
}

function buildRelationalClaimSeed(input: {
  axis: string;
  facet?: string;
  claimKind: DocumentKnowledgeClaimPayload['kind'];
  claimValues: string[];
  supportClass: 'explicit_fact' | 'partial_fact' | 'bounded_inference';
  evidenceTextSpan: string;
  metadata: DocumentKnowledgeItemMetadata;
  claimContext: ProfileClaimContext;
}) {
  const values = input.claimValues.map((value) => value.trim()).filter(Boolean);

  return {
    kind: 'claim',
    label: input.axis,
    valueText: buildClaimValueText(values),
    normalizedValue: normalizeDocumentKnowledgeText(values.join(' ')),
    supportClass: input.supportClass,
    evidenceTextSpan: input.evidenceTextSpan,
    metadata:
      cleanDocumentKnowledgeRecord({
        ...input.metadata,
        claim: {
          axis: input.axis,
          facet: input.facet,
          kind: input.claimKind,
          layer: input.claimContext.layer,
          values,
          subject: input.claimContext.subject,
          appliesTo:
            input.claimContext.appliesTo && input.claimContext.appliesTo.length > 0
              ? input.claimContext.appliesTo
              : undefined,
        } satisfies DocumentKnowledgeClaimPayload,
      }) ?? undefined,
  } satisfies DocumentKnowledgeItemSeed;
}

function buildEntitySeed(input: {
  label: string;
  value: string;
  supportClass: 'explicit_fact' | 'partial_fact' | 'bounded_inference';
  evidenceTextSpan: string;
  metadata: DocumentKnowledgeItemMetadata;
}) {
  return {
    kind: 'entity',
    label: input.label,
    valueText: input.value,
    normalizedValue: normalizeDocumentKnowledgeText(input.value),
    supportClass: input.supportClass,
    evidenceTextSpan: input.evidenceTextSpan,
    metadata: input.metadata,
  } satisfies DocumentKnowledgeItemSeed;
}

function buildProfileMetadata(input: {
  scope: DocumentKnowledgeExtractionScope;
  unspecifiedAxes?: string[];
}) {
  return cleanDocumentKnowledgeRecord({
    extractionScope: input.scope,
    profileKey: 'product_catalog' as const,
    unspecifiedAxes: input.unspecifiedAxes,
  }) as DocumentKnowledgeItemMetadata;
}

function captureListSection(value: string, headingTerms: readonly string[]) {
  return captureDocumentKnowledgeLabeledValue(value, headingTerms);
}

function resolveSectionListEntry(
  sentence: string,
  sectionHeading: string | undefined,
  config: {
    headingTerms: readonly string[];
  },
) {
  return resolveDocumentKnowledgeSectionListEntry({
    sentence,
    sectionHeading,
    headingTerms: config.headingTerms,
  });
}

function matchesHeadingTerms(
  normalizedHeading: string,
  headingTerms: readonly string[],
) {
  return matchesDocumentKnowledgeHeadingTerms(normalizedHeading, headingTerms);
}

function sectionMatchesHeading(
  sectionHeading: string | undefined,
  headingTerms: readonly string[],
) {
  return sectionMatchesDocumentKnowledgeHeading(sectionHeading, headingTerms);
}

function matchesPrudenceSignal(
  normalizedSentence: string,
  config: {
    axisTerms: string[];
    cautionTerms: string[];
    headingMatches?: boolean;
  },
) {
  if (
    (config.axisTerms.length === 0 && !config.headingMatches) ||
    config.cautionTerms.length === 0
  ) {
    return false;
  }

  const hasAxisTerm = (config.headingMatches ?? false) || config.axisTerms.some((term) =>
    normalizedSentence.includes(term),
  );
  const cautionHits = config.cautionTerms.filter((term) =>
    normalizedSentence.includes(term),
  );

  return hasAxisTerm && cautionHits.length >= 2;
}

function stripBulletLead(value: string) {
  return stripDocumentKnowledgeBulletLead(value);
}

function isStructuredListEntry(value: string) {
  return isStructuredDocumentKnowledgeListEntry(value);
}

function splitListValues(value: string, config: ProductCatalogProfileConfig) {
  return splitStructuredDocumentKnowledgeValues(value, buildValueSplitOptions(config));
}

function dedupeValues(values: string[]) {
  return dedupeDocumentKnowledgeValues(values);
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

function sanitizeHeading(value?: string) {
  return normalizeDocumentKnowledgeHeading(value);
}

function splitScopedHeading(value: string) {
  const match = value.match(/^(.*?)(?:\s+(?:en|con)\s+)([^,.;]+)$/iu);

  if (!match?.[1] || !match[2]) {
    return {
      subject: value,
      scopeValue: undefined as string | undefined,
    };
  }

  const subject = match[1].trim();
  const scopeValue = match[2].trim();

  if (scopeValue.split(/\s+/u).length > 4) {
    return {
      subject: value,
      scopeValue: undefined as string | undefined,
    };
  }

  return {
    subject,
    scopeValue,
  };
}

function buildScopedValue(axis: string, value: string) {
  return {
    axis,
    value: value.trim(),
    normalizedValue: normalizeDocumentKnowledgeText(value),
  } satisfies DocumentKnowledgeScopedValue;
}

function resolveSectionScope(input: {
  rootHeading?: string;
  sectionHeading?: string;
  config: ProductCatalogProfileConfig;
}): ResolvedSectionScope | undefined {
  const sectionHeading = input.sectionHeading?.trim();
  const rootHeading = input.rootHeading?.trim();

  if (!sectionHeading || !rootHeading || normalizeDocumentKnowledgeText(sectionHeading) === normalizeDocumentKnowledgeText(rootHeading)) {
    return undefined;
  }

  const normalizedSection = normalizeDocumentKnowledgeText(sectionHeading);
  const normalizedRoot = normalizeDocumentKnowledgeText(rootHeading);

  const operationModeMatch = (input.config.operationModes?.normalizedTerms ?? []).find(
    (termFamily) =>
      termFamily.sourceTerms.some(
        (term) => normalizeDocumentKnowledgeText(term) === normalizedSection,
      ),
  );

  if (operationModeMatch) {
    return {
      axis: 'operation_modes',
      entityLabel: 'operation_mode',
      scopeValue: buildScopedValue(
        'operation_mode',
        operationModeMatch.normalizedValue,
      ),
      extractionScope: 'domain_profile',
    };
  }

  if (
    normalizedRoot.includes('enrollar') &&
    ['pvc', 'aluminio'].includes(normalizedSection)
  ) {
    return {
      axis: 'materials',
      entityLabel: 'material',
      scopeValue: buildScopedValue('material', sectionHeading),
      extractionScope: 'tenant_only',
    };
  }

  if (looksLikeCompactProductTypeSection(normalizedRoot, normalizedSection)) {
    return {
      axis: 'product_types',
      entityLabel: 'product_type',
      scopeValue: buildScopedValue('product_type', sectionHeading),
      extractionScope: 'tenant_only',
    };
  }

  return undefined;
}

function looksLikeCompactProductTypeSection(
  normalizedRoot: string,
  normalizedSection: string,
) {
  if (!normalizedSection || normalizedSection.split(/\s+/u).length > 4) {
    return false;
  }

  if (
    normalizedRoot.includes('roller') &&
    ['screen', 'blackout', 'doble'].some((term) =>
      normalizedSection.includes(term),
    )
  ) {
    return true;
  }

  if (
    normalizedRoot.includes('abertur') &&
    (normalizedSection.startsWith('serie ') ||
      ['probba', 'gala', 'summa', 'dvh'].includes(normalizedSection))
  ) {
    return true;
  }

  return false;
}

function dedupeScopedValues(values: DocumentKnowledgeScopedValue[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = `${value.axis}:${value.normalizedValue ?? normalizeDocumentKnowledgeText(value.value)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function extractPropositionSeeds(
  items: DocumentKnowledgeItemSeed[],
): DocumentKnowledgePropositionSeed[] {
  const propositions: DocumentKnowledgePropositionSeed[] = [];

  for (const item of items) {
    if (item.kind !== 'claim' || !item.metadata?.claim) {
      continue;
    }

    const claim = item.metadata.claim;

    if ((claim.layer ?? 'factual') !== 'factual') {
      continue;
    }

    const subject = claim.subject;
    const relationScope = mapClaimScopesToPropositionScope(
      claim.appliesTo ?? [],
    );
    const polarity = resolveClaimPolarity({
      axis: claim.axis,
      appliesTo: claim.appliesTo ?? [],
      supportClass: item.supportClass,
    });
    const confidence = resolvePropositionConfidence(item.supportClass);

    for (const value of claim.values) {
      const trimmedValue = value.trim();

      if (!trimmedValue) {
        continue;
      }

      const canonicalKey = buildKnowledgePropositionCanonicalKey({
        predicate: claim.axis,
        facet: claim.facet,
        objectValue: trimmedValue,
        objectNormalizedValue: normalizeDocumentKnowledgeText(trimmedValue),
        polarity,
        subject,
        relationScope,
      });
      const patternKey = buildKnowledgePropositionPatternKey({
        predicate: claim.axis,
        facet: claim.facet,
        polarity,
        subject,
        relationScope,
      });

      propositions.push({
        label: claim.axis,
        normalizedValue: normalizeDocumentKnowledgeText(trimmedValue),
        supportClass: item.supportClass,
        evidenceTextSpan: item.evidenceTextSpan,
        metadata: item.metadata,
        proposition: {
          predicate: claim.axis,
          facet: claim.facet,
          objectValue: trimmedValue,
          objectNormalizedValue: normalizeDocumentKnowledgeText(trimmedValue),
          polarity,
          relationScope,
          confidence,
          canonicalKey,
          patternKey,
          evidenceTier: 'normalized_proposition',
          promotionState: 'unclassified' satisfies DocumentKnowledgePromotionState,
        },
      });
    }
  }

  return propositions;
}

function extractIndependentPropositionSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
): DocumentKnowledgePropositionSeed[] {
  return [
    ...extractFeatureSupportPropositionSeeds(sentence, chunkContext, config),
    ...extractPaymentTermPropositionSeeds(sentence, chunkContext, config),
    ...extractCoveragePropositionSeeds(sentence, chunkContext, config),
    ...extractServiceOfferPropositionSeeds(sentence, chunkContext, config),
  ];
}

function extractFeatureSupportPropositionSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const statement = resolveFeatureSupportStatement(sentence, config);

  if (!statement || statement.features.length === 0) {
    return [];
  }

  const supportStateScope = buildScopedValue('support_state', statement.state);
  const propositionContext = buildClaimContext('factual', chunkContext, [
    ...chunkContext.appliesTo,
    supportStateScope,
  ]);

  return statement.features.map((feature) =>
    buildDirectPropositionSeed({
      predicate: 'feature_support',
      objectValue: feature,
      polarity:
        statement.state === 'does_not_support'
          ? 'negated'
          : statement.state === 'related_to'
            ? 'comparative'
            : 'affirmed',
      supportClass: 'explicit_fact',
      evidenceTextSpan: sentence,
      metadata: buildPropositionMetadata({
        scope: 'tenant_only',
        claimContext: propositionContext,
      }),
      relationScope: buildPropositionRelationScope(
        propositionContext.appliesTo ?? [],
      ),
      subject: propositionContext.subject,
    }),
  );
}

function extractPaymentTermPropositionSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const strippedSentence = stripBulletLead(sentence);
  const paymentMethod = resolvePaymentMethodScope(
    strippedSentence,
    chunkContext,
    config,
  );
  const count = extractInstallmentCount(strippedSentence, config);
  const cardBrands = extractPaymentCardBrands(strippedSentence, config);

  if (!paymentMethod || (!count && cardBrands.length === 0)) {
    return [];
  }

  const claimContext = buildClaimContext('factual', chunkContext, [
    ...chunkContext.appliesTo,
    buildScopedValue('payment_method', paymentMethod),
  ]);
  const relationScope = buildPropositionRelationScope(
    claimContext.appliesTo ?? [],
  );
  const metadata = buildPropositionMetadata({
    scope: 'tenant_only',
    claimContext,
  });
  const propositions: DocumentKnowledgePropositionSeed[] = [];

  if (count) {
    propositions.push(
      buildDirectPropositionSeed({
        predicate: 'payment_terms',
        facet: 'installment_count',
        objectValue: count,
        polarity: 'affirmed',
        supportClass: 'explicit_fact',
        evidenceTextSpan: sentence,
        metadata,
        relationScope,
        subject: claimContext.subject,
      }),
    );
  }

  for (const brand of cardBrands) {
    propositions.push(
      buildDirectPropositionSeed({
        predicate: 'payment_terms',
        facet: 'card_brands',
        objectValue: brand,
        polarity: 'affirmed',
        supportClass: 'explicit_fact',
        evidenceTextSpan: sentence,
        metadata,
        relationScope,
        subject: claimContext.subject,
      }),
    );
  }

  return propositions;
}

function extractCoveragePropositionSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const propositions: DocumentKnowledgePropositionSeed[] = [];
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);
  const visitCostLocation =
    hasNormalizedPhrase(normalizedSentence, config.coverage?.visitTerms ?? []) &&
    hasNormalizedPhrase(normalizedSentence, config.coverage?.freeCostTerms ?? [])
      ? captureScopedLocation(sentence, {
          leadTerms: config.coverage?.insideLocationLeadTerms ?? [],
          stopTerms: config.coverage?.locationStopTerms ?? [],
        })
      : null;

  if (visitCostLocation) {
    const claimContext = buildClaimContext('factual', chunkContext, [
      ...chunkContext.appliesTo,
      buildScopedValue('location', visitCostLocation),
      buildScopedValue('location_relation', 'inside'),
    ]);

    propositions.push(
      buildDirectPropositionSeed({
        predicate: 'commercial_visit_cost',
        objectValue: 'sin costo',
        polarity: 'affirmed',
        supportClass: 'explicit_fact',
        evidenceTextSpan: sentence,
        metadata: buildPropositionMetadata({
          scope: 'tenant_only',
          claimContext,
        }),
        relationScope: buildPropositionRelationScope(
          claimContext.appliesTo ?? [],
        ),
        subject: claimContext.subject,
      }),
    );
  }

  const outsideLocation =
    hasNormalizedPhrase(
      normalizedSentence,
      config.coverage?.travelCostTerms ?? [],
    )
      ? captureScopedLocation(sentence, {
          leadTerms: config.coverage?.outsideLocationLeadTerms ?? [],
          stopTerms: config.coverage?.locationStopTerms ?? [],
        })
      : null;

  if (outsideLocation) {
    const claimContext = buildClaimContext('factual', chunkContext, [
      ...chunkContext.appliesTo,
      buildScopedValue('location', outsideLocation),
      buildScopedValue('location_relation', 'outside'),
    ]);

    propositions.push(
      buildDirectPropositionSeed({
        predicate: 'travel_cost_responsibility',
        objectValue: 'puede corresponder costo de traslado',
        polarity: 'conditional',
        supportClass: 'partial_fact',
        evidenceTextSpan: sentence,
        metadata: buildPropositionMetadata({
          scope: 'tenant_only',
          claimContext,
        }),
        relationScope: buildPropositionRelationScope(
          claimContext.appliesTo ?? [],
        ),
        subject: claimContext.subject,
      }),
    );
  }

  return propositions;
}

function extractServiceOfferPropositionSeeds(
  sentence: string,
  chunkContext: ChunkExtractionContext,
  config: ProductCatalogProfileConfig,
) {
  const normalizedSentence = normalizeDocumentKnowledgeText(sentence);
  const serviceValues = new Set<string>();
  const combinedMatch = sentence.match(/(?:combina|incluye)\s+([^.]+)/iu);

  if (combinedMatch?.[1]) {
    splitListValues(combinedMatch[1], config).forEach((value) =>
      serviceValues.add(value),
    );
  }

  if (
    hasNormalizedPhrase(
      normalizedSentence,
      config.serviceOffers?.affirmativeLeadPhrases ?? [],
    )
  ) {
    resolveMatchedServiceOfferValues(sentence, config).forEach((value) =>
      serviceValues.add(value),
    );
  }

  const claimContext = buildClaimContext('factual', chunkContext);
  const metadata = buildPropositionMetadata({
    scope: 'tenant_only',
    claimContext,
  });
  const relationScope = buildPropositionRelationScope(
    claimContext.appliesTo ?? [],
  );

  return Array.from(serviceValues.values()).map((value) =>
    buildDirectPropositionSeed({
      predicate: 'service_offers',
      objectValue: value,
      polarity: 'affirmed',
      supportClass: 'explicit_fact',
      evidenceTextSpan: sentence,
      metadata,
      relationScope,
      subject: claimContext.subject,
    }),
  );
}

function mapClaimScopesToPropositionScope(
  appliesTo: DocumentKnowledgeScopedValue[],
): DocumentKnowledgePropositionScope[] {
  if (appliesTo.length === 0) {
    return [];
  }

  const supportState = appliesTo.find((scope) => scope.axis === 'support_state');
  const locationRelation = appliesTo.find(
    (scope) => scope.axis === 'location_relation',
  );
  const scopes = appliesTo.filter(
    (scope) => scope.axis !== 'support_state' && scope.axis !== 'location_relation',
  );

  return dedupePropositionScopes(
    scopes.map((scope) => ({
      axis: scope.axis,
      value: scope.value,
      normalizedValue: scope.normalizedValue,
      relation:
        scope.axis === 'location' && locationRelation
          ? locationRelation.normalizedValue ?? locationRelation.value
          : scope.axis === 'support_state' && supportState
            ? supportState.normalizedValue ?? supportState.value
            : undefined,
    })),
  );
}

function buildPropositionRelationScope(
  appliesTo: DocumentKnowledgeScopedValue[],
): DocumentKnowledgePropositionScope[] {
  return mapClaimScopesToPropositionScope(appliesTo);
}

function buildDirectPropositionSeed(input: {
  predicate: string;
  facet?: string;
  objectValue: string;
  polarity: DocumentKnowledgePolarity;
  supportClass: DocumentKnowledgeItemSeed['supportClass'];
  evidenceTextSpan: string;
  metadata: DocumentKnowledgeItemMetadata;
  relationScope: DocumentKnowledgePropositionScope[];
  subject?: DocumentKnowledgeScopedValue;
}) {
  const normalizedValue = normalizeDocumentKnowledgeText(input.objectValue);

  return {
    label: input.predicate,
    normalizedValue,
    supportClass: input.supportClass,
    evidenceTextSpan: input.evidenceTextSpan,
    metadata: input.metadata,
    proposition: {
      predicate: input.predicate,
      facet: input.facet,
      objectValue: input.objectValue,
      objectNormalizedValue: normalizedValue,
      polarity: input.polarity,
      relationScope: input.relationScope,
      confidence: resolvePropositionConfidence(input.supportClass),
      canonicalKey: buildKnowledgePropositionCanonicalKey({
        predicate: input.predicate,
        facet: input.facet,
        objectValue: input.objectValue,
        objectNormalizedValue: normalizedValue,
        polarity: input.polarity,
        subject: input.subject,
        relationScope: input.relationScope,
      }),
      patternKey: buildKnowledgePropositionPatternKey({
        predicate: input.predicate,
        facet: input.facet,
        polarity: input.polarity,
        subject: input.subject,
        relationScope: input.relationScope,
      }),
      evidenceTier: 'normalized_proposition',
      promotionState: 'unclassified',
    },
  } satisfies DocumentKnowledgePropositionSeed;
}

function buildPropositionMetadata(input: {
  scope: DocumentKnowledgeExtractionScope;
  claimContext: ProfileClaimContext;
}) {
  return cleanDocumentKnowledgeRecord({
    ...buildProfileMetadata({
      scope: input.scope,
    }),
    claim: {
      axis: 'proposition_context',
      kind: 'relational_fact',
      layer: input.claimContext.layer,
      values: [],
      subject: input.claimContext.subject,
      appliesTo:
        input.claimContext.appliesTo && input.claimContext.appliesTo.length > 0
          ? input.claimContext.appliesTo
          : undefined,
    },
  }) as DocumentKnowledgeItemMetadata;
}

function resolveClaimPolarity(input: {
  axis: string;
  appliesTo: DocumentKnowledgeScopedValue[];
  supportClass: DocumentKnowledgeItemSeed['supportClass'];
}): DocumentKnowledgePolarity {
  const supportState = input.appliesTo.find((scope) => scope.axis === 'support_state');
  const normalizedSupportState = normalizeDocumentKnowledgeText(
    supportState?.normalizedValue ?? supportState?.value ?? '',
  );

  if (input.axis === 'feature_support') {
    if (
      normalizedSupportState === 'does_not_support' ||
      normalizedSupportState === 'does not support'
    ) {
      return 'negated';
    }

    if (
      normalizedSupportState === 'related_to' ||
      normalizedSupportState === 'related to'
    ) {
      return 'comparative';
    }

    if (normalizedSupportState === 'supports') {
      return 'affirmed';
    }
  }

  if (input.supportClass === 'partial_fact') {
    return 'conditional';
  }

  if (input.supportClass === 'bounded_inference') {
    return 'unknown';
  }

  return 'affirmed';
}

function resolvePropositionConfidence(
  supportClass: DocumentKnowledgeItemSeed['supportClass'],
) {
  if (supportClass === 'partial_fact') {
    return 0.68;
  }

  if (supportClass === 'bounded_inference') {
    return 0.56;
  }

  return 0.92;
}

function dedupePropositionScopes(values: DocumentKnowledgePropositionScope[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = [
      value.axis,
      value.relation ?? '',
      value.normalizedValue ?? normalizeDocumentKnowledgeText(value.value),
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function escapeGuidanceRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function dedupeStructuredItemSeeds(items: DocumentKnowledgeItemSeed[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const claim = item.metadata?.claim;
    const key = [
      item.kind,
      item.label,
      item.metadata?.claim?.layer ?? '',
      item.normalizedValue ?? normalizeDocumentKnowledgeText(item.valueText),
      item.supportClass,
      claim?.subject?.normalizedValue ?? '',
      (claim?.appliesTo ?? [])
        .map((scope) => `${scope.axis}:${scope.normalizedValue ?? normalizeDocumentKnowledgeText(scope.value)}`)
        .join('|'),
      item.metadata?.profileKey ?? '',
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeStructuredPropositionSeeds(
  propositions: DocumentKnowledgePropositionSeed[],
) {
  const seen = new Set<string>();

  return propositions.filter((proposition) => {
    const key = [
      proposition.label,
      proposition.proposition.canonicalKey,
      proposition.metadata?.profileKey ?? '',
      proposition.metadata?.section ?? '',
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildValueSplitOptions(config: ProductCatalogProfileConfig) {
  return {
    conjunctionTerms: config.matchingHints.conjunctionTerms,
    oversizedTailPattern: config.matchingHints.oversizedClaimTailPattern,
    maxValues: 8,
  };
}

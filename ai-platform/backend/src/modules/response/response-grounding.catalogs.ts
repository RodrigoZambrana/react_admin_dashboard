import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ResponseGroundingDetailType } from './response.types';

type DetailCatalogEntry = {
  requestTerms: string[];
  weakRequestTerms?: string[];
  weakMatchThreshold?: number;
  contextualRequestTerms?: string[];
  contextualFrameTerms?: string[];
  generalEvidenceTerms?: string[];
  supportedAxes?: string[];
  unspecifiedAxes?: string[];
  requiresProductContext?: boolean;
  preferFamilyChoiceWhenContextLimited?: boolean;
  unspecifiedLabel: string;
};

type DetailCatalog = Record<ResponseGroundingDetailType, DetailCatalogEntry>;

type GroundingQuestionSignals = {
  broadOverviewIntentTerms: string[];
  availabilityIntentTerms: string[];
  detailCueTerms: string[];
};

type ProductContextSignals = {
  promptTerms: string[];
};

type CoverageScopeSignals = {
  insideLocationTerms: string[];
  outsideLocationTerms: string[];
};

type SubjectEquivalenceSignals = {
  groups: string[][];
};

type SubjectAlignmentSignals = {
  stopTerms: string[];
};

type GroundingPolicyTemplates = {
  visitCostOutsideLocation: string;
  visitCostInsideNoCost: string;
  visitCostInsideHasCost: string;
  mixedFamilyPartition: string;
  contextLimitedDetailGeneric: string;
  contextLimitedDetailFamilyChoice: string;
  colorSingleScoped: string;
  colorMultipleScoped: string;
  colorSingleGeneric: string;
  colorMultipleGeneric: string;
  paymentMethods: string;
  paymentMercadoPagoInstallmentsAndCards: string;
  paymentMercadoPagoInstallments: string;
  paymentMercadoPagoCards: string;
  purchaseChannelHasStore: string;
  purchaseChannelNoStore: string;
  purchaseChannelOnlineAttention: string;
  purchaseChannelVisitWithLocation: string;
  purchaseChannelVisitGeneric: string;
  serviceCapabilityClauseVisitAndMeasurements: string;
  serviceCapabilityClauseVisitOnly: string;
  serviceCapabilityClauseMeasurementsOnly: string;
  serviceCapabilityClauseInstallation: string;
  serviceCapabilityClauseAutomationAndMotorization: string;
  serviceCapabilityClauseAutomation: string;
  serviceCapabilityClauseMotorization: string;
  serviceCapabilityClauseRepairAndMaintenance: string;
  serviceCapabilityClauseRepair: string;
  serviceCapabilityClauseMaintenance: string;
  serviceCapabilityYesSingle: string;
  serviceCapabilityYesMultiple: string;
  mixedServiceRecommendationClarificationGeneric: string;
  mixedServiceRecommendationClarificationFamilyChoice: string;
  broadOverviewProductTypes: string;
  broadOverviewMaterialsAndModes: string;
  broadOverviewMaterials: string;
  broadOverviewModes: string;
  availabilityMaterials: string;
  availabilityProductTypes: string;
  availabilitySubject: string;
  scopedUnavailableDetail: string;
  confirmationPolicyWithSubject: string;
  confirmationPolicyGeneric: string;
  quoteRequirementsFields: string;
  quoteRequirementsTransition: string;
  recommendationSuitability: string;
  recommendationMaterialsOrientation: string;
  warrantySingleSharedTwoMaterials: string;
  warrantySingleSharedManyMaterials: string;
  warrantyScoped: string;
  warrantySingleGeneric: string;
  warrantyMultipleGeneric: string;
  outOfDomainConcreteSubject: string;
};

type RawGroundingLocaleCatalog = {
  locale: string;
  detailTypes: DetailCatalog;
  unspecifiedCues: string[];
  exactnessCues: string[];
  closeTurnReopenCues: string[];
  questionSignals: GroundingQuestionSignals;
  productContextSignals?: ProductContextSignals;
  coverageScopeSignals?: CoverageScopeSignals;
  subjectEquivalenceSignals?: SubjectEquivalenceSignals;
  subjectAlignmentSignals?: SubjectAlignmentSignals;
  policyTemplates: GroundingPolicyTemplates;
  unspecifiedDetailPrefix: string;
  extractionUncertainDetailPrefix: string;
  labelJoiner: string;
  guardrail: {
    minimumTokenLength: number;
    minimumSentenceTokenCount: number;
    minimumOverlapCount: number;
    maximumNovelRatio: number;
  };
};

type GroundingLocaleCatalog = {
  locale: string;
  detailTypes: DetailCatalog;
  unspecifiedCues: string[];
  exactnessCues: string[];
  closeTurnReopenCues: string[];
  questionSignals: GroundingQuestionSignals;
  productContextSignals: ProductContextSignals;
  coverageScopeSignals: CoverageScopeSignals;
  subjectEquivalenceSignals: SubjectEquivalenceSignals;
  subjectAlignmentSignals: SubjectAlignmentSignals;
  policyTemplates: GroundingPolicyTemplates;
  unspecifiedDetailPrefix: string;
  extractionUncertainDetailPrefix: string;
  labelJoiner: string;
  guardrail: {
    minimumTokenLength: number;
    minimumSentenceTokenCount: number;
    minimumOverlapCount: number;
    maximumNovelRatio: number;
  };
};

type ResponseGroundingLocaleFamily = 'default' | 'en' | 'es';

export type GroundingDetailMatchAssessment = {
  detailType: ResponseGroundingDetailType;
  userStrongMatch: boolean;
  userContextualMatch: boolean;
  userWeakMatch: boolean;
  queryStrongMatch: boolean;
  queryContextualMatch: boolean;
  queryWeakMatch: boolean;
  score: number;
  strongScore: number;
};

const defaultGuardrailConfig = {
  minimumTokenLength: 4,
  minimumSentenceTokenCount: 4,
  minimumOverlapCount: 2,
  maximumNovelRatio: 0.7,
};

const localeCatalogCache = new Map<ResponseGroundingLocaleFamily, GroundingLocaleCatalog>();

export const responseGroundingDetailTypes: ResponseGroundingDetailType[] = [
  'coverage_support',
  'pricing',
  'payment_terms',
  'purchase_channel',
  'service_capability',
  'quote_requirements',
  'recommendation',
  'availability',
  'warranty',
  'materials',
  'color_options',
  'specific_variants',
  'feature_support',
];

export function resolveResponseGroundingLocaleFamily(locale?: string | null) {
  const family = String(locale ?? '')
    .toLowerCase()
    .split(/[-_]/u)[0]
    .trim();

  if (family === 'es' || family === 'en') {
    return family;
  }

  return 'default';
}

export function resolveResponseGroundingCatalog(locale?: string | null) {
  const family = resolveResponseGroundingLocaleFamily(locale);
  const cached = localeCatalogCache.get(family);

  if (cached) {
    return cached;
  }

  const catalog = compileGroundingCatalog(loadGroundingCatalogResource(family));
  localeCatalogCache.set(family, catalog);
  return catalog;
}

export function resolveGroundingDetailSupportedAxes(
  locale: string | null | undefined,
  detailType: ResponseGroundingDetailType,
) {
  return [
    ...(resolveResponseGroundingCatalog(locale).detailTypes[detailType]
      ?.supportedAxes ?? []),
  ];
}

export function isUserBackedGroundingDetailAssessment(
  assessment: Pick<
    GroundingDetailMatchAssessment,
    'userStrongMatch' | 'userContextualMatch' | 'userWeakMatch'
  >,
) {
  return (
    assessment.userStrongMatch ||
    assessment.userContextualMatch ||
    assessment.userWeakMatch
  );
}

export function normalizeGroundingText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function hasGroundingCatalogSignal(
  normalizedText: string,
  terms: readonly string[],
) {
  return terms.some((term) => {
    if (!term) {
      return false;
    }

    return normalizedText.includes(term);
  });
}

function countGroundingCatalogSignals(
  normalizedText: string,
  terms: readonly string[],
) {
  return Array.from(new Set(terms.filter(Boolean))).filter((term) =>
    normalizedText.includes(term),
  ).length;
}

export function assessRequestedGroundingDetails(input: {
  locale?: string | null;
  userText: string;
  queryText?: string | null;
}) {
  const catalog = resolveResponseGroundingCatalog(input.locale);
  const normalizedUserText = normalizeGroundingText(input.userText);
  const normalizedQueryText = normalizeGroundingText(input.queryText ?? '');

  const scored = responseGroundingDetailTypes
    .map((detailType) => {
      const config = catalog.detailTypes[detailType];
      const userStrongMatch = hasGroundingCatalogSignal(
        normalizedUserText,
        config.requestTerms,
      );
      const userContextualTermCount = countGroundingCatalogSignals(
        normalizedUserText,
        config.contextualRequestTerms ?? [],
      );
      const queryContextualTermCount = countGroundingCatalogSignals(
        normalizedQueryText,
        config.contextualRequestTerms ?? [],
      );
      const hasUserContextualFrame = hasGroundingCatalogSignal(
        normalizedUserText,
        config.contextualFrameTerms ?? [],
      );
      const hasQueryContextualFrame = hasGroundingCatalogSignal(
        normalizedQueryText,
        config.contextualFrameTerms ?? [],
      );
      const userContextualMatch =
        userContextualTermCount > 0 &&
        (hasUserContextualFrame || hasQueryContextualFrame);
      const userWeakMatch = hasGroundingCatalogSignal(
        normalizedUserText,
        config.weakRequestTerms ?? [],
      );
      const userWeakMatchCount = countGroundingCatalogSignals(
        normalizedUserText,
        config.weakRequestTerms ?? [],
      );
      const queryStrongMatch = hasGroundingCatalogSignal(
        normalizedQueryText,
        config.requestTerms,
      );
      const queryContextualMatch =
        queryContextualTermCount > 0 &&
        (hasUserContextualFrame || hasQueryContextualFrame);
      const queryWeakMatch = hasGroundingCatalogSignal(
        normalizedQueryText,
        config.weakRequestTerms ?? [],
      );
      const queryWeakMatchCount = countGroundingCatalogSignals(
        normalizedQueryText,
        config.weakRequestTerms ?? [],
      );
      const weakMatchThreshold = Math.max(1, config.weakMatchThreshold ?? 1);

      return {
        detailType,
        userStrongMatch,
        userContextualMatch,
        userWeakMatch: userWeakMatch && userWeakMatchCount >= weakMatchThreshold,
        userWeakMatchCount,
        queryStrongMatch,
        queryContextualMatch,
        queryWeakMatch: queryWeakMatch && queryWeakMatchCount >= weakMatchThreshold,
        queryWeakMatchCount,
        score:
          (userStrongMatch ? 4 : 0) +
          (userContextualMatch ? Math.min(3, userContextualTermCount * 2) : 0) +
          (queryStrongMatch ? 2 : 0) +
          (queryContextualMatch ? Math.min(2, queryContextualTermCount) : 0) +
          (userWeakMatch && userWeakMatchCount >= weakMatchThreshold
            ? Math.min(2, userWeakMatchCount)
            : 0) +
          (queryWeakMatch && queryWeakMatchCount >= weakMatchThreshold
            ? Math.min(1, queryWeakMatchCount * 0.5)
            : 0),
        strongScore:
          (userStrongMatch ? 2 : 0) +
          (userContextualMatch ? 1 : 0) +
          (queryStrongMatch ? 1 : 0) +
          (queryContextualMatch ? 1 : 0),
      };
    });
  const hasAnyUserMatch = scored.some(
    (entry) => entry.userStrongMatch || entry.userContextualMatch || entry.userWeakMatch,
  );
  const hasUserStrongMatch = scored.some((entry) => entry.userStrongMatch);

  return scored
    .filter((entry) => {
      if (entry.score <= 0) {
        return false;
      }

      if (hasUserStrongMatch) {
        return entry.userStrongMatch || entry.userContextualMatch || entry.userWeakMatch;
      }

      return true;
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      const leftUserBacked =
        left.userStrongMatch || left.userContextualMatch || left.userWeakMatch;
      const rightUserBacked =
        right.userStrongMatch || right.userContextualMatch || right.userWeakMatch;

      if (hasAnyUserMatch && leftUserBacked !== rightUserBacked) {
        return Number(rightUserBacked) - Number(leftUserBacked);
      }

      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.strongScore !== left.strongScore) {
        return right.strongScore - left.strongScore;
      }

      return responseGroundingDetailTypes.indexOf(left.detailType) -
        responseGroundingDetailTypes.indexOf(right.detailType);
    })
    .map((entry) => ({
      detailType: entry.detailType,
      userStrongMatch: entry.userStrongMatch,
      userContextualMatch: entry.userContextualMatch,
      userWeakMatch: entry.userWeakMatch,
      queryStrongMatch: entry.queryStrongMatch,
      queryContextualMatch: entry.queryContextualMatch,
      queryWeakMatch: entry.queryWeakMatch,
      score: entry.score,
      strongScore: entry.strongScore,
    }));
}

export function resolveRequestedGroundingDetailTypes(input: {
  locale?: string | null;
  userText: string;
  queryText?: string | null;
}) {
  return assessRequestedGroundingDetails(input).map((entry) => entry.detailType);
}

export function extractGroundingTokens(
  value: string,
  minimumTokenLength = defaultGuardrailConfig.minimumTokenLength,
) {
  return normalizeGroundingText(value)
    .split(/\s+/u)
    .filter((token) => token.length >= minimumTokenLength && !/^\d+$/u.test(token));
}

export function splitGroundingSentences(value: string) {
  return value
    .split(/[.!?]+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function renderUnspecifiedDetailClause(input: {
  locale?: string | null;
  labels: string[];
}) {
  const catalog = resolveResponseGroundingCatalog(input.locale);

  if (input.labels.length === 0) {
    return null;
  }

  return `${catalog.unspecifiedDetailPrefix} ${joinLabels(
    input.labels,
    catalog.labelJoiner,
  )}.`;
}

export function renderExtractionUncertainDetailClause(input: {
  locale?: string | null;
  labels: string[];
}) {
  const catalog = resolveResponseGroundingCatalog(input.locale);

  if (input.labels.length === 0) {
    return null;
  }

  return `${catalog.extractionUncertainDetailPrefix} ${joinLabels(
    input.labels,
    catalog.labelJoiner,
  )}.`;
}

export function renderGroundingPolicyTemplate(input: {
  locale?: string | null;
  templateKey: keyof GroundingPolicyTemplates;
  values: Record<string, string>;
}) {
  const catalog = resolveResponseGroundingCatalog(input.locale);
  const template = catalog.policyTemplates[input.templateKey];

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu, (_, key: string) => {
    return input.values[key] ?? '';
  });
}

export function summarySeeksProductContext(
  locale: string | null | undefined,
  summary: string,
) {
  const normalizedSummary = normalizeGroundingText(summary);
  const promptTerms =
    resolveResponseGroundingCatalog(locale).productContextSignals.promptTerms;

  return hasGroundingCatalogSignal(normalizedSummary, promptTerms);
}

export function expandGroundingEquivalentTokens(
  locale: string | null | undefined,
  tokens: readonly string[],
) {
  const normalizedTokens = Array.from(
    new Set(
      tokens
        .map((token) => normalizeGroundingText(token))
        .filter((token) => token.length > 0),
    ),
  );

  if (normalizedTokens.length === 0) {
    return [];
  }

  const expanded = new Set<string>(normalizedTokens);

  for (const token of normalizedTokens) {
    if (token.endsWith('es') && token.length > 5) {
      expanded.add(token.slice(0, -2));
    }

    if (token.endsWith('s') && token.length > 3) {
      expanded.add(token.slice(0, -1));
      continue;
    }

    if (token.length > 3) {
      expanded.add(`${token}s`);
    }
  }

  const catalog = resolveResponseGroundingCatalog(locale);
  const expandedTokenSet = new Set(expanded);

  for (const group of catalog.subjectEquivalenceSignals.groups) {
    const groupTokens = Array.from(
      new Set(
        group.flatMap((entry) =>
          extractGroundingTokens(entry, 2).concat(normalizeGroundingText(entry)),
        ),
      ),
    ).filter((entry) => entry.length > 0);

    if (groupTokens.some((token) => expandedTokenSet.has(token))) {
      groupTokens.forEach((token) => expanded.add(token));
    }
  }

  const stopTerms = new Set(
    resolveResponseGroundingCatalog(locale).subjectAlignmentSignals.stopTerms,
  );

  return Array.from(expanded).filter((token) => !stopTerms.has(token));
}

function loadGroundingCatalogResource(
  family: ResponseGroundingLocaleFamily,
): RawGroundingLocaleCatalog {
  const candidatePath = join(
    __dirname,
    '../../resources/response-grounding/locales',
    `${family}.json`,
  );
  const fallbackPath = join(
    __dirname,
    '../../resources/response-grounding/locales',
    'default.json',
  );
  const resolvedPath = existsSync(candidatePath) ? candidatePath : fallbackPath;

  return JSON.parse(readFileSync(resolvedPath, 'utf8')) as RawGroundingLocaleCatalog;
}

function compileGroundingCatalog(
  raw: RawGroundingLocaleCatalog,
): GroundingLocaleCatalog {
  return {
    locale: raw.locale,
    detailTypes: Object.fromEntries(
      Object.entries(raw.detailTypes).map(([detailType, config]) => [
        detailType,
        {
          ...config,
          requestTerms: normalizeTerms(config.requestTerms),
          weakRequestTerms: normalizeTerms(config.weakRequestTerms ?? []),
          contextualRequestTerms: normalizeTerms(config.contextualRequestTerms ?? []),
          contextualFrameTerms: normalizeTerms(config.contextualFrameTerms ?? []),
          generalEvidenceTerms: normalizeTerms(config.generalEvidenceTerms ?? []),
        },
      ]),
    ) as DetailCatalog,
    unspecifiedCues: normalizeTerms(raw.unspecifiedCues),
    exactnessCues: normalizeTerms(raw.exactnessCues),
    closeTurnReopenCues: normalizeTerms(raw.closeTurnReopenCues),
    questionSignals: {
      broadOverviewIntentTerms: normalizeTerms(
        raw.questionSignals?.broadOverviewIntentTerms ?? [],
      ),
      availabilityIntentTerms: normalizeTerms(
        raw.questionSignals?.availabilityIntentTerms ?? [],
      ),
      detailCueTerms: normalizeTerms(raw.questionSignals?.detailCueTerms ?? []),
    },
    productContextSignals: {
      promptTerms: normalizeTerms(raw.productContextSignals?.promptTerms ?? []),
    },
    coverageScopeSignals: {
      insideLocationTerms: normalizeTerms(
        raw.coverageScopeSignals?.insideLocationTerms ?? [],
      ),
      outsideLocationTerms: normalizeTerms(
        raw.coverageScopeSignals?.outsideLocationTerms ?? [],
      ),
    },
    subjectEquivalenceSignals: {
      groups: (raw.subjectEquivalenceSignals?.groups ?? []).map((group) =>
        normalizeTerms(group),
      ),
    },
    subjectAlignmentSignals: {
      stopTerms: normalizeTerms(raw.subjectAlignmentSignals?.stopTerms ?? []),
    },
    policyTemplates: raw.policyTemplates,
    unspecifiedDetailPrefix: raw.unspecifiedDetailPrefix,
    extractionUncertainDetailPrefix: raw.extractionUncertainDetailPrefix,
    labelJoiner: raw.labelJoiner,
    guardrail: {
      minimumTokenLength:
        raw.guardrail?.minimumTokenLength ??
        defaultGuardrailConfig.minimumTokenLength,
      minimumSentenceTokenCount:
        raw.guardrail?.minimumSentenceTokenCount ??
        defaultGuardrailConfig.minimumSentenceTokenCount,
      minimumOverlapCount:
        raw.guardrail?.minimumOverlapCount ??
        defaultGuardrailConfig.minimumOverlapCount,
      maximumNovelRatio:
        raw.guardrail?.maximumNovelRatio ??
        defaultGuardrailConfig.maximumNovelRatio,
    },
  };
}

function normalizeTerms(terms: readonly string[]) {
  return Array.from(
    new Set(
      terms
        .map((term) => normalizeGroundingText(term))
        .filter((term) => term.length > 0),
    ),
  );
}

function joinLabels(values: string[], joinWord: string) {
  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} ${joinWord} ${values[1]}`;
  }

  const last = values.at(-1);
  const leading = values.slice(0, -1).join(', ');

  return `${leading}, ${joinWord} ${last}`;
}

import { Injectable } from '@nestjs/common';

import {
  DocumentKnowledgeAxisSummary,
  DocumentKnowledgeEvidenceTier,
  DocumentKnowledgePropositionSummary,
  DocumentRetrievalResult,
} from '../documents/document.types';
import {
  ApprovedResponseContext,
  ResponseGroundingDetailType,
} from './response.types';
import {
  extractGroundingTokens,
  hasGroundingCatalogSignal,
  normalizeGroundingText,
  renderExtractionUncertainDetailClause,
  renderUnspecifiedDetailClause,
  resolveResponseGroundingCatalog,
  splitGroundingSentences,
} from './response-grounding.catalogs';

type DetailSupportLevel = 'supported' | 'partial' | 'unsupported';
type DetailSupportResolution = {
  supportLevel: DetailSupportLevel;
  evidenceTier: DocumentKnowledgeEvidenceTier;
  hasStructuredGap: boolean;
};
type DocumentGroundingLike = Pick<
  DocumentRetrievalResult,
  'source' | 'query' | 'groundedSummary'
> & {
  matches: Array<{
    documentId?: string;
    title?: string;
    sequence?: number;
    score?: number;
    excerpt?: string;
    supportSummary?: {
      topic?: string;
      supportedAxes: string[];
      unspecifiedAxes: string[];
      axisSummaries?: DocumentKnowledgeAxisSummary[];
      propositionSummaries?: DocumentKnowledgePropositionSummary[];
      evidenceTier?: Exclude<DocumentKnowledgeEvidenceTier, 'none'>;
    };
  }>;
};

@Injectable()
export class ResponseGroundingService {
  assessDocumentContext(input: {
    locale?: string | null;
    userMessage: string;
    documentContext: DocumentGroundingLike;
  }) {
    const catalog = resolveResponseGroundingCatalog(input.locale);
    const questionLike = /[?¿]/u.test(input.userMessage);
    const axisState = collectDocumentAxisState(input.documentContext);
    const userText = normalizeText(input.userMessage);
    const queryText = normalizeText(input.documentContext.query);
    const evidenceText = normalizeText(
      [
        input.documentContext.groundedSummary,
        ...input.documentContext.matches.map((match) => match.excerpt),
      ].join(' '),
    );

    const requestedDetailTypes = this.resolveRequestedDetailTypes({
      catalog,
      userText,
      queryText,
    });
    const exactnessRequested =
      hasGroundingCatalogSignal(userText, catalog.exactnessCues) ||
      (!hasAnyGroundingDetailSignal(userText, catalog) &&
        hasGroundingCatalogSignal(queryText, catalog.exactnessCues));
    const supportByDetailType = Object.fromEntries(
      detailTypes.map((detailType) => [
        detailType,
        this.resolveSupportResolution({
          detailType,
          evidenceText,
          requested: requestedDetailTypes.includes(detailType),
          generalEvidenceTerms:
            catalog.detailTypes[detailType].generalEvidenceTerms ?? [],
          dynamicEvidenceTerms: this.resolveDynamicEvidenceTerms({
            detailType,
            documentContext: input.documentContext,
          }),
          supportedAxes: catalog.detailTypes[detailType].supportedAxes ?? [],
          unspecifiedAxes: catalog.detailTypes[detailType].unspecifiedAxes ?? [],
          availableSupportedAxes: axisState.supportedAxes,
          availableUnspecifiedAxes: axisState.unspecifiedAxes,
          propositionSummaries: axisState.propositionSummaries,
        }),
      ]),
    ) as Record<ResponseGroundingDetailType, DetailSupportResolution>;

    const supportedDetailTypes = requestedDetailTypes.filter(
      (detailType) => supportByDetailType[detailType].supportLevel === 'supported',
    );
    const partialDetailTypes = requestedDetailTypes.filter(
      (detailType) => supportByDetailType[detailType].supportLevel === 'partial',
    );
    const unsupportedDetailTypes = requestedDetailTypes.filter(
      (detailType) => supportByDetailType[detailType].supportLevel === 'unsupported',
    );
    const questionQualifiedPartialDetailTypes = questionLike
      ? partialDetailTypes.filter(
          (detailType) =>
            (catalog.detailTypes[detailType].supportedAxes ?? []).length > 0 ||
            (catalog.detailTypes[detailType].unspecifiedAxes ?? []).length > 0,
        )
      : [];
    const requiredUnspecifiedDetailTypes = Array.from(
      new Set([
        ...(exactnessRequested ? partialDetailTypes : []),
        ...questionQualifiedPartialDetailTypes,
        ...unsupportedDetailTypes,
      ]),
    );
    const hasApprovedEvidence =
      input.documentContext.matches.length > 0 && evidenceText.length > 0;
    const outstandingDetailsExist =
      partialDetailTypes.length > 0 || unsupportedDetailTypes.length > 0;
    const hasStructuredGap = requestedDetailTypes.some(
      (detailType) => supportByDetailType[detailType].hasStructuredGap,
    );
    const evidenceTier = resolveAggregateEvidenceTier(
      requestedDetailTypes.map((detailType) => supportByDetailType[detailType].evidenceTier),
    );
    const absenceReason =
      outstandingDetailsExist || !hasApprovedEvidence
        ? hasStructuredGap
          ? ('document_gap' as const)
          : ('extraction_uncertain' as const)
        : null;

    return {
      supportLevel: !hasApprovedEvidence
        ? ('unavailable' as const)
        : partialDetailTypes.length > 0 || unsupportedDetailTypes.length > 0
          ? ('partial' as const)
          : ('explicit' as const),
      evidenceTier,
      absenceReason,
      exactnessRequested,
      requestedDetailTypes,
      supportedDetailTypes,
      partialDetailTypes,
      unsupportedDetailTypes,
      requiredUnspecifiedDetailTypes,
    };
  }

  extractClaimedDetailTypes(input: {
    locale?: string | null;
    message: string;
    documentContext?: DocumentGroundingLike;
  }) {
    const catalog = resolveResponseGroundingCatalog(input.locale);
    const normalized = normalizeText(input.message);

    return detailTypes.filter((detailType) =>
      hasGroundingCatalogSignal(
        normalized,
        [
          ...catalog.detailTypes[detailType].requestTerms,
          ...(catalog.detailTypes[detailType].generalEvidenceTerms ?? []),
          ...this.resolveDynamicEvidenceTerms({
            detailType,
            documentContext: input.documentContext,
          }),
        ],
      ),
    );
  }

  containsUnspecifiedCue(input: { locale?: string | null; message: string }) {
    const catalog = resolveResponseGroundingCatalog(input.locale);
    const normalized = normalizeText(input.message);

    return hasGroundingCatalogSignal(normalized, catalog.unspecifiedCues);
  }

  extractUnspecifiedDetailTypes(input: {
    locale?: string | null;
    message: string;
    documentContext?: DocumentGroundingLike;
  }) {
    if (!this.containsUnspecifiedCue(input)) {
      return [];
    }

    return this.extractClaimedDetailTypes(input);
  }

  summaryAddressesRequestedDetails(input: {
    locale?: string | null;
    summary: string;
    detailTypes: ResponseGroundingDetailType[];
    documentContext?: DocumentGroundingLike;
  }) {
    if (input.detailTypes.length === 0) {
      return true;
    }

    const catalog = resolveResponseGroundingCatalog(input.locale);
    const normalizedSummary = normalizeText(input.summary);

    return input.detailTypes.some((detailType) =>
      hasGroundingCatalogSignal(normalizedSummary, [
        ...catalog.detailTypes[detailType].requestTerms,
        ...(catalog.detailTypes[detailType].generalEvidenceTerms ?? []),
        ...this.resolveDynamicEvidenceTerms({
          detailType,
          documentContext: input.documentContext,
        }),
      ]),
    );
  }

  containsCloseTurnReopenCue(input: { locale?: string | null; message: string }) {
    const catalog = resolveResponseGroundingCatalog(input.locale);
    const normalized = normalizeText(input.message);

    return hasGroundingCatalogSignal(normalized, catalog.closeTurnReopenCues);
  }

  buildUnspecifiedDetailClause(
    input: Pick<ApprovedResponseContext, 'locale' | 'documentContext'> & {
      summary?: string | null;
    },
  ) {
    if (!input.documentContext) {
      return null;
    }

    const catalog = resolveResponseGroundingCatalog(input.locale);
    const requiredDetailTypes =
      input.documentContext.grounding.requiredUnspecifiedDetailTypes ??
      [
        ...(
          input.documentContext.grounding.exactnessRequested
            ? input.documentContext.grounding.partialDetailTypes
          : []
        ),
        ...input.documentContext.grounding.unsupportedDetailTypes,
      ];
    const outstandingDetailTypes = requiredDetailTypes.filter(
      (detailType) =>
        !this.summaryContainsConcreteDetail({
          locale: input.locale,
          detailType,
          summary: input.summary,
          documentContext: input.documentContext,
        }),
    );
    const labels = [...outstandingDetailTypes].map(
      (detailType) => catalog.detailTypes[detailType].unspecifiedLabel,
    );

    if (labels.length === 0) {
      return null;
    }

    const uniqueLabels = Array.from(new Set(labels));
    const absenceReason = input.documentContext.grounding.absenceReason;

    if (absenceReason === 'extraction_uncertain') {
      return renderExtractionUncertainDetailClause({
        locale: input.locale,
        labels: uniqueLabels,
      });
    }

    if (absenceReason === 'document_gap') {
      return renderUnspecifiedDetailClause({
        locale: input.locale,
        labels: uniqueLabels,
      });
    }

    return null;
  }

  hasDocumentContextOverreach(input: {
    approvedContext: Pick<
      ApprovedResponseContext,
      'locale' | 'userMessage' | 'documentContext'
    >;
    approvedDraft?: string;
    message: string;
  }) {
    const documentContext = input.approvedContext.documentContext;

    if (!documentContext) {
      return false;
    }

    const catalog = resolveResponseGroundingCatalog(input.approvedContext.locale);
    const allowedText = [
      input.approvedContext.userMessage,
      input.approvedDraft ?? '',
      documentContext.groundedSummary,
      ...documentContext.matches.map((match) => match.excerpt ?? ''),
    ].join(' ');
    const allowedTokens = new Set(
      extractGroundingTokens(
        allowedText,
        catalog.guardrail.minimumTokenLength,
      ),
    );
    const messageTokens = extractGroundingTokens(
      input.message,
      catalog.guardrail.minimumTokenLength,
    );

    if (messageTokens.length >= catalog.guardrail.minimumSentenceTokenCount) {
      const overlapCount = messageTokens.filter((token) =>
        allowedTokens.has(token),
      ).length;
      const novelRatio =
        (messageTokens.length - overlapCount) / messageTokens.length;

      if (
        overlapCount >= catalog.guardrail.minimumOverlapCount + 2 &&
        novelRatio <= catalog.guardrail.maximumNovelRatio + 0.1
      ) {
        return false;
      }
    }

    return splitGroundingSentences(input.message).some((sentence) => {
      if (
        this.containsUnspecifiedCue({
          locale: input.approvedContext.locale,
          message: sentence,
        })
      ) {
        return false;
      }

      const sentenceTokens = extractGroundingTokens(
        sentence,
        catalog.guardrail.minimumTokenLength,
      );

      if (sentenceTokens.length < catalog.guardrail.minimumSentenceTokenCount) {
        return false;
      }

      const overlapCount = sentenceTokens.filter((token) =>
        allowedTokens.has(token),
      ).length;
      const novelRatio =
        (sentenceTokens.length - overlapCount) / sentenceTokens.length;

      return (
        overlapCount < catalog.guardrail.minimumOverlapCount &&
        novelRatio >= catalog.guardrail.maximumNovelRatio
      );
    });
  }

  private resolveSupportResolution(input: {
    detailType: ResponseGroundingDetailType;
    evidenceText: string;
    requested: boolean;
    generalEvidenceTerms: string[];
    dynamicEvidenceTerms: string[];
    supportedAxes: string[];
    unspecifiedAxes: string[];
    availableSupportedAxes: Set<string>;
    availableUnspecifiedAxes: Set<string>;
    propositionSummaries: DocumentKnowledgePropositionSummary[];
  }): DetailSupportResolution {
    if (!input.requested) {
      return {
        supportLevel: 'unsupported',
        evidenceTier: 'none',
        hasStructuredGap: false,
      };
    }

    const hasStructuredSupport = input.supportedAxes.some((axis) =>
      input.availableSupportedAxes.has(axis),
    );
    const hasStructuredGap = input.unspecifiedAxes.some((axis) =>
      input.availableUnspecifiedAxes.has(axis),
    );
    const hasPropositionSupport = input.propositionSummaries.some((summary) =>
      propositionMatchesDetailType(summary, input.detailType),
    );

    if (hasStructuredSupport && !hasStructuredGap) {
      return {
        supportLevel: 'supported',
        evidenceTier: 'typed_claim',
        hasStructuredGap,
      };
    }

    if (hasStructuredSupport || hasStructuredGap) {
      return {
        supportLevel: 'partial',
        evidenceTier: 'typed_claim',
        hasStructuredGap,
      };
    }

    if (hasPropositionSupport) {
      return {
        supportLevel: 'partial',
        evidenceTier: 'normalized_proposition',
        hasStructuredGap: false,
      };
    }

    if (
      input.dynamicEvidenceTerms.length > 0 &&
      hasGroundingCatalogSignal(input.evidenceText, input.dynamicEvidenceTerms)
    ) {
      return {
        supportLevel: 'partial',
        evidenceTier: 'excerpt_only',
        hasStructuredGap: false,
      };
    }

    if (
      hasGroundingCatalogSignal(
        input.evidenceText,
        input.generalEvidenceTerms,
      )
    ) {
      return {
        supportLevel: 'partial',
        evidenceTier: 'excerpt_only',
        hasStructuredGap: false,
      };
    }

    return {
      supportLevel: 'unsupported',
      evidenceTier: 'none',
      hasStructuredGap: false,
    };
  }

  private resolveDynamicEvidenceTerms(input: {
    detailType: ResponseGroundingDetailType;
    documentContext?: DocumentGroundingLike;
  }) {
    if (!input.documentContext) {
      return [];
    }

    const axisState = collectDocumentAxisState(input.documentContext);
    const catalog = resolveDetailTypeAxes(input.detailType);
    const values = axisState.axisValues
      .filter((axisSummary) => catalog.supportedAxes.has(axisSummary.axis))
      .flatMap((axisSummary) => axisSummary.values);
    const propositionValues = axisState.propositionSummaries
      .filter((summary) => propositionMatchesDetailType(summary, input.detailType))
      .flatMap((summary) => [summary.objectValue, summary.objectNormalizedValue ?? '']);

    return Array.from(
      new Set(
        [...values, ...propositionValues]
          .map((value) => normalizeText(value))
          .filter((value) => value.length > 0),
      ),
    );
  }

  summaryContainsConcreteDetail(input: {
    locale?: string | null;
    detailType: ResponseGroundingDetailType;
    summary?: string | null;
    documentContext?: DocumentGroundingLike;
  }) {
    const summary = input.summary?.trim();

    if (!summary || !input.documentContext) {
      return false;
    }

    const dynamicEvidenceTerms = this.resolveDynamicEvidenceTerms({
      detailType: input.detailType,
      documentContext: input.documentContext,
    }).filter((value) => value.length >= 3);

    if (dynamicEvidenceTerms.length === 0) {
      return false;
    }

    if (
      !this.summaryAddressesRequestedDetails({
        locale: input.locale,
        summary,
        detailTypes: [input.detailType],
        documentContext: input.documentContext,
      })
    ) {
      return false;
    }

    const normalizedSummary = normalizeText(summary);

    return hasGroundingCatalogSignal(normalizedSummary, dynamicEvidenceTerms);
  }

  private resolveRequestedDetailTypes(input: {
    catalog: ReturnType<typeof resolveResponseGroundingCatalog>;
    userText: string;
    queryText: string;
  }) {
    const requestedFromUser = detailTypes.filter((detailType) =>
      hasGroundingCatalogSignal(
        input.userText,
        input.catalog.detailTypes[detailType].requestTerms,
      ),
    );

    if (requestedFromUser.length > 0) {
      return requestedFromUser;
    }

    return detailTypes.filter((detailType) =>
      hasGroundingCatalogSignal(
        input.queryText,
        input.catalog.detailTypes[detailType].requestTerms,
      ),
    );
  }
}

const detailTypes: ResponseGroundingDetailType[] = [
  'coverage_support',
  'pricing',
  'payment_terms',
  'purchase_channel',
  'availability',
  'warranty',
  'materials',
  'color_options',
  'specific_variants',
  'feature_support',
];

function normalizeText(value: string) {
  return normalizeGroundingText(value);
}

function collectDocumentAxisState(documentContext: DocumentGroundingLike) {
  const supportedAxes = new Set<string>();
  const unspecifiedAxes = new Set<string>();
  const axisValues: Array<{
    axis: string;
    values: string[];
  }> = [];
  const propositionSummaries: DocumentKnowledgePropositionSummary[] = [];

  for (const match of documentContext.matches) {
    for (const axis of match.supportSummary?.supportedAxes ?? []) {
      supportedAxes.add(axis);
    }

    for (const axis of match.supportSummary?.unspecifiedAxes ?? []) {
      unspecifiedAxes.add(axis);
    }

    for (const summary of match.supportSummary?.axisSummaries ?? []) {
      axisValues.push({
        axis: summary.axis,
        values: summary.values,
      });
    }

    propositionSummaries.push(...(match.supportSummary?.propositionSummaries ?? []));
  }

  return {
    supportedAxes,
    unspecifiedAxes,
    axisValues,
    propositionSummaries,
  };
}

function resolveDetailTypeAxes(detailType: ResponseGroundingDetailType) {
  if (detailType === 'payment_terms') {
    return {
      supportedAxes: new Set(['payment_methods', 'payment_terms', 'installment_count']),
      unspecifiedAxes: new Set<string>(),
    };
  }

  if (detailType === 'specific_variants') {
    return {
      supportedAxes: new Set(['specific_variants', 'product_types']),
    };
  }

  return {
    supportedAxes: new Set([detailType]),
  };
}

function hasAnyGroundingDetailSignal(
  normalizedText: string,
  catalog: ReturnType<typeof resolveResponseGroundingCatalog>,
) {
  return detailTypes.some((detailType) =>
    hasGroundingCatalogSignal(
      normalizedText,
      catalog.detailTypes[detailType].requestTerms,
    ),
  );
}

function propositionMatchesDetailType(
  proposition: DocumentKnowledgePropositionSummary,
  detailType: ResponseGroundingDetailType,
) {
  const { supportedAxes } = resolveDetailTypeAxes(detailType);

  if (supportedAxes.has(proposition.predicate)) {
    return true;
  }

  return (
    detailType === 'payment_terms' &&
    proposition.predicate === 'payment_terms' &&
    (proposition.facet === 'installment_count' || proposition.facet === 'card_brands')
  );
}

function resolveAggregateEvidenceTier(
  tiers: DocumentKnowledgeEvidenceTier[],
): DocumentKnowledgeEvidenceTier {
  if (tiers.includes('typed_claim')) {
    return 'typed_claim';
  }

  if (tiers.includes('normalized_proposition')) {
    return 'normalized_proposition';
  }

  if (tiers.includes('excerpt_only')) {
    return 'excerpt_only';
  }

  return 'none';
}

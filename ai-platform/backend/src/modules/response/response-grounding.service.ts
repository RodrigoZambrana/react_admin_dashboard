import { Injectable } from '@nestjs/common';

import {
  DocumentKnowledgeAxisSummary,
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
  renderUnspecifiedDetailClause,
  resolveResponseGroundingCatalog,
  splitGroundingSentences,
} from './response-grounding.catalogs';

type DetailSupportLevel = 'supported' | 'partial' | 'unsupported';
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
    const queryText = normalizeText(
      `${input.userMessage} ${input.documentContext.query}`,
    );
    const evidenceText = normalizeText(
      [
        input.documentContext.groundedSummary,
        ...input.documentContext.matches.map((match) => match.excerpt),
      ].join(' '),
    );

    const requestedDetailTypes = detailTypes.filter((detailType) =>
      hasGroundingCatalogSignal(
        queryText,
        catalog.detailTypes[detailType].requestTerms,
      ),
    );
    const exactnessRequested = hasGroundingCatalogSignal(
      queryText,
      catalog.exactnessCues,
    );
    const supportByDetailType = Object.fromEntries(
      detailTypes.map((detailType) => [
        detailType,
        this.resolveSupportLevel({
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
        }),
      ]),
    ) as Record<ResponseGroundingDetailType, DetailSupportLevel>;

    const supportedDetailTypes = requestedDetailTypes.filter(
      (detailType) => supportByDetailType[detailType] === 'supported',
    );
    const partialDetailTypes = requestedDetailTypes.filter(
      (detailType) => supportByDetailType[detailType] === 'partial',
    );
    const unsupportedDetailTypes = requestedDetailTypes.filter(
      (detailType) => supportByDetailType[detailType] === 'unsupported',
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

    return {
      supportLevel: !hasApprovedEvidence
        ? ('unavailable' as const)
        : partialDetailTypes.length > 0 || unsupportedDetailTypes.length > 0
          ? ('partial' as const)
          : ('explicit' as const),
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
        !this.summaryContainsConcreteDynamicDetail({
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
    return renderUnspecifiedDetailClause({
      locale: input.locale,
      labels: uniqueLabels,
    });
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

  private resolveSupportLevel(input: {
    evidenceText: string;
    requested: boolean;
    generalEvidenceTerms: string[];
    dynamicEvidenceTerms: string[];
    supportedAxes: string[];
    unspecifiedAxes: string[];
    availableSupportedAxes: Set<string>;
    availableUnspecifiedAxes: Set<string>;
  }): DetailSupportLevel {
    if (!input.requested) {
      return 'unsupported';
    }

    const hasStructuredSupport = input.supportedAxes.some((axis) =>
      input.availableSupportedAxes.has(axis),
    );
    const hasStructuredGap = input.unspecifiedAxes.some((axis) =>
      input.availableUnspecifiedAxes.has(axis),
    );

    if (hasStructuredSupport && !hasStructuredGap) {
      return 'supported';
    }

    if (hasStructuredSupport || hasStructuredGap) {
      return 'partial';
    }

    if (
      input.dynamicEvidenceTerms.length > 0 &&
      hasGroundingCatalogSignal(input.evidenceText, input.dynamicEvidenceTerms)
    ) {
      return 'supported';
    }

    if (
      hasGroundingCatalogSignal(
        input.evidenceText,
        input.generalEvidenceTerms,
      )
    ) {
      return 'partial';
    }

    return 'unsupported';
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

    return Array.from(
      new Set(
        values
          .map((value) => normalizeText(value))
          .filter((value) => value.length > 0),
      ),
    );
  }

  private summaryContainsConcreteDynamicDetail(input: {
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
  }

  return {
    supportedAxes,
    unspecifiedAxes,
    axisValues,
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

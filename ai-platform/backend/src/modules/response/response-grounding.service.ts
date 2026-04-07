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
  resolveRequestedGroundingDetailTypes,
  renderExtractionUncertainDetailClause,
  renderUnspecifiedDetailClause,
  resolveResponseGroundingCatalog,
  responseGroundingDetailTypes,
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
    parsedSubject?: string | null;
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

    const requestedDetailTypes = resolveRequestedGroundingDetailTypes({
      locale: input.locale,
      userText,
      queryText,
    });
    const concreteSubjectAlignment = resolveConcreteSubjectAlignment({
      locale: input.locale,
      parsedSubject: input.parsedSubject ?? null,
      documentContext: input.documentContext,
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
            locale: input.locale,
            detailType,
            documentContext: input.documentContext,
            supportedAxes: catalog.detailTypes[detailType].supportedAxes ?? [],
          }),
          supportedAxes: catalog.detailTypes[detailType].supportedAxes ?? [],
          unspecifiedAxes: catalog.detailTypes[detailType].unspecifiedAxes ?? [],
          availableSupportedAxes: axisState.supportedAxes,
          availableUnspecifiedAxes: axisState.unspecifiedAxes,
          propositionSummaries: axisState.propositionSummaries,
        }),
      ]),
    ) as Record<ResponseGroundingDetailType, DetailSupportResolution>;

    const forceConcreteOutOfDomainGap =
      concreteSubjectAlignment.isConcrete && !concreteSubjectAlignment.aligned;
    const supportedDetailTypes = forceConcreteOutOfDomainGap
      ? []
      : requestedDetailTypes.filter(
          (detailType) => supportByDetailType[detailType].supportLevel === 'supported',
        );
    const partialDetailTypes = forceConcreteOutOfDomainGap
      ? []
      : requestedDetailTypes.filter(
          (detailType) => supportByDetailType[detailType].supportLevel === 'partial',
        );
    const unsupportedDetailTypes = forceConcreteOutOfDomainGap
      ? [...requestedDetailTypes]
      : requestedDetailTypes.filter(
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
    const hasRelevantEvidence =
      hasApprovedEvidence &&
      (!concreteSubjectAlignment.isConcrete || concreteSubjectAlignment.aligned);
    const outstandingDetailsExist =
      partialDetailTypes.length > 0 || unsupportedDetailTypes.length > 0;
    const hasStructuredGap = requestedDetailTypes.some(
      (detailType) => supportByDetailType[detailType].hasStructuredGap,
    );
    const evidenceTier = resolveAggregateEvidenceTier(
      requestedDetailTypes.map((detailType) => supportByDetailType[detailType].evidenceTier),
    );
    const absenceReason =
      outstandingDetailsExist || !hasRelevantEvidence
        ? hasStructuredGap
          ? ('document_gap' as const)
          : hasApprovedEvidence && forceConcreteOutOfDomainGap
            ? ('document_gap' as const)
          : ('extraction_uncertain' as const)
        : null;

    return {
      supportLevel: !hasRelevantEvidence
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
          ...(catalog.detailTypes[detailType].weakRequestTerms ?? []),
          ...(catalog.detailTypes[detailType].generalEvidenceTerms ?? []),
          ...this.resolveDynamicEvidenceTerms({
            locale: input.locale,
            detailType,
            documentContext: input.documentContext,
            supportedAxes: catalog.detailTypes[detailType].supportedAxes ?? [],
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
        ...(catalog.detailTypes[detailType].weakRequestTerms ?? []),
        ...(catalog.detailTypes[detailType].generalEvidenceTerms ?? []),
        ...this.resolveDynamicEvidenceTerms({
          locale: input.locale,
          detailType,
          documentContext: input.documentContext,
          supportedAxes: catalog.detailTypes[detailType].supportedAxes ?? [],
        }),
      ]),
    );
  }

  countSummaryDetailSignals(input: {
    locale?: string | null;
    summary: string;
    detailType: ResponseGroundingDetailType;
    documentContext?: DocumentGroundingLike;
  }) {
    const summary = input.summary?.trim();

    if (!summary) {
      return 0;
    }

    const catalog = resolveResponseGroundingCatalog(input.locale);
    const detailConfig = catalog.detailTypes[input.detailType];
    const normalizedSummary = normalizeText(summary);
    const dynamicEvidenceTerms = this.resolveDynamicEvidenceTerms({
      locale: input.locale,
      detailType: input.detailType,
      documentContext: input.documentContext,
      supportedAxes: detailConfig.supportedAxes ?? [],
    });

    const weightedSignals = [
      { terms: detailConfig.requestTerms, weight: 4 },
      { terms: detailConfig.generalEvidenceTerms ?? [], weight: 2 },
      { terms: detailConfig.weakRequestTerms ?? [], weight: 1 },
      { terms: dynamicEvidenceTerms, weight: 3 },
    ];

    return weightedSignals.reduce((score, group) => {
      const matchedCount = Array.from(new Set(group.terms.filter(Boolean))).filter(
        (term) => normalizedSummary.includes(term),
      ).length;

      return score + matchedCount * group.weight;
    }, 0);
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
    const absenceReason =
      input.documentContext.grounding.absenceReason ??
      this.resolveFallbackAbsenceReason(input.documentContext);

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

  private resolveFallbackAbsenceReason(
    documentContext: DocumentGroundingLike & {
      grounding?: {
        supportLevel?: 'explicit' | 'partial' | 'unavailable';
        evidenceTier?: DocumentKnowledgeEvidenceTier;
        exactnessRequested?: boolean;
        partialDetailTypes?: ResponseGroundingDetailType[];
        unsupportedDetailTypes?: ResponseGroundingDetailType[];
        requiredUnspecifiedDetailTypes?: ResponseGroundingDetailType[];
      };
    },
  ) {
    const grounding = documentContext.grounding;

    if (!grounding) {
      return null;
    }

    const requiredDetailTypes =
      grounding.requiredUnspecifiedDetailTypes ??
      [
        ...((grounding.exactnessRequested
          ? grounding.partialDetailTypes ?? []
          : []) as ResponseGroundingDetailType[]),
        ...((grounding.unsupportedDetailTypes ?? []) as ResponseGroundingDetailType[]),
      ];

    if (
      grounding.supportLevel === 'explicit' ||
      requiredDetailTypes.length === 0
    ) {
      return null;
    }

    if (
      grounding.evidenceTier === 'normalized_proposition' ||
      grounding.evidenceTier === 'excerpt_only'
    ) {
      return 'extraction_uncertain' as const;
    }

    return 'document_gap' as const;
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
      propositionMatchesDetailType(
        summary,
        input.detailType,
        input.supportedAxes,
      ),
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
    locale?: string | null;
    detailType: ResponseGroundingDetailType;
    documentContext?: DocumentGroundingLike;
    supportedAxes?: string[];
  }) {
    if (!input.documentContext) {
      return [];
    }

    const axisState = collectDocumentAxisState(input.documentContext);
    const allowedAxes = resolveSupportedAxesForDetailType({
      detailType: input.detailType,
      configuredAxes:
        input.supportedAxes ??
        resolveResponseGroundingCatalog(input.locale).detailTypes[input.detailType]
          .supportedAxes,
    });
    const values = axisState.axisValues
      .filter((axisSummary) => allowedAxes.has(axisSummary.axis))
      .flatMap((axisSummary) => axisSummary.values);
    const propositionValues = axisState.propositionSummaries
      .filter((summary) =>
        propositionMatchesDetailType(
          summary,
          input.detailType,
          Array.from(allowedAxes.values()),
        ),
      )
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
      locale: input.locale,
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

const detailTypes: ResponseGroundingDetailType[] = responseGroundingDetailTypes;

function normalizeText(value: string) {
  return normalizeGroundingText(value);
}

function resolveConcreteSubjectAlignment(input: {
  locale?: string | null;
  parsedSubject?: string | null;
  documentContext: DocumentGroundingLike;
}) {
  const subject = normalizeText(input.parsedSubject ?? '');

  if (!subject) {
    return {
      isConcrete: false,
      aligned: true,
    };
  }

  const catalog = resolveResponseGroundingCatalog(input.locale);
  const subjectTokens = extractGroundingTokens(
    subject,
    Math.max(4, catalog.guardrail.minimumTokenLength),
  );

  if (subjectTokens.length === 0) {
    return {
      isConcrete: false,
      aligned: true,
    };
  }

  const evidenceText = [
    input.documentContext.groundedSummary,
    ...input.documentContext.matches.flatMap((match) => [
      match.title ?? '',
      match.excerpt ?? '',
      match.supportSummary?.topic ?? '',
      ...(match.supportSummary?.axisSummaries ?? []).flatMap((summary) => [
        summary.axis,
        summary.facet ?? '',
        summary.subject?.normalizedValue ?? summary.subject?.value ?? '',
        ...summary.values,
        ...(summary.appliesTo ?? []).map(
          (scope) => scope.normalizedValue ?? scope.value,
        ),
      ]),
      ...(match.supportSummary?.propositionSummaries ?? []).flatMap((summary) => [
        summary.predicate,
        summary.facet ?? '',
        summary.objectNormalizedValue ?? summary.objectValue,
        summary.subject?.normalizedValue ?? summary.subject?.value ?? '',
        ...(summary.relationScope ?? []).map(
          (scope) => scope.normalizedValue ?? scope.value,
        ),
      ]),
    ]),
  ].join(' ');
  const evidenceTokens = new Set(
    extractGroundingTokens(
      evidenceText,
      Math.max(4, catalog.guardrail.minimumTokenLength),
    ),
  );
  const overlapCount = subjectTokens.filter((token) =>
    evidenceTokens.has(token),
  ).length;

  return {
    isConcrete: true,
    aligned:
      overlapCount >= Math.min(2, subjectTokens.length) ||
      overlapCount / Math.max(1, subjectTokens.length) >= 0.5,
  };
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

function hasAnyGroundingDetailSignal(
  normalizedText: string,
  catalog: ReturnType<typeof resolveResponseGroundingCatalog>,
) {
  return detailTypes.some((detailType) =>
    hasGroundingCatalogSignal(
      normalizedText,
      [
        ...catalog.detailTypes[detailType].requestTerms,
        ...(catalog.detailTypes[detailType].weakRequestTerms ?? []),
      ],
    ),
  );
}

function propositionMatchesDetailType(
  proposition: DocumentKnowledgePropositionSummary,
  detailType: ResponseGroundingDetailType,
  supportedAxes: string[],
) {
  const allowedAxes = resolveSupportedAxesForDetailType({
    detailType,
    configuredAxes: supportedAxes,
  });

  if (allowedAxes.has(proposition.predicate)) {
    return true;
  }

  return false;
}

function resolveSupportedAxesForDetailType(input: {
  detailType: ResponseGroundingDetailType;
  configuredAxes?: string[];
}) {
  if (Array.isArray(input.configuredAxes) && input.configuredAxes.length > 0) {
    return new Set(input.configuredAxes);
  }

  return new Set([input.detailType]);
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

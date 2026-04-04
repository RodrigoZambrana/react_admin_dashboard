import { Injectable } from '@nestjs/common';

import { DocumentRetrievalResult } from '../documents/document.types';
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

@Injectable()
export class ResponseGroundingService {
  assessDocumentContext(input: {
    locale?: string | null;
    userMessage: string;
    documentContext: DocumentRetrievalResult;
  }) {
    const catalog = resolveResponseGroundingCatalog(input.locale);
    const queryText = normalizeText(
      `${input.userMessage} ${input.documentContext.query} ${input.documentContext.groundedSummary}`,
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
          specificEvidenceTerms:
            catalog.detailTypes[detailType].specificEvidenceTerms ?? [],
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

    return {
      supportLevel:
        partialDetailTypes.length > 0 || unsupportedDetailTypes.length > 0
          ? ('partial' as const)
          : ('explicit' as const),
      exactnessRequested,
      requestedDetailTypes,
      supportedDetailTypes,
      partialDetailTypes,
      unsupportedDetailTypes,
    };
  }

  extractClaimedDetailTypes(input: { locale?: string | null; message: string }) {
    const catalog = resolveResponseGroundingCatalog(input.locale);
    const normalized = normalizeText(input.message);

    return detailTypes.filter((detailType) =>
      hasGroundingCatalogSignal(
        normalized,
        [
          ...catalog.detailTypes[detailType].requestTerms,
          ...(catalog.detailTypes[detailType].generalEvidenceTerms ?? []),
          ...(catalog.detailTypes[detailType].specificEvidenceTerms ?? []),
        ],
      ),
    );
  }

  containsUnspecifiedCue(input: { locale?: string | null; message: string }) {
    const catalog = resolveResponseGroundingCatalog(input.locale);
    const normalized = normalizeText(input.message);

    return hasGroundingCatalogSignal(normalized, catalog.unspecifiedCues);
  }

  containsCloseTurnReopenCue(input: { locale?: string | null; message: string }) {
    const catalog = resolveResponseGroundingCatalog(input.locale);
    const normalized = normalizeText(input.message);

    return hasGroundingCatalogSignal(normalized, catalog.closeTurnReopenCues);
  }

  buildUnspecifiedDetailClause(
    input: Pick<ApprovedResponseContext, 'locale' | 'documentContext'>,
  ) {
    if (!input.documentContext) {
      return null;
    }

    const catalog = resolveResponseGroundingCatalog(input.locale);
    const labels = [
      ...(
        input.documentContext.grounding.exactnessRequested
          ? input.documentContext.grounding.partialDetailTypes
          : []
      ),
      ...input.documentContext.grounding.unsupportedDetailTypes,
    ].map((detailType) => catalog.detailTypes[detailType].unspecifiedLabel);

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
    specificEvidenceTerms: string[];
  }): DetailSupportLevel {
    if (!input.requested) {
      return 'unsupported';
    }

    if (
      input.specificEvidenceTerms.length > 0 &&
      hasGroundingCatalogSignal(
        input.evidenceText,
        input.specificEvidenceTerms,
      )
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
}

const detailTypes: ResponseGroundingDetailType[] = [
  'coverage_support',
  'pricing',
  'purchase_channel',
  'availability',
  'materials',
  'color_options',
  'specific_variants',
];

function normalizeText(value: string) {
  return normalizeGroundingText(value);
}

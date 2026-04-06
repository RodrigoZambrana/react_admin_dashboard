import { Injectable } from '@nestjs/common';

import { buildStructuralKnowledgeSummary } from '../documents/document-knowledge-claims';
import { normalizeDocumentKnowledgeText } from '../documents/document-knowledge-extraction.utils';
import type { DocumentKnowledgeAxisSummary } from '../documents/document.types';
import { ResponseFallbackService } from '../response-fallback/response-fallback.service';
import {
  hasGroundingCatalogSignal,
  resolveResponseGroundingCatalog,
} from './response-grounding.catalogs';
import { ResponseGroundingService } from './response-grounding.service';
import { normalizeSourceObliviousSummary } from './response-source-normalization';
import {
  ApprovedResponseContext,
  ResponseGroundingDetailType,
} from './response.types';

@Injectable()
export class ChatResponsePolicyService {
  constructor(
    private readonly responseFallbackService: ResponseFallbackService,
    private readonly responseGroundingService: ResponseGroundingService,
  ) {}

  async resolve(context: ApprovedResponseContext) {
    const baseResponse = await this.resolveBaseResponse(context);
    const greetedResponse = await this.applyOpeningGreeting(context, baseResponse);
    return this.applyMultilineLayout(context, greetedResponse);
  }

  private async resolveBaseResponse(context: ApprovedResponseContext) {
    if (context.outcome === 'close_turn') {
      return this.buildCloseTurnResponse(context);
    }

    if (context.documentContext) {
      return this.buildDocumentAwareResponse(context);
    }

    if (context.outcome === 'clarify') {
      return this.buildClarificationResponse(context);
    }

    if (context.outcome === 'execution_succeeded') {
      return this.buildExecutionSuccessResponse(context);
    }

    if (context.outcome === 'execution_failed') {
      return this.buildExecutionFailureResponse(context);
    }

    return this.buildBasicResponse(context);
  }

  private async buildDocumentAwareResponse(context: ApprovedResponseContext) {
    const groundedSummary = context.documentContext?.groundedSummary?.trim();
    const matchBackedSummary = this.buildMatchBackedDocumentSummary(context);
    const effectiveSummary = this.selectPreferredDocumentSummary({
      context,
      groundedSummary,
      matchBackedSummary,
    });
    const supportLevel = context.documentContext?.grounding.supportLevel;
    const hasMatches = (context.documentContext?.matches.length ?? 0) > 0;
    const missingSummaryResponse = await this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'document_not_found',
      variationSeed: this.buildVariationSeed(context, 'document_not_found'),
    });
    const unavailableKnowledgeResponse =
      this.buildUnavailableKnowledgeResponse(context, missingSummaryResponse);
    const scopedUnavailableDetailResponse =
      this.buildScopedUnavailableDetailResponse(context, effectiveSummary);

    if (!effectiveSummary && supportLevel === 'unavailable' && !hasMatches) {
      if (context.outcome === 'clarify') {
        return this.composeWithDocumentSummary(
          unavailableKnowledgeResponse,
          await this.buildClarificationResponse(context),
        );
      }

      if (context.outcome === 'execution_succeeded') {
        return this.composeWithDocumentSummary(
          unavailableKnowledgeResponse,
          await this.buildExecutionSuccessResponse(context),
        );
      }

      if (context.outcome === 'execution_failed') {
        return this.composeWithDocumentSummary(
          unavailableKnowledgeResponse,
          await this.buildExecutionFailureResponse(context),
        );
      }

      return unavailableKnowledgeResponse;
    }

    if (!effectiveSummary && scopedUnavailableDetailResponse) {
      if (context.outcome === 'clarify') {
        return this.composeWithDocumentSummary(
          scopedUnavailableDetailResponse,
          await this.buildClarificationResponse(context),
        );
      }

      if (context.outcome === 'execution_succeeded') {
        return this.composeWithDocumentSummary(
          scopedUnavailableDetailResponse,
          await this.buildExecutionSuccessResponse(context),
        );
      }

      if (context.outcome === 'execution_failed') {
        return this.composeWithDocumentSummary(
          scopedUnavailableDetailResponse,
          await this.buildExecutionFailureResponse(context),
        );
      }

      return scopedUnavailableDetailResponse;
    }

    const responseSummary =
      context.documentContext?.responseMode === 'combined_execution'
        ? this.buildCombinedDocumentSummary(context, effectiveSummary)
        : this.buildDocumentGroundingSummary(context, effectiveSummary);

    if (context.outcome === 'clarify') {
      return this.composeWithDocumentSummary(
        responseSummary,
        await this.buildClarificationResponse(context),
      );
    }

    if (context.outcome === 'execution_succeeded') {
      return this.composeWithDocumentSummary(
        responseSummary,
        await this.buildExecutionSuccessResponse(context),
      );
    }

    if (context.outcome === 'execution_failed') {
      return this.composeWithDocumentSummary(
        responseSummary,
        await this.buildExecutionFailureResponse(context),
      );
    }

    return responseSummary;
  }

  private async buildCloseTurnResponse(context: ApprovedResponseContext) {
    return this.responseFallbackService.render({
      locale: context.locale,
      templateKey:
        context.decision.reasonCode === 'contextual_close_declined'
          ? 'close_turn_resolved'
          : 'close_turn_acknowledgement',
      variationSeed: this.buildVariationSeed(
        context,
        context.decision.reasonCode === 'contextual_close_declined'
          ? 'close_turn_resolved'
          : 'close_turn_acknowledgement',
      ),
    });
  }

  private async buildBasicResponse(context: ApprovedResponseContext) {
    return this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'basic_response',
      variationSeed: this.buildVariationSeed(context, 'basic_response'),
    });
  }

  private async buildClarificationResponse(context: ApprovedResponseContext) {
    const missingFields = context.missingFields ?? [];

    if (missingFields.includes('requested_date')) {
      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'clarification_requested_date',
        variationSeed: this.buildVariationSeed(
          context,
          'clarification_requested_date',
        ),
      });
    }

    if (missingFields.includes('user_goal')) {
      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'clarification_user_goal',
        variationSeed: this.buildVariationSeed(context, 'clarification_user_goal'),
      });
    }

    return this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'clarification_generic',
      variationSeed: this.buildVariationSeed(context, 'clarification_generic'),
    });
  }

  private async buildExecutionSuccessResponse(context: ApprovedResponseContext) {
    const execution = context.execution;
    const defaults = await this.responseFallbackService.getDefaults(context.locale);

    if (context.decision.toolName === 'create_booking') {
      const scheduledFor =
        typeof execution.resultSummary?.scheduledFor === 'string'
          ? execution.resultSummary.scheduledFor
          : defaults.scheduledFor;

      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'execution_success_booking',
        variables: {
          scheduledFor,
        },
      });
    }

    if (context.decision.toolName === 'create_quote') {
      const currency =
        typeof execution.resultSummary?.currency === 'string'
          ? execution.resultSummary.currency
          : defaults.currency;
      const estimatedTotal =
        typeof execution.resultSummary?.estimatedTotal === 'number'
          ? execution.resultSummary.estimatedTotal.toFixed(2)
          : defaults.amount;

      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'execution_success_quote',
        variables: {
          currency,
          estimatedTotal,
        },
      });
    }

    if (context.decision.toolName === 'get_product') {
      const name =
        typeof execution.resultSummary?.name === 'string'
          ? execution.resultSummary.name
          : defaults.productName;
      const currency =
        typeof execution.resultSummary?.currency === 'string'
          ? execution.resultSummary.currency
          : defaults.currency;
      const price =
        typeof execution.resultSummary?.price === 'number'
          ? execution.resultSummary.price.toFixed(2)
          : defaults.amount;

      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'execution_success_product',
        variables: {
          name,
          currency,
          price,
        },
      });
    }

    return this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'execution_success_generic',
    });
  }

  private async buildExecutionFailureResponse(context: ApprovedResponseContext) {
    const toolName = context.decision.toolName;
    const errorCode = context.execution.failure?.code;
    const actionLabel = await this.responseFallbackService.getActionLabel(
      context.locale,
      toolName,
    );

    if (errorCode === 'unknown_tool') {
      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'execution_failure_unknown_tool',
        variables: {
          actionLabel,
        },
      });
    }

    if (errorCode === 'validation_failed') {
      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'execution_failure_validation',
        variables: {
          actionLabel,
        },
      });
    }

    if (errorCode === 'not_found') {
      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'execution_failure_not_found',
        variables: {
          actionLabel,
        },
      });
    }

    return this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'execution_failure_generic',
      variables: {
        actionLabel,
      },
    });
  }

  private buildVariationSeed(
    context: ApprovedResponseContext,
    templateKey: string,
  ) {
    return [
      context.locale,
      templateKey,
      context.intent,
      context.decision.reasonCode,
      ...(context.missingFields ?? []),
      context.userMessage,
    ]
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .join('|')
      .toLowerCase();
  }

  private composeWithDocumentSummary(summary: string, trailing: string) {
    if (!trailing.trim()) {
      return summary;
    }

    return `${summary} ${trailing}`.trim();
  }

  private buildConciseDocumentSummary(summary: string) {
    const normalized = toCustomerFacingSummaryText(summary);
    const firstSentence = normalized.match(/^.*?[.!?](?:\s|$)/u)?.[0]?.trim();
    const maxLength = 220;

    if (firstSentence && firstSentence.length <= maxLength) {
      return firstSentence;
    }

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
  }

  private buildMatchBackedDocumentSummary(context: ApprovedResponseContext) {
    const aggregatedClaims = this.selectMatchBackedAxisSummaries(context);
    const availabilityNarrativeSummary = this.buildAvailabilityNarrativeSummary(
      context,
      aggregatedClaims,
    );

    if (availabilityNarrativeSummary) {
      return availabilityNarrativeSummary;
    }

    const broadOverviewSummary = this.buildBroadOverviewSummary(
      context,
      aggregatedClaims,
    );

    if (broadOverviewSummary) {
      return broadOverviewSummary;
    }

    const subjectAvailabilitySummary = this.buildSubjectAvailabilitySummary(
      context,
    );

    if (subjectAvailabilitySummary) {
      return subjectAvailabilitySummary;
    }

    const structuredSummary = buildStructuralKnowledgeSummary({
      locale: context.locale,
      claims: aggregatedClaims,
      limit: aggregatedClaims.length > 1 ? 2 : 1,
    });
    const excerpt = context.documentContext?.matches
      .map((match) => match.excerpt?.trim() ?? '')
      .find((value) => value.length > 0);
    const conciseExcerpt = excerpt ? this.buildConciseDocumentSummary(excerpt) : '';

    if (structuredSummary) {
      const conciseStructuredSummary =
        this.buildConciseDocumentSummary(structuredSummary);
      const structuredCandidateScore = scoreDocumentSummaryCandidate({
        locale: context.locale,
        summary: conciseStructuredSummary,
        query: `${context.userMessage} ${context.documentContext?.query ?? ''}`,
        requestedDetailTypes:
          context.documentContext?.grounding.requestedDetailTypes ?? [],
        responseGroundingService: this.responseGroundingService,
        documentContext: context.documentContext,
      });

      if (
        conciseExcerpt &&
        looksStructuralSummary(conciseStructuredSummary) &&
        !looksLowSignalSummary(conciseExcerpt) &&
        scoreDocumentSummaryCandidate({
          locale: context.locale,
          summary: conciseExcerpt,
          query: `${context.userMessage} ${context.documentContext?.query ?? ''}`,
          requestedDetailTypes:
            context.documentContext?.grounding.requestedDetailTypes ?? [],
          responseGroundingService: this.responseGroundingService,
          documentContext: context.documentContext,
        }) >= structuredCandidateScore - 1
      ) {
        return conciseExcerpt;
      }

      if (
        conciseExcerpt &&
        shouldPreferNarrativeOverviewSummary({
          context,
          candidateSummary: conciseExcerpt,
          competingSummary: conciseStructuredSummary,
        })
      ) {
        return conciseExcerpt;
      }

      if (
        conciseExcerpt &&
        scoreDocumentSummaryCandidate({
          locale: context.locale,
          summary: conciseExcerpt,
          query: `${context.userMessage} ${context.documentContext?.query ?? ''}`,
          requestedDetailTypes:
            context.documentContext?.grounding.requestedDetailTypes ?? [],
          responseGroundingService: this.responseGroundingService,
          documentContext: context.documentContext,
        }) >=
          structuredCandidateScore + 2
      ) {
        return conciseExcerpt;
      }

      return conciseStructuredSummary;
    }

    return conciseExcerpt;
  }

  private buildBroadOverviewSummary(
    context: ApprovedResponseContext,
    claims: DocumentKnowledgeAxisSummary[],
  ) {
    if (!isBroadOverviewDocumentQuestion(context) || claims.length === 0) {
      return '';
    }

    const factualClaims = claims.filter((claim) => claim.layer === 'factual');

    if (factualClaims.length === 0) {
      return '';
    }

    const primaryClaims = selectPrimaryOverviewClaims(factualClaims);
    const anchorClaim = primaryClaims[0];

    if (!anchorClaim) {
      return '';
    }

    const subjectLabel = extractDisplayTopicLabel(
      anchorClaim.subject?.value ?? anchorClaim.subject?.normalizedValue,
    );

    if (!subjectLabel) {
      return '';
    }

    const productTypesClaim = primaryClaims.find(
      (claim) => claim.axis === 'product_types' && claim.values.length > 0,
    );
    const materialsClaim = primaryClaims.find(
      (claim) => claim.axis === 'materials' && claim.values.length > 0,
    );
    const operationModesClaim = primaryClaims.find(
      (claim) => claim.axis === 'operation_modes' && claim.values.length > 0,
    );

    if (productTypesClaim) {
      return `Sí, trabajamos con ${subjectLabel}, incluyendo ${joinResponseValues(
        normalizeOverviewValuesForSubject(productTypesClaim.values, subjectLabel),
        context.locale,
      )}.`;
    }

    if (materialsClaim && operationModesClaim) {
      return `Sí, trabajamos con ${subjectLabel} en ${joinResponseValues(
        materialsClaim.values,
        context.locale,
      )}, con opciones ${joinAlternativeValues(
        operationModesClaim.values,
        context.locale,
      )}.`;
    }

    if (materialsClaim) {
      return `Sí, trabajamos con ${subjectLabel} en ${joinResponseValues(
        materialsClaim.values,
        context.locale,
      )}.`;
    }

    if (operationModesClaim) {
      return `Sí, trabajamos con ${subjectLabel}, con opciones ${joinResponseValues(
        operationModesClaim.values,
        context.locale,
      )}.`;
    }

    return '';
  }

  private buildAvailabilityNarrativeSummary(
    context: ApprovedResponseContext,
    claims: DocumentKnowledgeAxisSummary[],
  ) {
    if (!isAvailabilityStyleQuestion(context) || claims.length !== 1) {
      return '';
    }

    const claim = claims[0];

    if (claim.supportClass !== 'explicit_fact') {
      return '';
    }

    const subjectLabel = extractDisplayTopicLabel(
      claim.subject?.value ?? claim.subject?.normalizedValue,
    );

    if (!subjectLabel) {
      return '';
    }

    if (claim.axis === 'materials' && claim.values.length === 1) {
      return `Sí, tenemos ${subjectLabel} en ${formatInlineResponseValue(
        claim.values[0],
      )}.`;
    }

    if (claim.axis === 'product_types' && claim.values.length > 0) {
      return `Sí, trabajamos con ${subjectLabel}, incluyendo ${joinResponseValues(
        normalizeOverviewValuesForSubject(claim.values, subjectLabel),
        context.locale,
      )}.`;
    }

    return '';
  }

  private buildSubjectAvailabilitySummary(context: ApprovedResponseContext) {
    if (
      !isAvailabilityStyleQuestion(context) ||
      (context.documentContext?.matches.length ?? 0) === 0
    ) {
      return '';
    }

    const subjectLabel = extractDisplayTopicLabel(
      resolveParsedProductSubject(context),
    );

    if (!subjectLabel) {
      return '';
    }

    return `Sí, trabajamos con ${subjectLabel}.`;
  }

  private buildScopedUnavailableDetailResponse(
    context: ApprovedResponseContext,
    effectiveSummary?: string,
  ) {
    const requestedDetailTypes =
      context.documentContext?.grounding.requestedDetailTypes ?? [];
    const requiredUnspecifiedDetailTypes =
      context.documentContext?.grounding.requiredUnspecifiedDetailTypes ?? [];

    if (
      requestedDetailTypes.length === 0 ||
      requiredUnspecifiedDetailTypes.length === 0
    ) {
      return '';
    }

    if (
      !requiresAxisBackedVariantFallback(context) &&
      effectiveSummary &&
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: context.locale,
        summary: effectiveSummary,
        detailTypes: requestedDetailTypes,
        documentContext: context.documentContext,
      })
    ) {
      return '';
    }

    const unspecifiedClause =
      this.responseGroundingService.buildUnspecifiedDetailClause({
        locale: context.locale,
        documentContext: context.documentContext,
        summary: '',
      }) ?? '';

    if (!unspecifiedClause) {
      return '';
    }

    const scopedSubject = resolveScopedDetailSubject(context);

    if (!scopedSubject) {
      return unspecifiedClause;
    }

    return `En ${scopedSubject}, ${lowercaseFirst(unspecifiedClause)}`;
  }

  private selectPreferredDocumentSummary(input: {
    context: ApprovedResponseContext;
    groundedSummary?: string;
    matchBackedSummary?: string;
  }) {
    const groundedSummary = input.groundedSummary?.trim() ?? '';
    const matchBackedSummary = input.matchBackedSummary?.trim() ?? '';

    if (!groundedSummary) {
      return matchBackedSummary;
    }

    if (!matchBackedSummary) {
      return groundedSummary;
    }

    const requestedDetailTypes =
      input.context.documentContext?.grounding.requestedDetailTypes ?? [];
    const groundedSupportsRequestedDetail =
      requestedDetailTypes.length === 0 ||
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: input.context.locale,
        summary: groundedSummary,
        detailTypes: requestedDetailTypes,
        documentContext: input.context.documentContext,
      });
    const matchBackedSupportsRequestedDetail =
      requestedDetailTypes.length === 0 ||
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: input.context.locale,
        summary: matchBackedSummary,
        detailTypes: requestedDetailTypes,
        documentContext: input.context.documentContext,
      });

    if (matchBackedSupportsRequestedDetail && !groundedSupportsRequestedDetail) {
      return matchBackedSummary;
    }

    if (
      requestedDetailTypes.length > 0 &&
      (requiresAxisBackedVariantFallback(input.context) ||
        (!groundedSupportsRequestedDetail &&
          !matchBackedSupportsRequestedDetail))
    ) {
      return '';
    }

    if (
      isBroadOverviewDocumentQuestion(input.context) &&
      looksNarrativeSummary(matchBackedSummary) &&
      countSummaryFacts(matchBackedSummary) <= countSummaryFacts(groundedSummary)
    ) {
      return matchBackedSummary;
    }

    if (
      shouldPreferNarrativeOverviewSummary({
        context: input.context,
        candidateSummary: matchBackedSummary,
        competingSummary: groundedSummary,
      })
    ) {
      return matchBackedSummary;
    }

    if (
      looksLowSignalSummary(groundedSummary) &&
      !looksLowSignalSummary(matchBackedSummary)
    ) {
      return matchBackedSummary;
    }

    const groundedCandidateScore = scoreDocumentSummaryCandidate({
      locale: input.context.locale,
      summary: groundedSummary,
      query: `${input.context.userMessage} ${input.context.documentContext?.query ?? ''}`,
      requestedDetailTypes,
      responseGroundingService: this.responseGroundingService,
      documentContext: input.context.documentContext,
    });
    const matchBackedCandidateScore = scoreDocumentSummaryCandidate({
      locale: input.context.locale,
      summary: matchBackedSummary,
      query: `${input.context.userMessage} ${input.context.documentContext?.query ?? ''}`,
      requestedDetailTypes,
      responseGroundingService: this.responseGroundingService,
      documentContext: input.context.documentContext,
    });

    if (matchBackedCandidateScore >= groundedCandidateScore + 2) {
      return matchBackedSummary;
    }

    if (
      countSummaryFacts(matchBackedSummary) >
      countSummaryFacts(groundedSummary) + 1
    ) {
      return matchBackedSummary;
    }

    return groundedSummary;
  }

  private buildDocumentGroundingSummary(
    context: ApprovedResponseContext,
    summary: string,
  ) {
    let normalizedSummary = this.buildConciseDocumentSummary(
      context.responseStyle?.preferBrief
        ? this.trimToSingleSentence(summary)
        : summary,
    );
    const groundingClause =
      this.responseGroundingService.buildUnspecifiedDetailClause({
        locale: context.locale,
        documentContext: context.documentContext,
        summary: normalizedSummary,
      }) ?? '';
    const summarySupportsRequestedDetail =
      !context.documentContext?.grounding.requestedDetailTypes.length ||
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: context.locale,
        summary: normalizedSummary,
        detailTypes: context.documentContext.grounding.requestedDetailTypes,
        documentContext: context.documentContext,
      });

    if (!summarySupportsRequestedDetail) {
      const detailSpecificSummary = this.buildDetailSpecificSummary(context);

      if (detailSpecificSummary) {
        normalizedSummary = detailSpecificSummary;
      }
    }

    const effectiveSummarySupportsRequestedDetail =
      !context.documentContext?.grounding.requestedDetailTypes.length ||
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: context.locale,
        summary: normalizedSummary,
        detailTypes: context.documentContext.grounding.requestedDetailTypes,
        documentContext: context.documentContext,
      });

    if (!groundingClause) {
      return normalizedSummary;
    }

    if (!effectiveSummarySupportsRequestedDetail) {
      return groundingClause;
    }

    if (normalizedSummary.endsWith(groundingClause)) {
      return normalizedSummary;
    }

    return `${normalizedSummary} ${groundingClause}`.trim();
  }

  private buildCombinedDocumentSummary(
    context: ApprovedResponseContext,
    summary: string,
  ) {
    const conciseSummary = this.buildConciseDocumentSummary(
      context.responseStyle?.preferBrief
        ? this.trimToSingleSentence(summary)
        : summary,
    );
    const groundingClause =
      this.responseGroundingService.buildUnspecifiedDetailClause({
        locale: context.locale,
        documentContext: context.documentContext,
        summary: conciseSummary,
      }) ?? '';
    const hasUnsupportedDetails =
      (context.documentContext?.grounding.unsupportedDetailTypes.length ?? 0) > 0;
    const hasSupportedContext =
      (context.documentContext?.grounding.supportedDetailTypes.length ?? 0) > 0 ||
      (context.documentContext?.grounding.partialDetailTypes.length ?? 0) > 0;

    if (hasUnsupportedDetails && groundingClause) {
      return hasSupportedContext && conciseSummary
        ? `${conciseSummary} ${groundingClause}`.trim()
        : groundingClause;
    }

    if (!groundingClause) {
      return conciseSummary;
    }

    if (conciseSummary.endsWith(groundingClause)) {
      return conciseSummary;
    }

    return `${conciseSummary} ${groundingClause}`.trim();
  }

  private trimToSingleSentence(value: string) {
    const normalized = value.trim().replace(/\s+/g, ' ');
    const firstSentence = normalized.match(/^.*?[.!?](?:\s|$)/u)?.[0]?.trim();

    return firstSentence ?? normalized;
  }

  private buildUnavailableKnowledgeResponse(
    context: ApprovedResponseContext,
    fallback: string,
  ) {
    const groundingClause =
      this.responseGroundingService.buildUnspecifiedDetailClause({
        locale: context.locale,
        documentContext: context.documentContext,
        summary: '',
      }) ?? '';

    return groundingClause || fallback;
  }

  private async applyOpeningGreeting(
    context: ApprovedResponseContext,
    response: string,
  ) {
    if (!context.responseStyle?.includeInitialGreeting) {
      return response;
    }

    const greeting = await this.responseFallbackService.render({
      locale: context.locale,
      templateKey: 'opening_greeting',
      variationSeed: this.buildVariationSeed(context, 'opening_greeting'),
    });

    if (!greeting.trim()) {
      return response;
    }

    const normalizedResponse = response.trim();

    if (!normalizedResponse) {
      return greeting;
    }

    const alreadyHasGreeting = await this.responseFallbackService.startsWithGreeting(
      context.locale,
      normalizedResponse,
    );

    if (
      normalizedResponse.startsWith(greeting) ||
      alreadyHasGreeting
    ) {
      return normalizedResponse;
    }

    return `${greeting}\n\n${normalizedResponse}`.trim();
  }

  private applyMultilineLayout(
    context: ApprovedResponseContext,
    response: string,
  ) {
    if (!context.responseStyle?.preferMultiline) {
      return response.trim();
    }

    const paragraphs = response
      .split(/\n{2,}/u)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (paragraphs.length >= 2) {
      return paragraphs.join('\n\n');
    }

    const sentences = response
      .trim()
      .match(/[^.!?]+[.!?]+|[^.!?]+$/gu)
      ?.map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);

    if (!sentences || sentences.length <= 1) {
      return response.trim();
    }

    const blocks: string[] = [];
    const firstSentence = sentences[0];
    const lastSentence = sentences[sentences.length - 1];
    const hasQuestionTail =
      sentences.length > 1 && /[?¿]\s*$/u.test(lastSentence);
    let bodyStartIndex = 0;
    let bodyEndIndex = sentences.length;

    if (context.responseStyle.includeInitialGreeting) {
      blocks.push(firstSentence);
      bodyStartIndex = 1;
    }

    if (hasQuestionTail) {
      bodyEndIndex -= 1;
    }

    const bodySentences = sentences.slice(bodyStartIndex, bodyEndIndex);

    if (bodySentences.length > 0) {
      blocks.push(bodySentences.join(' '));
    }

    if (hasQuestionTail) {
      blocks.push(lastSentence);
    }

    return blocks.join('\n\n').trim();
  }

  private buildDetailSpecificSummary(context: ApprovedResponseContext) {
    const requestedDetailTypes =
      context.documentContext?.grounding.requestedDetailTypes ?? [];

    if (
      !context.documentContext ||
      requestedDetailTypes.length === 0 ||
      context.documentContext.matches.length === 0
    ) {
      return null;
    }

    const queryTokens = tokenizeSummaryText(
      `${context.userMessage} ${context.documentContext.query}`,
    );
    const candidates = context.documentContext.matches.flatMap((match) => {
      const structuralSentences = buildStructuralSentencesFromMatch(match, context.locale);

      if (structuralSentences.length > 0) {
        return structuralSentences.map((sentence) => ({
          sentence,
          score: this.scoreDetailSentence({
            locale: context.locale,
            sentence,
            requestedDetailTypes,
            queryTokens,
            documentContext: context.documentContext,
          }),
        }));
      }

      return splitSummarySentences(match.excerpt ?? '').map((sentence) => ({
        sentence,
        score: this.scoreDetailSentence({
          locale: context.locale,
          sentence,
          requestedDetailTypes,
          queryTokens,
          documentContext: context.documentContext,
        }),
      }));
    });
    const best = candidates
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)[0];

    if (!best) {
      return null;
    }

    return this.buildConciseDocumentSummary(best.sentence);
  }

  private scoreDetailSentence(input: {
    locale: string;
    sentence: string;
    requestedDetailTypes: ResponseGroundingDetailType[];
    queryTokens: string[];
    documentContext?: ApprovedResponseContext['documentContext'];
  }) {
    let score = 0;

    if (
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: input.locale,
        summary: input.sentence,
        detailTypes: input.requestedDetailTypes,
        documentContext: input.documentContext,
      })
    ) {
      score += 6;
    }

    const normalizedSentence = input.sentence.toLowerCase();

    for (const token of input.queryTokens) {
      if (normalizedSentence.includes(token)) {
        score += 1;
      }
    }

    return score;
  }

  private selectMatchBackedAxisSummaries(context: ApprovedResponseContext) {
    const matches = context.documentContext?.matches ?? [];
    const axisSummaryEntries = matches.flatMap((match) =>
      (match.supportSummary?.axisSummaries ?? []).map((axisSummary) => ({
        axisSummary,
        matchScore: match.score ?? 0,
        sequence: match.sequence ?? 0,
        topic: match.supportSummary?.topic ?? '',
      })),
    );

    if (axisSummaryEntries.length === 0) {
      return [];
    }

    const queryTokens = tokenizeSummaryText(
      `${context.userMessage} ${context.documentContext?.query ?? ''}`,
    );
    const requestedDetailTypes =
      context.documentContext?.grounding.requestedDetailTypes ?? [];
    const rankedEntries = axisSummaryEntries
      .map((entry) => ({
        ...entry,
        score: this.scoreMatchBackedAxisSummary({
          locale: context.locale,
          axisSummary: entry.axisSummary,
          queryTokens,
          requestedDetailTypes,
          matchScore: entry.matchScore,
          documentContext: context.documentContext,
        }),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (right.matchScore !== left.matchScore) {
          return right.matchScore - left.matchScore;
        }

        return left.sequence - right.sequence;
      });
    const positiveRankedEntries = rankedEntries.filter((entry) => entry.score > 0);
    const candidateEntries =
      positiveRankedEntries.length > 0 ? positiveRankedEntries : rankedEntries;
    const selected: DocumentKnowledgeAxisSummary[] = [];
    const anchor = candidateEntries[0];

    for (const entry of candidateEntries) {
      if (
        anchor &&
        entry !== anchor &&
        this.shouldSkipOffTopicAxisSummary({
          anchor: anchor.axisSummary,
          candidate: entry.axisSummary,
          anchorTopic: anchor.topic,
          candidateTopic: entry.topic,
          queryTokens,
        })
      ) {
        continue;
      }
      selected.push(entry.axisSummary);

      if (selected.length >= 6) {
        break;
      }
    }

    return aggregateAxisSummaries(selected);
  }

  private scoreMatchBackedAxisSummary(input: {
    locale: string;
    axisSummary: DocumentKnowledgeAxisSummary;
    queryTokens: string[];
    requestedDetailTypes: ResponseGroundingDetailType[];
    matchScore: number;
    documentContext?: ApprovedResponseContext['documentContext'];
  }) {
    const summary = buildStructuralKnowledgeSummary({
      locale: input.locale,
      claims: [input.axisSummary],
      limit: 1,
    });
    const axisTokens = tokenizeSummaryText(input.axisSummary.axis);
    const facetTokens = tokenizeSummaryText(input.axisSummary.facet ?? '');
    const valueTokens = tokenizeSummaryText(input.axisSummary.values.join(' '));
    const subjectTokens = tokenizeSummaryText(
      [
        input.axisSummary.subject?.axis ?? '',
        input.axisSummary.subject?.normalizedValue ??
          input.axisSummary.subject?.value ??
          '',
      ].join(' '),
    );
    const scopeTokens = tokenizeSummaryText(
      (input.axisSummary.appliesTo ?? [])
        .map(
          (scope) => `${scope.axis} ${scope.normalizedValue ?? scope.value}`,
        )
        .join(' '),
    );
    const summaryTokens = tokenizeSummaryText(summary);
    const queryTokenSet = new Set(input.queryTokens);
    const axisOverlap = axisTokens.filter((token) => queryTokenSet.has(token)).length;
    const facetOverlap = facetTokens.filter((token) => queryTokenSet.has(token)).length;
    const valueOverlap = valueTokens.filter((token) => queryTokenSet.has(token)).length;
    const subjectOverlap = subjectTokens.filter((token) => queryTokenSet.has(token)).length;
    const scopeOverlap = scopeTokens.filter((token) => queryTokenSet.has(token)).length;
    const summaryOverlap = summaryTokens.filter((token) => queryTokenSet.has(token)).length;

    let score =
      axisOverlap * 4 +
      facetOverlap * 4 +
      valueOverlap * 2 +
      subjectOverlap * 2.5 +
      scopeOverlap * 3 +
      summaryOverlap +
      input.matchScore * 0.25;

    if (
      input.requestedDetailTypes.length > 0 &&
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: input.locale,
        summary,
        detailTypes: input.requestedDetailTypes,
        documentContext: input.documentContext,
      })
    ) {
      score += 6;
    }

    if (input.axisSummary.supportClass === 'explicit_fact') {
      score += 1;
    }

    return score;
  }

  private shouldSkipOffTopicAxisSummary(input: {
    anchor: DocumentKnowledgeAxisSummary;
    candidate: DocumentKnowledgeAxisSummary;
    anchorTopic?: string;
    candidateTopic?: string;
    queryTokens: string[];
  }) {
    const queryTokenSet = new Set(input.queryTokens);
    const anchorTopicFamily = extractAxisSummaryFamilyKey(
      input.anchor,
      input.anchorTopic,
    );
    const candidateTopicFamily = extractAxisSummaryFamilyKey(
      input.candidate,
      input.candidateTopic,
    );

    if (
      anchorTopicFamily &&
      candidateTopicFamily &&
      anchorTopicFamily !== candidateTopicFamily
    ) {
      const anchorTopicOverlap = countQueryTokenOverlap(
        anchorTopicFamily,
        queryTokenSet,
      );
      const candidateTopicOverlap = countQueryTokenOverlap(
        candidateTopicFamily,
        queryTokenSet,
      );

      if (anchorTopicOverlap > candidateTopicOverlap) {
        return true;
      }
    }

    const anchorSubjectTokens = tokenizeSummaryText(
      [
        input.anchor.subject?.axis ?? '',
        input.anchor.subject?.normalizedValue ?? input.anchor.subject?.value ?? '',
      ].join(' '),
    );
    const candidateSubjectTokens = tokenizeSummaryText(
      [
        input.candidate.subject?.axis ?? '',
        input.candidate.subject?.normalizedValue ??
          input.candidate.subject?.value ??
          '',
      ].join(' '),
    );

    if (anchorSubjectTokens.length === 0 || candidateSubjectTokens.length === 0) {
      return false;
    }

    const anchorOverlap = anchorSubjectTokens.filter((token) =>
      queryTokenSet.has(token),
    ).length;
    const candidateOverlap = candidateSubjectTokens.filter((token) =>
      queryTokenSet.has(token),
    ).length;

    if (anchorOverlap === 0 || candidateOverlap > 0) {
      return false;
    }

    const anchorSignature = anchorSubjectTokens.join('|');
    const candidateSignature = candidateSubjectTokens.join('|');

    return anchorSignature !== candidateSignature;
  }
}

function splitSummarySentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function buildStructuralSentencesFromMatch(
  match: NonNullable<ApprovedResponseContext['documentContext']>['matches'][number],
  locale: string,
) {
  const claims = match.supportSummary?.axisSummaries ?? [];

  if (claims.length === 0) {
    return [];
  }

  return claims
    .map((claim) =>
      buildStructuralKnowledgeSummary({
        locale,
        claims: [claim],
        limit: 1,
      }),
    )
    .filter((value): value is string => value.trim().length > 0);
}

function tokenizeSummaryText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function countQueryTokenOverlap(value: string, queryTokenSet: Set<string>) {
  return tokenizeSummaryText(value).filter((token) => queryTokenSet.has(token))
    .length;
}

function extractAxisSummaryFamilyKey(
  axisSummary: DocumentKnowledgeAxisSummary,
  topic?: string,
) {
  const topicFamily = extractTopicFamilyKey(topic);

  if (topicFamily) {
    return topicFamily;
  }

  return extractTopicFamilyKey(
    axisSummary.subject?.normalizedValue ?? axisSummary.subject?.value,
  );
}

function extractTopicFamilyKey(value?: string) {
  const topic = value?.trim();

  if (!topic) {
    return '';
  }

  const rootSegment = topic
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)[0];

  if (!rootSegment) {
    return '';
  }

  const withoutNumericPrefix = rootSegment
    .replace(/^\d+(?:\.\d+)*\.?\s*/u, '')
    .trim();
  const familySegment =
    withoutNumericPrefix.split(/\s+-\s+/u).map((segment) => segment.trim())[0] ??
    withoutNumericPrefix;

  return normalizeDocumentKnowledgeText(familySegment);
}

function toCustomerFacingSummaryText(value: string) {
  return normalizeSourceObliviousSummary(value);
}

function aggregateAxisSummaries(claims: DocumentKnowledgeAxisSummary[]) {
  const grouped = new Map<string, DocumentKnowledgeAxisSummary>();

  for (const claim of claims) {
    const key = JSON.stringify({
      axis: claim.axis,
      facet: claim.facet ?? null,
      layer: claim.layer,
      subject: claim.subject ?? null,
      appliesTo: claim.appliesTo ?? [],
      unspecifiedAxes: claim.unspecifiedAxes ?? [],
    });
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...claim,
        values: [...claim.values],
      });
      continue;
    }

    existing.values = Array.from(new Set([...existing.values, ...claim.values]));
  }

  return Array.from(grouped.values());
}

function selectPrimaryOverviewClaims(claims: DocumentKnowledgeAxisSummary[]) {
  const axisPriority = new Map<string, number>([
    ['product_types', 5],
    ['materials', 4],
    ['operation_modes', 3],
    ['service_offers', 2],
  ]);

  return claims
    .filter(
      (claim) =>
        claim.supportClass === 'explicit_fact' &&
        claim.values.length > 0 &&
        axisPriority.has(claim.axis),
    )
    .sort((left, right) => {
      const rightPriority = axisPriority.get(right.axis) ?? 0;
      const leftPriority = axisPriority.get(left.axis) ?? 0;

      if (rightPriority !== leftPriority) {
        return rightPriority - leftPriority;
      }

      return right.values.length - left.values.length;
    })
    .slice(0, 2);
}

function countSummaryFacts(value: string) {
  return value
    .split(/[;,]/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

function scoreDocumentSummaryCandidate(input: {
  locale: string;
  summary: string;
  query: string;
  requestedDetailTypes: ResponseGroundingDetailType[];
  responseGroundingService: ResponseGroundingService;
  documentContext?: ApprovedResponseContext['documentContext'];
}) {
  const queryTokens = tokenizeSummaryText(input.query);
  const summaryTokens = tokenizeSummaryText(input.summary);
  const queryTokenSet = new Set(queryTokens);
  const overlapCount = summaryTokens.filter((token) =>
    queryTokenSet.has(token),
  ).length;
  const uniqueSummaryTokens = new Set(summaryTokens).size;
  let score = overlapCount + uniqueSummaryTokens * 0.25 + countSummaryFacts(input.summary);

  if (
    input.requestedDetailTypes.length > 0 &&
    input.responseGroundingService.summaryAddressesRequestedDetails({
      locale: input.locale,
      summary: input.summary,
      detailTypes: input.requestedDetailTypes,
      documentContext: input.documentContext,
    })
  ) {
    score += 4;
  }

  return score;
}

function shouldPreferNarrativeOverviewSummary(input: {
  context: ApprovedResponseContext;
  candidateSummary: string;
  competingSummary: string;
}) {
  if (!isBroadOverviewDocumentQuestion(input.context)) {
    return false;
  }

  if (!input.candidateSummary.trim() || !input.competingSummary.trim()) {
    return false;
  }

  return (
    looksNarrativeSummary(input.candidateSummary) &&
    looksStructuralSummary(input.competingSummary)
  );
}

function isBroadOverviewDocumentQuestion(context: ApprovedResponseContext) {
  const requestedDetailTypes =
    context.documentContext?.grounding.requestedDetailTypes ?? [];

  if (requestedDetailTypes.length > 0) {
    return false;
  }

  const normalized = normalizeDocumentKnowledgeText(
    `${context.userMessage} ${context.documentContext?.query ?? ''}`,
  );

  if (!normalized) {
    return false;
  }

  const catalog = resolveResponseGroundingCatalog(context.locale);

  return (
    hasGroundingCatalogSignal(
      normalized,
      catalog.questionSignals.broadOverviewIntentTerms,
    ) &&
    !hasGroundingCatalogSignal(normalized, catalog.questionSignals.detailCueTerms)
  );
}

function isAvailabilityStyleQuestion(context: ApprovedResponseContext) {
  const requestedDetailTypes =
    context.documentContext?.grounding.requestedDetailTypes ?? [];

  if (requestedDetailTypes.length > 0) {
    return false;
  }

  const normalized = normalizeDocumentKnowledgeText(
    `${context.userMessage} ${context.documentContext?.query ?? ''}`,
  );

  if (!normalized) {
    return false;
  }

  const catalog = resolveResponseGroundingCatalog(context.locale);

  return (
    hasGroundingCatalogSignal(
      normalized,
      catalog.questionSignals.availabilityIntentTerms,
    ) &&
    !hasGroundingCatalogSignal(normalized, catalog.questionSignals.detailCueTerms)
  );
}

function looksStructuralSummary(summary: string) {
  const normalized = summary.trim();

  if (!normalized) {
    return false;
  }

  return (
    /:\s+/u.test(normalized) ||
    /;\s+/u.test(normalized) ||
    /\|\s*/u.test(normalized) ||
    (countSummaryFacts(normalized) >= 3 && !/[.!?]$/u.test(normalized))
  );
}

function looksNarrativeSummary(summary: string) {
  const normalized = summary.trim();

  if (!normalized) {
    return false;
  }

  return !looksStructuralSummary(normalized) && /[.!?]$/u.test(normalized);
}

function looksLowSignalSummary(summary: string) {
  const tokens = tokenizeSummaryText(summary);

  if (tokens.length === 0) {
    return true;
  }

  return new Set(tokens).size <= 1;
}

function extractDisplayTopicLabel(value?: string) {
  const normalizedTopic = extractTopicFamilyKey(value);

  if (!normalizedTopic) {
    return '';
  }

  return normalizedTopic;
}

function resolveParsedProductSubject(context: ApprovedResponseContext) {
  const entities = context.interpretation.entities;

  if (
    typeof entities.productQuery === 'string' &&
    entities.productQuery.trim().length > 0
  ) {
    return entities.productQuery.trim();
  }

  if (
    typeof entities.requestSummary === 'string' &&
    entities.requestSummary.trim().length > 0
  ) {
    return entities.requestSummary.trim();
  }

  return context.documentContext?.query ?? context.userMessage;
}

function resolveScopedDetailSubject(context: ApprovedResponseContext) {
  const requestedDetailTypes =
    context.documentContext?.grounding.requestedDetailTypes ?? [];

  if (!requestedDetailTypes.includes('specific_variants')) {
    return '';
  }

  const storedFacts =
    context.conversationState?.approvedFacts &&
    typeof context.conversationState.approvedFacts === 'object'
      ? (context.conversationState.approvedFacts as Record<string, unknown>)
      : null;

  const storedSubject =
    typeof storedFacts?.subjectSummary === 'string'
      ? storedFacts.subjectSummary
      : typeof storedFacts?.topicSummary === 'string'
        ? storedFacts.topicSummary
        : '';

  if (storedSubject.trim()) {
    return extractDisplayTopicLabel(storedSubject);
  }

  const parsedSubject = resolveParsedProductSubject(context);
  return parsedSubject ? extractDisplayTopicLabel(parsedSubject) : '';
}

function requiresAxisBackedVariantFallback(context: ApprovedResponseContext) {
  const requestedDetailTypes =
    context.documentContext?.grounding.requestedDetailTypes ?? [];

  if (!requestedDetailTypes.includes('specific_variants')) {
    return false;
  }

  return !(
    context.documentContext?.matches.some((match) => {
      const supportedAxes = new Set(match.supportSummary?.supportedAxes ?? []);
      const axisSummaries = match.supportSummary?.axisSummaries ?? [];

      if (
        supportedAxes.has('specific_variants') ||
        supportedAxes.has('product_types')
      ) {
        return true;
      }

      return axisSummaries.some(
        (summary) =>
          summary.axis === 'specific_variants' || summary.axis === 'product_types',
      );
    }) ?? false
  );
}

function normalizeOverviewValuesForSubject(values: string[], subjectLabel: string) {
  const normalizedSubject = normalizeDocumentKnowledgeText(subjectLabel);
  const subjectTokens = normalizedSubject.split(/\s+/u).filter(Boolean);
  const subjectTail = subjectTokens[subjectTokens.length - 1] ?? '';

  if (!normalizedSubject) {
    return values;
  }

  return values.map((value) => {
    const trimmed = value.trim();
    const normalizedValue = normalizeDocumentKnowledgeText(trimmed);

    if (!normalizedValue) {
      return trimmed;
    }

    let withoutSubjectPrefix = normalizedValue.startsWith(normalizedSubject)
      ? normalizedValue.slice(normalizedSubject.length).trim()
      : normalizedValue.replace(
          new RegExp(`^${escapeRegExp(normalizedSubject)}\\s+`, 'u'),
          '',
        );

    if (!withoutSubjectPrefix && subjectTail) {
      withoutSubjectPrefix = normalizedValue.replace(
        new RegExp(`^${escapeRegExp(subjectTail)}\\s+`, 'u'),
        '',
      );
    }

    if (
      withoutSubjectPrefix === normalizedValue &&
      subjectTail &&
      normalizedValue.startsWith(`${subjectTail} `)
    ) {
      withoutSubjectPrefix = normalizedValue.slice(subjectTail.length).trim();
    }

    if (!withoutSubjectPrefix) {
      return trimmed;
    }

    return withoutSubjectPrefix;
  });
}

function lowercaseFirst(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toLocaleLowerCase() + value.slice(1);
}

function joinResponseValues(values: string[], locale: string) {
  const dedupedValues = Array.from(
    new Set(
      values
        .map((value) => formatInlineResponseValue(value))
        .filter(Boolean),
    ),
  );

  if (dedupedValues.length <= 1) {
    return dedupedValues[0] ?? '';
  }

  return formatLocalizedList(dedupedValues, locale, 'conjunction');
}

function joinAlternativeValues(values: string[], locale: string) {
  const dedupedValues = Array.from(
    new Set(
      values
        .map((value) => formatInlineResponseValue(value))
        .filter(Boolean),
    ),
  );

  if (dedupedValues.length <= 1) {
    return dedupedValues[0] ?? '';
  }

  return formatLocalizedList(dedupedValues, locale, 'disjunction');
}

function formatInlineResponseValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (/^[A-Z0-9]+$/u.test(trimmed) && trimmed.length <= 5) {
    return trimmed;
  }

  if (/^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:\s+[a-záéíóúüñ]+)*$/u.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return trimmed;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function formatLocalizedList(
  values: string[],
  locale: string,
  type: 'conjunction' | 'disjunction',
) {
  return new Intl.ListFormat(locale, {
    style: 'long',
    type,
  }).format(values);
}

import { Injectable } from '@nestjs/common';

import { resolveConversationSignalCatalog } from '../conversation-signals/conversation-signal.catalogs';
import { buildStructuralKnowledgeSummary } from '../documents/document-knowledge-claims';
import { normalizeDocumentKnowledgeText } from '../documents/document-knowledge-extraction.utils';
import type { DocumentKnowledgeAxisSummary } from '../documents/document.types';
import type { DocumentKnowledgeMetadataSummary } from '../documents/document.types';
import { ResponseFallbackService } from '../response-fallback/response-fallback.service';
import {
  assessRequestedGroundingDetails,
  expandGroundingEquivalentTokens,
  hasGroundingCatalogSignal,
  renderGroundingPolicyTemplate,
  resolveGroundingDetailSupportedAxes,
  resolveResponseGroundingCatalog,
  resolveResponseGroundingLocaleFamily,
  summarySeeksProductContext,
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
    const concreteOutOfDomainResponse =
      this.buildConcreteOutOfDomainResponse(context);
    const scopedUnavailableDetailResponse =
      this.buildScopedUnavailableDetailResponse(context, effectiveSummary);
    const shouldPreferConfirmationPolicyFallback =
      this.shouldPreferConfirmationPolicyFallback(context);
    const hasSupportedRequestedDetail =
      (context.documentContext?.grounding.supportedDetailTypes.length ?? 0) > 0;
    const effectiveSummaryAlreadyContainsUnavailable =
      Boolean(
        effectiveSummary &&
          scopedUnavailableDetailResponse &&
          normalizeDocumentKnowledgeText(effectiveSummary).includes(
            normalizeDocumentKnowledgeText(scopedUnavailableDetailResponse),
          ),
      );
    const effectiveSummaryClarifiesContext =
      Boolean(
        effectiveSummary &&
          this.requestedDetailSummaryAlreadyClarifiesContext(
            context,
            effectiveSummary,
          ),
      );
    const effectiveSummarySupportsRequestedDetail =
      !context.documentContext?.grounding.requestedDetailTypes.length ||
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: context.locale,
        summary: effectiveSummary,
        detailTypes: context.documentContext.grounding.requestedDetailTypes,
        documentContext: context.documentContext,
      });
    const effectiveSummaryResolvesOutstandingDetails =
      !effectiveSummary ||
      effectiveSummaryAlreadyContainsUnavailable ||
      effectiveSummaryClarifiesContext ||
      this.summaryResolvesRequiredUnspecifiedDetails(context, effectiveSummary);

    if (
      concreteOutOfDomainResponse ||
      (!effectiveSummary && supportLevel === 'unavailable' && !hasMatches)
    ) {
      const baseUnavailableResponse =
        concreteOutOfDomainResponse || unavailableKnowledgeResponse;

      if (context.outcome === 'clarify') {
        return this.composeWithDocumentSummary(
          baseUnavailableResponse,
          await this.buildClarificationResponse(context),
        );
      }

      if (context.outcome === 'execution_succeeded') {
        return this.composeWithDocumentSummary(
          baseUnavailableResponse,
          await this.buildExecutionSuccessResponse(context),
        );
      }

      if (context.outcome === 'execution_failed') {
        return this.composeWithDocumentSummary(
          baseUnavailableResponse,
          await this.buildExecutionFailureResponse(context),
        );
      }

      return baseUnavailableResponse;
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

    if (
      scopedUnavailableDetailResponse &&
      (shouldPreferConfirmationPolicyFallback ||
        !effectiveSummarySupportsRequestedDetail) &&
      !hasSupportedRequestedDetail
    ) {
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

    if (
      effectiveSummary &&
      scopedUnavailableDetailResponse &&
      hasSupportedRequestedDetail &&
      !effectiveSummaryResolvesOutstandingDetails
    ) {
      const composedSummary = this.composeWithDocumentSummary(
        effectiveSummary,
        scopedUnavailableDetailResponse,
      );

      if (context.outcome === 'clarify') {
        return this.composeWithDocumentSummary(
          composedSummary,
          await this.buildClarificationResponse(context),
        );
      }

      if (context.outcome === 'execution_succeeded') {
        return this.composeWithDocumentSummary(
          composedSummary,
          await this.buildExecutionSuccessResponse(context),
        );
      }

      if (context.outcome === 'execution_failed') {
        return this.composeWithDocumentSummary(
          composedSummary,
          await this.buildExecutionFailureResponse(context),
        );
      }

      return composedSummary;
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

    if (missingFields.includes('quote_scope')) {
      return this.responseFallbackService.render({
        locale: context.locale,
        templateKey: 'clarification_quote_scope',
        variationSeed: this.buildVariationSeed(
          context,
          'clarification_quote_scope',
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
    const shouldDeferToConfirmationPolicyFallback =
      this.shouldPreferConfirmationPolicyFallback(context);
    const shouldDeferToAxisBackedVariantFallback =
      requiresAxisBackedVariantFallback(context) &&
      (context.documentContext?.grounding.supportedDetailTypes.length ?? 0) === 0;

    const scopedVisitCostSummary = this.buildScopedVisitCostSummary(
      context,
      aggregatedClaims,
    );

    if (scopedVisitCostSummary) {
      return scopedVisitCostSummary;
    }

    if (
      shouldDeferToConfirmationPolicyFallback ||
      shouldDeferToAxisBackedVariantFallback
    ) {
      return '';
    }

    const contextLimitedDetailSummary = this.buildContextLimitedDetailSummary(
      context,
    );
    const requestedDetailSummary = this.buildRequestedDetailSummary(
      context,
      aggregatedClaims,
    );
    const mixedFamilyPartitionSummary = this.buildMixedFamilyPartitionSummary(
      context,
      aggregatedClaims,
    );
    const contextWideFamilyLabels = resolveDistinctFamilyLabels(context);

    if (requestedDetailSummary && contextLimitedDetailSummary) {
      if (
        this.requestedDetailSummaryAlreadyClarifiesContext(
          context,
          requestedDetailSummary,
        )
      ) {
        return requestedDetailSummary;
      }

      const requestedDetailTypes =
        context.documentContext?.grounding.requestedDetailTypes ?? [];
      const supportedDetailTypes =
        context.documentContext?.grounding.supportedDetailTypes ?? [];
      const requiredUnspecifiedDetailTypes =
        context.documentContext?.grounding.requiredUnspecifiedDetailTypes ?? [];

      if (
        supportedDetailTypes.length > 0 &&
        requiredUnspecifiedDetailTypes.length > 0
      ) {
        return requestedDetailSummary;
      }

      if (
        requestedDetailTypes.length === 1 &&
        supportedDetailTypes.length <= 1
      ) {
        return contextLimitedDetailSummary;
      }

      return this.composeWithDocumentSummary(
        requestedDetailSummary,
        contextLimitedDetailSummary,
      );
    }

    if (
      requestedDetailSummary &&
      mixedFamilyPartitionSummary &&
      !summaryMentionsMultipleFamilies(
        requestedDetailSummary,
        contextWideFamilyLabels,
        context.locale,
      )
    ) {
      return mixedFamilyPartitionSummary;
    }

    if (requestedDetailSummary) {
      return requestedDetailSummary;
    }

    if (
      contextLimitedDetailSummary &&
      hasRequestedProductContextSensitiveDetail(context) &&
      !shouldOfferMixedFamilyPartition(context)
    ) {
      return contextLimitedDetailSummary;
    }

    if (mixedFamilyPartitionSummary) {
      return mixedFamilyPartitionSummary;
    }

    if (contextLimitedDetailSummary) {
      return contextLimitedDetailSummary;
    }

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
      if (
        conciseExcerpt &&
        shouldPreferStructuredScopedSummary({
          selectedClaims: aggregatedClaims,
          matches: context.documentContext?.matches ?? [],
        })
      ) {
        return conciseStructuredSummary;
      }
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
      return renderGroundingPolicyTemplate({
        locale: context.locale,
        templateKey: 'broadOverviewProductTypes',
        values: {
          subject: subjectLabel,
          values: joinResponseValues(
            normalizeOverviewValuesForSubject(productTypesClaim.values, subjectLabel),
            context.locale,
          ),
        },
      });
    }

    if (materialsClaim && operationModesClaim) {
      return renderGroundingPolicyTemplate({
        locale: context.locale,
        templateKey: 'broadOverviewMaterialsAndModes',
        values: {
          subject: subjectLabel,
          materials: joinResponseValues(materialsClaim.values, context.locale),
          modes: joinAlternativeValues(operationModesClaim.values, context.locale),
        },
      });
    }

    if (materialsClaim) {
      return renderGroundingPolicyTemplate({
        locale: context.locale,
        templateKey: 'broadOverviewMaterials',
        values: {
          subject: subjectLabel,
          materials: joinResponseValues(materialsClaim.values, context.locale),
        },
      });
    }

    if (operationModesClaim) {
      return renderGroundingPolicyTemplate({
        locale: context.locale,
        templateKey: 'broadOverviewModes',
        values: {
          subject: subjectLabel,
          modes: joinResponseValues(operationModesClaim.values, context.locale),
        },
      });
    }

    return '';
  }

  private buildScopedVisitCostSummary(
    context: ApprovedResponseContext,
    claims: DocumentKnowledgeAxisSummary[],
  ) {
    const relevantClaims = aggregateAxisSummaries([
      ...claims,
      ...this.collectDetailScopedFactualAxisSummaries(context, 'pricing', [
        'commercial_visit_cost',
        'travel_cost_responsibility',
        'service_offers',
      ]),
    ]);
    const requestedRelation = resolveRequestedCoverageRelation(context);
    const visitCostClaim =
      requestedRelation === 'outside'
        ? relevantClaims.find(
            (claim) =>
              claim.axis === 'travel_cost_responsibility' &&
              (claim.appliesTo ?? []).some(
                (scope) =>
                  scope.axis === 'location_relation' &&
                  scope.normalizedValue === 'outside',
              ),
          ) ??
          relevantClaims.find((claim) => claim.axis === 'travel_cost_responsibility')
        : relevantClaims.find(
            (claim) =>
              claim.axis === 'commercial_visit_cost' &&
              claim.supportClass === 'explicit_fact' &&
              (claim.appliesTo ?? []).some((scope) => scope.axis === 'location'),
          );

    if (!visitCostClaim) {
      return '';
    }

    const location = visitCostClaim.appliesTo?.find(
      (scope) => scope.axis === 'location',
    )?.value;
    const normalizedValues = visitCostClaim.values.map((value) =>
      tokenizeSummaryText(value).join(' '),
    );
    const hasHomeVisitService = relevantClaims.some(
      (claim) =>
        claim.axis === 'service_offers' &&
        claim.values.some((value) =>
          tokenizeSummaryText(value).includes('visita'),
        ),
    );
    const visitLabel = hasHomeVisitService ? 'la visita a domicilio' : 'la visita';

    if (visitCostClaim.axis === 'travel_cost_responsibility' && location) {
      return renderGroundingPolicyTemplate({
        locale: context.locale,
        templateKey: 'visitCostOutsideLocation',
        values: {
          location,
        },
      });
    }

    if (!location) {
      return '';
    }

    if (normalizedValues.includes('sin costo')) {
      return renderGroundingPolicyTemplate({
        locale: context.locale,
        templateKey: 'visitCostInsideNoCost',
        values: {
          location,
          visitLabel,
        },
      });
    }

    return renderGroundingPolicyTemplate({
      locale: context.locale,
      templateKey: 'visitCostInsideHasCost',
      values: {
        location,
        visitLabel,
      },
    });
  }

  private buildMixedFamilyPartitionSummary(
    context: ApprovedResponseContext,
    claims: DocumentKnowledgeAxisSummary[],
  ) {
    if (!shouldOfferMixedFamilyPartition(context)) {
      return '';
    }

    const familyLabels = resolveQueryAlignedFamilyLabels(context, claims);
    const resolvedFamilyLabels =
      familyLabels.length >= 2
        ? familyLabels
        : resolveQueryAlignedFamilyLabels(context);

    if (resolvedFamilyLabels.length < 2) {
      return '';
    }

    const [firstFamily, secondFamily] = resolvedFamilyLabels;

    return renderGroundingPolicyTemplate({
      locale: context.locale,
      templateKey: 'mixedFamilyPartition',
      values: {
        families: formatLocalizedList(
          resolvedFamilyLabels.slice(0, 2),
          context.locale,
          'conjunction',
        ),
        firstFamily,
        secondFamily,
      },
    });
  }

  private buildContextLimitedDetailSummary(context: ApprovedResponseContext) {
    const grounding = context.documentContext?.grounding;

    if (!grounding) {
      return '';
    }

    const catalog = resolveResponseGroundingCatalog(context.locale);
    const familyLabels = resolveDistinctFamilyLabels(context);
    const unresolvedDetailTypes = Array.from(
      new Set(
        (grounding.requiredUnspecifiedDetailTypes ?? []).filter(
          (detailType) => catalog.detailTypes[detailType]?.requiresProductContext,
        ),
      ),
    );
    const candidateDetailTypes =
      unresolvedDetailTypes.length > 0
        ? unresolvedDetailTypes
        : grounding.supportLevel === 'explicit' && familyLabels.length >= 2
          ? Array.from(
              new Set(
                (grounding.requestedDetailTypes ?? []).filter(
                  (detailType) =>
                    catalog.detailTypes[detailType]?.requiresProductContext,
                ),
              ),
            )
          : [];

    const detailType = resolvePreferredContextLimitedDetailType(
      context,
      candidateDetailTypes,
    );

    if (!detailType) {
      return '';
    }
    const detailConfig = catalog.detailTypes[detailType];

    if (!detailConfig?.requiresProductContext) {
      return '';
    }

    const quoteContextStillMissing =
      detailType === 'quote_requirements' &&
      isQuoteScopeStillMissing(context);

    if (quoteContextStillMissing) {
      return renderGroundingPolicyTemplate({
        locale: context.locale,
        templateKey: 'contextLimitedDetailGeneric',
        values: {
          detailLabel: detailConfig.unspecifiedLabel,
        },
      });
    }

    if (
      hasConcreteDetailScope(context, [detailType]) &&
      !hasAmbiguousRequestedDetailScope(context, detailType)
    ) {
      return '';
    }

    if (
      familyLabels.length >= 2 &&
      detailConfig.preferFamilyChoiceWhenContextLimited !== false
    ) {
      return renderGroundingPolicyTemplate({
        locale: context.locale,
        templateKey: 'contextLimitedDetailFamilyChoice',
        values: {
          families: formatLocalizedList(
            familyLabels.slice(0, 2),
            context.locale,
            'disjunction',
          ),
          detailLabel: detailConfig.unspecifiedLabel,
        },
      });
    }

    return renderGroundingPolicyTemplate({
      locale: context.locale,
      templateKey: 'contextLimitedDetailGeneric',
      values: {
        detailLabel: detailConfig.unspecifiedLabel,
      },
    });
  }

  private buildRequestedDetailSummary(
    context: ApprovedResponseContext,
    claims: DocumentKnowledgeAxisSummary[],
  ) {
    const requestedDetailTypes =
      context.documentContext?.grounding.requestedDetailTypes ?? [];
    const requestedDetailAssessments = assessRequestedGroundingDetails({
      locale: context.locale,
      userText: context.userMessage,
      queryText: context.documentContext?.query ?? '',
    });
    const userBackedRequestedDetailTypes = new Set(
      requestedDetailAssessments
        .filter(
          (assessment) =>
            assessment.userStrongMatch ||
            assessment.userContextualMatch ||
            assessment.userWeakMatch,
        )
        .map((assessment) => assessment.detailType),
    );
    const resolveSupportedAxes = (detailType: ResponseGroundingDetailType) =>
      resolveGroundingDetailSupportedAxes(context.locale, detailType);

    const mixedServiceRecommendationSummary =
      this.buildMixedServiceRecommendationSummary({
        context,
        claims,
        resolveSupportedAxes,
      });

    if (mixedServiceRecommendationSummary) {
      return mixedServiceRecommendationSummary;
    }

    const mixedSupportedDetailSummary =
      this.buildMixedSupportedRequestedDetailSummary({
        context,
        claims,
        resolveSupportedAxes,
      });

    if (mixedSupportedDetailSummary) {
      return mixedSupportedDetailSummary;
    }

    if (requestedDetailTypes.includes('availability')) {
      const availabilitySummary = this.buildSubjectAvailabilitySummary(context);

      if (availabilitySummary) {
        return availabilitySummary;
      }
    }

    if (requestedDetailTypes.includes('payment_terms')) {
      const supportedAxes = resolveSupportedAxes('payment_terms');
      const paymentSummary = buildNaturalPaymentSummary(
        context.locale,
        aggregateAxisSummaries([
          ...claims,
          ...this.collectDetailScopedFactualAxisSummaries(
            context,
            'payment_terms',
            supportedAxes,
          ),
        ]),
      );

      if (paymentSummary) {
        return paymentSummary;
      }
    }

    if (requestedDetailTypes.includes('recommendation')) {
      const supportedAxes = resolveSupportedAxes('recommendation');
      const recommendationSummary = buildNaturalRecommendationSummary(
        context.locale,
        aggregateAxisSummaries([
          ...claims,
          ...this.collectDetailScopedFactualAxisSummaries(
            context,
            'recommendation',
            supportedAxes,
          ),
        ]),
        this.collectRelevantMetadataNotes(context, supportedAxes, ['guidance']),
        resolveRecommendationSubjectLabel(context),
      );

      if (recommendationSummary) {
        return recommendationSummary;
      }
    }

    if (requestedDetailTypes.includes('service_capability')) {
      const supportedAxes = resolveSupportedAxes('service_capability');
      const capabilitySummary = buildNaturalServiceCapabilitySummary(
        context.locale,
        aggregateAxisSummaries([
          ...claims,
          ...this.collectDetailScopedFactualAxisSummaries(
            context,
            'service_capability',
            supportedAxes,
          ),
        ]),
        this.collectRelevantMetadataNotes(context, supportedAxes, ['guidance']),
        resolveConcreteDetailScopeLabel(context, ['service_capability']),
        `${context.userMessage} ${context.documentContext?.query ?? ''}`,
      );

      if (capabilitySummary) {
        return capabilitySummary;
      }
    }

    if (requestedDetailTypes.includes('purchase_channel')) {
      const supportedAxes = resolveSupportedAxes('purchase_channel');
      const purchaseChannelSummary = buildNaturalPurchaseChannelSummary(
        context.locale,
        aggregateAxisSummaries([
          ...claims,
          ...this.collectDetailScopedFactualAxisSummaries(
            context,
            'purchase_channel',
            supportedAxes,
          ),
        ]),
      );

      if (purchaseChannelSummary) {
        return purchaseChannelSummary;
      }
    }

    if (requestedDetailTypes.includes('quote_requirements')) {
      if (isQuoteScopeStillMissing(context)) {
        return '';
      }

      const supportedAxes = resolveSupportedAxes('quote_requirements');
      const quoteRequirementsSummary = buildNaturalQuoteRequirementsSummary(
        context.locale,
        this.collectRelevantMetadataNotes(
          context,
          supportedAxes,
          ['workflow', 'guidance'],
          'quote_requirements',
        ),
      );

      if (quoteRequirementsSummary) {
        return quoteRequirementsSummary;
      }
    }

    if (requestedDetailTypes.includes('materials')) {
      const hasMaterialScope =
        hasConcreteDetailScope(context, ['materials']) ||
        resolveDistinctFamilyLabels(context).length <= 1;

      if (hasMaterialScope) {
        const supportedAxes = resolveSupportedAxes('materials');
        const materialsSummary = buildNaturalMaterialsSummary(
          context.locale,
          aggregateAxisSummaries([
            ...claims,
            ...this.collectDetailScopedFactualAxisSummaries(
              context,
              'materials',
              supportedAxes,
            ),
          ]),
        );

        if (materialsSummary) {
          return materialsSummary;
        }
      }
    }

    if (requestedDetailTypes.includes('color_options')) {
      const supportedAxes = resolveSupportedAxes('color_options');
      const colorSummary = buildNaturalColorSummary(
        context.locale,
        aggregateAxisSummaries([
          ...claims,
          ...this.collectDetailScopedFactualAxisSummaries(
            context,
            'color_options',
            supportedAxes,
          ),
        ]),
      );

      if (colorSummary) {
        return colorSummary;
      }
    }

    if (requestedDetailTypes.includes('warranty')) {
      const supportedAxes = resolveSupportedAxes('warranty');
      const warrantySummary = buildNaturalWarrantySummary(
        context.locale,
        aggregateAxisSummaries([
          ...claims,
          ...this.collectDetailScopedFactualAxisSummaries(
            context,
            'warranty',
            supportedAxes,
          ),
        ]),
      );

      if (warrantySummary) {
        return warrantySummary;
      }
    }

    return '';
  }

  private requestedDetailSummaryAlreadyClarifiesContext(
    context: ApprovedResponseContext,
    requestedDetailSummary: string,
  ) {
    const grounding = context.documentContext?.grounding;

    if (!grounding) {
      return false;
    }

    const catalog = resolveResponseGroundingCatalog(context.locale);
    const familyLabels = resolveDistinctFamilyLabels(context);
    if (
      familyLabels.length >= 2 &&
      summaryMentionsMultipleFamilies(
        requestedDetailSummary,
        familyLabels,
        context.locale,
      )
    ) {
      return true;
    }

    const unresolvedDetailTypes = Array.from(
      new Set(
        (grounding.requiredUnspecifiedDetailTypes ?? []).filter(
          (detailType) => catalog.detailTypes[detailType]?.requiresProductContext,
        ),
      ),
    );
    const candidateDetailTypes =
      unresolvedDetailTypes.length > 0
        ? unresolvedDetailTypes
        : grounding.supportLevel === 'explicit' && familyLabels.length >= 2
          ? Array.from(
              new Set(
                (grounding.requestedDetailTypes ?? []).filter(
                  (detailType) =>
                    catalog.detailTypes[detailType]?.requiresProductContext,
                ),
              ),
            )
          : [];
    const preferredDetailType = resolvePreferredContextLimitedDetailType(
      context,
      candidateDetailTypes,
    );

    if (!preferredDetailType) {
      return false;
    }

    const normalizedRequestedSummary = normalizeDocumentKnowledgeText(
      requestedDetailSummary,
    );
    const normalizedDetailLabel = normalizeDocumentKnowledgeText(
      catalog.detailTypes[preferredDetailType].unspecifiedLabel,
    );

    if (
      normalizedDetailLabel &&
      normalizedRequestedSummary.includes(normalizedDetailLabel)
    ) {
      return true;
    }

    if (
      catalog.detailTypes[preferredDetailType].requiresProductContext &&
      summarySeeksProductContext(context.locale, requestedDetailSummary)
    ) {
      return true;
    }

    return false;
  }

  private buildMixedServiceRecommendationSummary(input: {
    context: ApprovedResponseContext;
    claims: DocumentKnowledgeAxisSummary[];
    resolveSupportedAxes: (detailType: ResponseGroundingDetailType) => string[];
  }) {
    const { context, claims, resolveSupportedAxes } = input;
    const grounding = context.documentContext?.grounding;
    const requestedDetailTypes = grounding?.requestedDetailTypes ?? [];
    const hasSupportedRecommendation =
      grounding?.supportedDetailTypes.includes('recommendation') ?? false;
    const primaryRequestedDetailType = requestedDetailTypes[0] ?? null;
    const hasRecommendationGap =
      grounding?.unsupportedDetailTypes.includes('recommendation') ||
      grounding?.requiredUnspecifiedDetailTypes?.includes('recommendation') ||
      false;
    const isMixedRequestedIntent =
      requestedDetailTypes.includes('recommendation') &&
      (requestedDetailTypes.includes('service_capability') ||
        hasServiceCapabilityQueryOverlap(
          context.locale,
          claims,
          `${context.userMessage} ${context.documentContext?.query ?? ''}`,
        ));

    const serviceCapabilityAxes = resolveSupportedAxes('service_capability');
    const recommendationAxes = resolveSupportedAxes('recommendation');
    const capabilitySummary = buildNaturalServiceCapabilitySummary(
      context.locale,
      aggregateAxisSummaries([
        ...claims,
        ...this.collectDetailScopedFactualAxisSummaries(
          context,
          'service_capability',
          serviceCapabilityAxes,
        ),
      ]),
      this.collectRelevantMetadataNotes(context, serviceCapabilityAxes, ['guidance']),
      resolveConcreteDetailScopeLabel(context, ['service_capability']),
      `${context.userMessage} ${context.documentContext?.query ?? ''}`,
    );
    const recommendationSummary = buildNaturalRecommendationSummary(
      context.locale,
      aggregateAxisSummaries([
        ...claims,
        ...this.collectDetailScopedFactualAxisSummaries(
          context,
          'recommendation',
          recommendationAxes,
        ),
      ]),
      this.collectRelevantMetadataNotes(context, recommendationAxes, ['guidance']),
      resolveRecommendationSubjectLabel(context),
    );
    const contextLimitedDetailSummary = this.buildContextLimitedDetailSummary(context);
    const hasServiceCapabilityEvidence = capabilitySummary.length > 0;

    if (
      !isMixedRequestedIntent ||
      !hasServiceCapabilityEvidence ||
      (!hasSupportedRecommendation && !hasRecommendationGap)
    ) {
      return '';
    }

    if (
      capabilitySummary &&
      recommendationSummary &&
      !(hasSupportedRecommendation && primaryRequestedDetailType === 'recommendation')
    ) {
      return this.composeWithDocumentSummary(
        capabilitySummary,
        recommendationSummary,
      );
    }

    if (capabilitySummary && (contextLimitedDetailSummary || hasRecommendationGap)) {
      const familyLabels = resolveDistinctFamilyLabels(context);

      return familyLabels.length >= 2
        ? renderGroundingPolicyTemplate({
            locale: context.locale,
            templateKey: 'mixedServiceRecommendationClarificationFamilyChoice',
            values: {
              capabilitySummary,
              families: formatLocalizedList(
                familyLabels.slice(0, 2),
                context.locale,
                'disjunction',
              ),
            },
          })
        : renderGroundingPolicyTemplate({
            locale: context.locale,
            templateKey: 'mixedServiceRecommendationClarificationGeneric',
            values: {
              capabilitySummary,
            },
          });
    }

    return '';
  }

  private buildMixedSupportedRequestedDetailSummary(input: {
    context: ApprovedResponseContext;
    claims: DocumentKnowledgeAxisSummary[];
    resolveSupportedAxes: (
      detailType: ResponseGroundingDetailType,
    ) => string[];
  }) {
    const grounding = input.context.documentContext?.grounding;

    if (!grounding) {
      return '';
    }

    const supportedDetailTypes = grounding.supportedDetailTypes ?? [];
    const requiredUnspecifiedDetailTypes =
      grounding.requiredUnspecifiedDetailTypes ?? [];

    if (
      supportedDetailTypes.length === 0 ||
      requiredUnspecifiedDetailTypes.length === 0
    ) {
      return '';
    }

    const supportedSummary = this.buildSupportedDetailSummary({
      context: input.context,
      claims: input.claims,
      detailTypes: supportedDetailTypes,
      resolveSupportedAxes: input.resolveSupportedAxes,
    });

    if (!supportedSummary) {
      return '';
    }

    if (
      this.requestedDetailSummaryAlreadyClarifiesContext(
        input.context,
        supportedSummary,
      ) ||
      summarySeeksProductContext(input.context.locale, supportedSummary)
    ) {
      return supportedSummary;
    }

    const unavailableTail = this.buildScopedUnavailableDetailResponse(
      input.context,
      supportedSummary,
    );

    if (!unavailableTail) {
      return supportedSummary;
    }

    return this.composeWithDocumentSummary(supportedSummary, unavailableTail);
  }

  private buildSupportedDetailSummary(input: {
    context: ApprovedResponseContext;
    claims: DocumentKnowledgeAxisSummary[];
    detailTypes: ResponseGroundingDetailType[];
    resolveSupportedAxes: (
      detailType: ResponseGroundingDetailType,
    ) => string[];
  }) {
    const detailTypes = new Set(input.detailTypes);

    if (detailTypes.has('payment_terms')) {
      const supportedAxes = input.resolveSupportedAxes('payment_terms');
      const paymentSummary = buildNaturalPaymentSummary(
        input.context.locale,
        aggregateAxisSummaries([
          ...input.claims,
          ...this.collectDetailScopedFactualAxisSummaries(
            input.context,
            'payment_terms',
            supportedAxes,
          ),
        ]),
      );

      if (paymentSummary) {
        return paymentSummary;
      }
    }

    if (detailTypes.has('recommendation')) {
      const supportedAxes = input.resolveSupportedAxes('recommendation');
      const recommendationSummary = buildNaturalRecommendationSummary(
        input.context.locale,
        aggregateAxisSummaries([
          ...input.claims,
          ...this.collectDetailScopedFactualAxisSummaries(
            input.context,
            'recommendation',
            supportedAxes,
          ),
        ]),
        this.collectRelevantMetadataNotes(input.context, supportedAxes, ['guidance']),
        resolveRecommendationSubjectLabel(input.context),
      );

      if (recommendationSummary) {
        return recommendationSummary;
      }
    }

    if (detailTypes.has('service_capability')) {
      const supportedAxes = input.resolveSupportedAxes('service_capability');
      const capabilitySummary = buildNaturalServiceCapabilitySummary(
        input.context.locale,
        aggregateAxisSummaries([
          ...input.claims,
          ...this.collectDetailScopedFactualAxisSummaries(
            input.context,
            'service_capability',
            supportedAxes,
          ),
        ]),
        this.collectRelevantMetadataNotes(
          input.context,
          supportedAxes,
          ['guidance'],
        ),
        resolveConcreteDetailScopeLabel(input.context, ['service_capability']),
        `${input.context.userMessage} ${input.context.documentContext?.query ?? ''}`,
      );

      if (capabilitySummary) {
        return capabilitySummary;
      }
    }

    if (detailTypes.has('purchase_channel')) {
      const supportedAxes = input.resolveSupportedAxes('purchase_channel');
      const purchaseChannelSummary = buildNaturalPurchaseChannelSummary(
        input.context.locale,
        aggregateAxisSummaries([
          ...input.claims,
          ...this.collectDetailScopedFactualAxisSummaries(
            input.context,
            'purchase_channel',
            supportedAxes,
          ),
        ]),
      );

      if (purchaseChannelSummary) {
        return purchaseChannelSummary;
      }
    }

    if (detailTypes.has('quote_requirements')) {
      if (isQuoteScopeStillMissing(input.context)) {
        return '';
      }

      const supportedAxes = input.resolveSupportedAxes('quote_requirements');
      const quoteRequirementsSummary = buildNaturalQuoteRequirementsSummary(
        input.context.locale,
        this.collectRelevantMetadataNotes(input.context, supportedAxes, [
          'workflow',
          'guidance',
        ]),
      );

      if (quoteRequirementsSummary) {
        return quoteRequirementsSummary;
      }
    }

    if (detailTypes.has('color_options')) {
      const supportedAxes = input.resolveSupportedAxes('color_options');
      const colorSummary = buildNaturalColorSummary(
        input.context.locale,
        aggregateAxisSummaries([
          ...input.claims,
          ...this.collectDetailScopedFactualAxisSummaries(
            input.context,
            'color_options',
            supportedAxes,
          ),
        ]),
      );

      if (colorSummary) {
        return colorSummary;
      }
    }

    if (detailTypes.has('warranty')) {
      const supportedAxes = input.resolveSupportedAxes('warranty');
      const warrantySummary = buildNaturalWarrantySummary(
        input.context.locale,
        aggregateAxisSummaries([
          ...input.claims,
          ...this.collectDetailScopedFactualAxisSummaries(
            input.context,
            'warranty',
            supportedAxes,
          ),
        ]),
      );

      if (warrantySummary) {
        return warrantySummary;
      }
    }

    return '';
  }

  private collectDetailScopedFactualAxisSummaries(
    context: ApprovedResponseContext,
    detailType: ResponseGroundingDetailType,
    axes: string[],
  ) {
    const allowedAxes = new Set(axes);
    const queryTokens = tokenizeSummaryText(
      `${context.userMessage} ${context.documentContext?.query ?? ''}`,
    );
    const ranked = (context.documentContext?.matches ?? [])
      .flatMap((match) =>
        collectSupportFactualEvidence(match)
          .filter((summary) => allowedAxes.has(summary.axis))
          .map((summary) => ({
            summary,
            score: this.scoreMatchBackedAxisSummary({
              locale: context.locale,
              axisSummary: summary,
              queryTokens,
              requestedDetailTypes: [detailType],
              matchScore: match.score ?? 0,
              documentContext: context.documentContext,
            }),
            sequence: match.sequence ?? 0,
            matchScore: match.score ?? 0,
          })),
      )
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (right.matchScore !== left.matchScore) {
          return right.matchScore - left.matchScore;
        }

        return left.sequence - right.sequence;
      });
    const selected = (ranked.filter((entry) => entry.score > 0).length > 0
      ? ranked.filter((entry) => entry.score > 0)
      : ranked
    )
      .slice(0, 4)
      .map((entry) => entry.summary);

    return aggregateAxisSummaries(selected);
  }

  private collectRelevantMetadataNotes(
    context: ApprovedResponseContext,
    axes: string[],
    layers?: Array<'prudence' | 'workflow' | 'guidance'>,
    detailType?: ResponseGroundingDetailType,
  ) {
    const allowedAxes = new Set(axes);
    const allowedLayers =
      layers && layers.length > 0 ? new Set(layers) : null;
    const queryTokens = tokenizeSummaryText(
      `${context.userMessage} ${context.documentContext?.query ?? ''}`,
    );
    const ranked = (context.documentContext?.matches ?? [])
      .flatMap((match) =>
        collectSupportMetadataNotes(match, layers)
          .filter(
            (summary) =>
              allowedAxes.has(summary.axis) &&
              (allowedLayers ? allowedLayers.has(summary.layer) : true),
          )
          .map((summary) => ({
            summary,
            score: this.scoreMatchBackedMetadataNote({
              locale: context.locale,
              metadataNote: summary,
              queryTokens,
              detailType,
              matchScore: match.score ?? 0,
              documentContext: context.documentContext,
            }),
            matchScore: match.score ?? 0,
            sequence: match.sequence ?? 0,
          })),
      )
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (right.matchScore !== left.matchScore) {
          return right.matchScore - left.matchScore;
        }

        return left.sequence - right.sequence;
      });

    const candidateEntries =
      ranked.filter((entry) => entry.score > 0).length > 0
        ? ranked.filter((entry) => entry.score > 0)
        : ranked;

    return candidateEntries.slice(0, 6).map((entry) => entry.summary);
  }

  private hasMetadataNoteAxis(
    context: ApprovedResponseContext,
    axis: string,
  ) {
    return (context.documentContext?.matches ?? []).some((match) =>
      collectSupportMetadataNotes(match).some(
        (summary) => summary.axis === axis,
      ),
    );
  }

  private shouldPreferConfirmationPolicyFallback(
    context: ApprovedResponseContext,
  ) {
    const grounding = context.documentContext?.grounding;

    if (!grounding) {
      return false;
    }

    if ((grounding.requestedDetailTypes?.length ?? 0) === 0) {
      return false;
    }

    if ((grounding.requiredUnspecifiedDetailTypes?.length ?? 0) === 0) {
      return false;
    }

    if ((grounding.supportedDetailTypes?.length ?? 0) > 0) {
      return false;
    }

    return this.hasMetadataNoteAxis(context, 'confirmation_policy');
  }

  private buildAvailabilityNarrativeSummary(
    context: ApprovedResponseContext,
    claims: DocumentKnowledgeAxisSummary[],
  ) {
    const requestedDetailTypes =
      context.documentContext?.grounding.requestedDetailTypes ?? [];
    const canUseAlignedAvailabilityNarrative =
      requestedDetailTypes.length === 0 &&
      hasConcreteDocumentSubjectAlignment(context) &&
      countUserQuestionClauses(context.userMessage) <= 1;

    if (
      !isAvailabilityStyleQuestion(context) &&
      !canUseAlignedAvailabilityNarrative
    ) {
      return '';
    }

    const alignedAvailabilitySummary = this.buildAlignedAvailabilityNarrativeSummary(
      context,
      claims,
    );

    if (alignedAvailabilitySummary) {
      return alignedAvailabilitySummary;
    }

    if (claims.length !== 1) {
      return '';
    }

    return this.buildAvailabilityNarrativeFromClaim(context, claims[0]);
  }

  private buildAlignedAvailabilityNarrativeSummary(
    context: ApprovedResponseContext,
    claims: DocumentKnowledgeAxisSummary[],
  ) {
    const parsedSubject = extractDisplayTopicLabel(resolveParsedProductSubject(context));

    if (!parsedSubject) {
      return '';
    }

    const alignedClaims = claims.filter((claim) => {
      const subjectLabel = extractDisplayTopicLabel(
        claim.subject?.value ?? claim.subject?.normalizedValue,
      );

      return (
        subjectLabel.length > 0 &&
        isAlignedEvidenceSubject(context.locale, parsedSubject, [subjectLabel])
      );
    });

    if (alignedClaims.length !== 1) {
      return '';
    }

    return this.buildAvailabilityNarrativeFromClaim(context, alignedClaims[0]);
  }

  private buildAvailabilityNarrativeFromClaim(
    context: ApprovedResponseContext,
    claim?: DocumentKnowledgeAxisSummary,
  ) {
    if (!claim) {
      return '';
    }

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
      return renderGroundingPolicyTemplate({
        locale: context.locale,
        templateKey: 'availabilityMaterials',
        values: {
          subject: subjectLabel,
          values: formatInlineResponseValue(claim.values[0]),
        },
      });
    }

    if (claim.axis === 'product_types' && claim.values.length > 0) {
      return renderGroundingPolicyTemplate({
        locale: context.locale,
        templateKey: 'availabilityProductTypes',
        values: {
          subject: subjectLabel,
          values: joinResponseValues(
            normalizeOverviewValuesForSubject(claim.values, subjectLabel),
            context.locale,
          ),
        },
      });
    }

    return '';
  }

  private buildSubjectAvailabilitySummary(context: ApprovedResponseContext) {
    if (!shouldUseSubjectAvailabilitySummary(context)) {
      return '';
    }

    const subjectLabel = extractDisplayTopicLabel(
      resolveParsedProductSubject(context),
    );

    if (!subjectLabel) {
      return '';
    }

    return renderGroundingPolicyTemplate({
      locale: context.locale,
      templateKey: 'availabilitySubject',
      values: {
        subject: subjectLabel,
      },
    });
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
      !this.shouldPreferConfirmationPolicyFallback(context) &&
      !requiresAxisBackedVariantFallback(context) &&
      effectiveSummary &&
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: context.locale,
        summary: effectiveSummary,
        detailTypes: requestedDetailTypes,
        documentContext: context.documentContext,
      }) &&
      this.summaryResolvesRequiredUnspecifiedDetails(context, effectiveSummary)
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

    const confirmationPolicyFallback =
      this.buildCustomerFacingConfirmationPolicyFallback(
        context,
        unspecifiedClause,
      );

    if (confirmationPolicyFallback) {
      return confirmationPolicyFallback;
    }

    const scopedSubject =
      resolveScopedDetailSubject(context) ||
      resolveConcreteDetailScopeLabel(context, requestedDetailTypes) ||
      resolveEvidenceSubjectLabels(context, requestedDetailTypes)[0] ||
      resolveDistinctFamilyLabels(context)[0] ||
      '';

    if (!scopedSubject) {
      return unspecifiedClause;
    }

    return renderGroundingPolicyTemplate({
      locale: context.locale,
      templateKey: 'scopedUnavailableDetail',
      values: {
        subject: scopedSubject,
        detailClause: lowercaseFirst(unspecifiedClause),
      },
    });
  }

  private summaryResolvesRequiredUnspecifiedDetails(
    context: ApprovedResponseContext,
    summary?: string,
  ) {
    const normalizedSummary = summary?.trim();
    const grounding = context.documentContext?.grounding;
    const documentContext = context.documentContext;

    if (!normalizedSummary || !grounding || !documentContext) {
      return false;
    }

    const unspecifiedDetailTypes =
      this.responseGroundingService.extractUnspecifiedDetailTypes({
        locale: context.locale,
        message: normalizedSummary,
        documentContext,
      });
    const requiredUnspecifiedDetailTypes =
      grounding.requiredUnspecifiedDetailTypes ?? [];

    if (requiredUnspecifiedDetailTypes.length === 0) {
      return true;
    }

    return requiredUnspecifiedDetailTypes.every(
      (detailType) =>
        unspecifiedDetailTypes.includes(detailType) ||
        this.responseGroundingService.summaryContainsConcreteDetail({
          locale: context.locale,
          detailType,
          summary: normalizedSummary,
          documentContext,
        }),
    );
  }

  private buildCustomerFacingConfirmationPolicyFallback(
    context: ApprovedResponseContext,
    unspecifiedClause: string,
  ) {
    if (!this.hasMetadataNoteAxis(context, 'confirmation_policy')) {
      return '';
    }

    const requestedDetailTypes =
      context.documentContext?.grounding.requestedDetailTypes ?? [];
    const parsedSubject = extractDisplayTopicLabel(
      resolveParsedProductSubject(context),
    );
    const subjectLabel =
      parsedSubject &&
      !looksLikeRequestedDetailSubject({
        locale: context.locale,
        requestedDetailTypes,
        value: parsedSubject,
      })
        ? parsedSubject
        : '';
    const guidanceTail = subjectLabel
      ? renderGroundingPolicyTemplate({
          locale: context.locale,
          templateKey: 'confirmationPolicyWithSubject',
          values: {
            subject: subjectLabel,
          },
        })
      : renderGroundingPolicyTemplate({
          locale: context.locale,
          templateKey: 'confirmationPolicyGeneric',
          values: {},
        });

    return `${unspecifiedClause} ${guidanceTail}`;
  }

  private buildConcreteOutOfDomainResponse(context: ApprovedResponseContext) {
    const grounding = context.documentContext?.grounding;
    const hasMatches = (context.documentContext?.matches.length ?? 0) > 0;
    const requestedDetailTypes = grounding?.requestedDetailTypes ?? [];
    const hasSupportedOrPartialDetail =
      (grounding?.supportedDetailTypes.length ?? 0) > 0 ||
      (grounding?.partialDetailTypes.length ?? 0) > 0;
    const availabilityOnlyRequest =
      requestedDetailTypes.length > 0 &&
      requestedDetailTypes.every((detailType) => detailType === 'availability');

    if (
      !grounding ||
      grounding.supportLevel !== 'unavailable' ||
      grounding.absenceReason !== 'document_gap' ||
      !hasMatches ||
      hasConcreteDocumentSubjectAlignment(context) ||
      (requestedDetailTypes.length > 0 && !availabilityOnlyRequest) ||
      hasSupportedOrPartialDetail
    ) {
      return '';
    }

    const subjects = resolveConcreteOutOfDomainSubjects(context).filter(
      (subject) =>
        !looksLikeRequestedDetailSubject({
          locale: context.locale,
          requestedDetailTypes,
          value: subject,
        }),
    );

    if (subjects.length === 0) {
      return '';
    }

    return renderGroundingPolicyTemplate({
      locale: context.locale,
      templateKey: 'outOfDomainConcreteSubject',
      values: {
        subject: formatConcreteOutOfDomainSubjectList(context.locale, subjects),
      },
    });
  }

  private selectPreferredDocumentSummary(input: {
    context: ApprovedResponseContext;
    groundedSummary?: string;
    matchBackedSummary?: string;
  }) {
    const groundedSummary = input.groundedSummary?.trim() ?? '';
    const matchBackedSummary = input.matchBackedSummary?.trim() ?? '';
    const shouldDeferToAxisBackedVariantFallback =
      requiresAxisBackedVariantFallback(input.context) &&
      (input.context.documentContext?.grounding.supportedDetailTypes.length ?? 0) ===
        0;

    if (
      this.shouldPreferConfirmationPolicyFallback(input.context) ||
      shouldDeferToAxisBackedVariantFallback
    ) {
      return '';
    }

    if (!groundedSummary) {
      return matchBackedSummary;
    }

    if (!matchBackedSummary) {
      return groundedSummary;
    }

    if (
      shouldOfferMixedFamilyPartition(input.context) &&
      looksNarrativeSummary(matchBackedSummary)
    ) {
      return matchBackedSummary;
    }

    const requestedDetailTypes =
      input.context.documentContext?.grounding.requestedDetailTypes ?? [];
    const hasSupportedRequestedDetail =
      (input.context.documentContext?.grounding.supportedDetailTypes.length ?? 0) > 0;
    const supportedDetailTypes =
      input.context.documentContext?.grounding.supportedDetailTypes ?? [];
    const contextLimitedDetailSummary = this.buildContextLimitedDetailSummary(
      input.context,
    );
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
    const groundedSupportsSupportedDetail =
      supportedDetailTypes.length > 0 &&
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: input.context.locale,
        summary: groundedSummary,
        detailTypes: supportedDetailTypes,
        documentContext: input.context.documentContext,
      });
    const matchBackedSupportsSupportedDetail =
      supportedDetailTypes.length > 0 &&
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: input.context.locale,
        summary: matchBackedSummary,
        detailTypes: supportedDetailTypes,
        documentContext: input.context.documentContext,
      });
    const primaryRequestedDetailType = requestedDetailTypes[0];
    const groundedSupportsPrimaryDetail = primaryRequestedDetailType
      ? this.responseGroundingService.summaryAddressesRequestedDetails({
          locale: input.context.locale,
          summary: groundedSummary,
          detailTypes: [primaryRequestedDetailType],
          documentContext: input.context.documentContext,
        })
      : false;
    const matchBackedSupportsPrimaryDetail = primaryRequestedDetailType
      ? this.responseGroundingService.summaryAddressesRequestedDetails({
          locale: input.context.locale,
          summary: matchBackedSummary,
          detailTypes: [primaryRequestedDetailType],
          documentContext: input.context.documentContext,
        })
      : false;
    const groundedPrimarySignalCount = primaryRequestedDetailType
      ? this.responseGroundingService.countSummaryDetailSignals({
          locale: input.context.locale,
          summary: groundedSummary,
          detailType: primaryRequestedDetailType,
          documentContext: input.context.documentContext,
        })
      : 0;
    const matchBackedPrimarySignalCount = primaryRequestedDetailType
      ? this.responseGroundingService.countSummaryDetailSignals({
          locale: input.context.locale,
          summary: matchBackedSummary,
          detailType: primaryRequestedDetailType,
          documentContext: input.context.documentContext,
        })
      : 0;
    const subjectAvailabilitySummary =
      requestedDetailTypes.includes('availability')
        ? this.buildSubjectAvailabilitySummary(input.context)
        : '';
    const groundedClarifiesContext =
      this.requestedDetailSummaryAlreadyClarifiesContext(
        input.context,
        groundedSummary,
      );
    const matchBackedClarifiesContext =
      this.requestedDetailSummaryAlreadyClarifiesContext(
        input.context,
        matchBackedSummary,
      );

    if (
      contextLimitedDetailSummary &&
      matchBackedSummary.includes(contextLimitedDetailSummary)
    ) {
      return matchBackedSummary;
    }

    if (
      hasSupportedRequestedDetail &&
      matchBackedSupportsSupportedDetail &&
      (!groundedSupportsSupportedDetail ||
        (looksStructuralSummary(groundedSummary) &&
          !looksStructuralSummary(matchBackedSummary)) ||
        (looksLowSignalSummary(groundedSummary) &&
          !looksLowSignalSummary(matchBackedSummary)))
    ) {
      return matchBackedSummary;
    }

    if (matchBackedClarifiesContext && !groundedClarifiesContext) {
      return matchBackedSummary;
    }

    if (
      subjectAvailabilitySummary &&
      matchBackedSummary === subjectAvailabilitySummary &&
      matchBackedSupportsRequestedDetail
    ) {
      return matchBackedSummary;
    }

    if (
      primaryRequestedDetailType &&
      matchBackedSupportsPrimaryDetail &&
      (!groundedSupportsPrimaryDetail ||
        matchBackedPrimarySignalCount >= groundedPrimarySignalCount + 2)
    ) {
      return matchBackedSummary;
    }

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
      requestedDetailTypes.length > 0 &&
      looksStructuralSummary(groundedSummary) &&
      !looksStructuralSummary(matchBackedSummary) &&
      matchBackedSupportsRequestedDetail
    ) {
      return matchBackedSummary;
    }

    if (
      looksStructuralSummary(groundedSummary) &&
      !looksStructuralSummary(matchBackedSummary) &&
      looksNarrativeSummary(matchBackedSummary)
    ) {
      return matchBackedSummary;
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
    const requestedDetailTypes =
      context.documentContext?.grounding.requestedDetailTypes ?? [];
    const hasSupportedRequestedDetail =
      (context.documentContext?.grounding.supportedDetailTypes.length ?? 0) > 0;
    const preserveNarrativeDetailSummary =
      requestedDetailTypes.length > 0 &&
      looksNarrativeSummary(summary) &&
      splitSummarySentences(summary).length > 1;
    let normalizedSummary = preserveNarrativeDetailSummary
      ? summary.trim()
      : this.buildConciseDocumentSummary(
          context.responseStyle?.preferBrief
            ? this.trimToSingleSentence(summary)
            : summary,
        );
    const queryAlignedFamilyLabels = resolveQueryAlignedFamilyLabels(context);

    if (
      queryAlignedFamilyLabels.length >= 2 &&
      summaryMentionsMultipleFamilies(
        normalizedSummary,
        queryAlignedFamilyLabels,
        context.locale,
      )
    ) {
      return summary.trim();
    }

    const summaryClarifiesContext =
      this.requestedDetailSummaryAlreadyClarifiesContext(
        context,
        normalizedSummary,
      );

    if (summaryClarifiesContext) {
      return normalizedSummary;
    }
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
    const groundingClause =
      this.responseGroundingService.buildUnspecifiedDetailClause({
        locale: context.locale,
        documentContext: context.documentContext,
        summary: normalizedSummary,
      }) ?? '';
    const confirmationPolicyFallback =
      groundingClause &&
      this.shouldPreferConfirmationPolicyFallback(context)
        ? this.buildCustomerFacingConfirmationPolicyFallback(
            context,
            groundingClause,
          )
        : '';
    const contextLimitedDetailSummary = this.buildContextLimitedDetailSummary(
      context,
    );

    if (!groundingClause || summaryClarifiesContext) {
      return normalizedSummary;
    }

    if (confirmationPolicyFallback) {
      return confirmationPolicyFallback;
    }

    if (
      hasSupportedRequestedDetail &&
      contextLimitedDetailSummary &&
      normalizedSummary.includes(contextLimitedDetailSummary)
    ) {
      return normalizedSummary;
    }

    if (!effectiveSummarySupportsRequestedDetail) {
      if (
        hasSupportedRequestedDetail &&
        contextLimitedDetailSummary &&
        normalizedSummary.includes(contextLimitedDetailSummary)
      ) {
        return normalizedSummary;
      }

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
      if (
        selected.some((existing) =>
          this.shouldSkipLowerConfidenceAdjacentAxisSummary({
            selected: existing,
            candidate: entry.axisSummary,
            queryTokens,
          }),
        )
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

  private scoreMatchBackedMetadataNote(input: {
    locale: string;
    metadataNote: DocumentKnowledgeMetadataSummary;
    queryTokens: string[];
    detailType?: ResponseGroundingDetailType;
    matchScore: number;
    documentContext?: ApprovedResponseContext['documentContext'];
  }) {
    const axisTokens = tokenizeSummaryText(input.metadataNote.axis);
    const valueTokens = tokenizeSummaryText(input.metadataNote.values.join(' '));
    const subjectTokens = tokenizeSummaryText(
      [
        input.metadataNote.subject?.axis ?? '',
        input.metadataNote.subject?.normalizedValue ??
          input.metadataNote.subject?.value ??
          '',
      ].join(' '),
    );
    const summaryTokens = tokenizeSummaryText(
      buildMetadataBackedSummary(input.metadataNote),
    );
    const queryTokenSet = new Set(input.queryTokens);
    const axisOverlap = axisTokens.filter((token) => queryTokenSet.has(token)).length;
    const valueOverlap = valueTokens.filter((token) => queryTokenSet.has(token)).length;
    const subjectOverlap = subjectTokens.filter((token) => queryTokenSet.has(token)).length;
    const summaryOverlap = summaryTokens.filter((token) => queryTokenSet.has(token)).length;

    let score =
      axisOverlap * 4 +
      valueOverlap * 2 +
      subjectOverlap * 3 +
      summaryOverlap +
      input.matchScore * 0.2;

    if (
      input.detailType &&
      this.responseGroundingService.summaryAddressesRequestedDetails({
        locale: input.locale,
        summary: buildMetadataBackedSummary(input.metadataNote),
        detailTypes: [input.detailType],
        documentContext: input.documentContext,
      })
    ) {
      score += 6;
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

  private shouldSkipLowerConfidenceAdjacentAxisSummary(input: {
    selected: DocumentKnowledgeAxisSummary;
    candidate: DocumentKnowledgeAxisSummary;
    queryTokens: string[];
  }) {
    if (
      input.selected.supportClass !== 'explicit_fact' ||
      input.candidate.supportClass === 'explicit_fact'
    ) {
      return false;
    }

    if (
      !isScopedCostAxis(input.selected.axis) ||
      !isScopedCostAxis(input.candidate.axis)
    ) {
      return false;
    }

    const selectedSubject =
      input.selected.subject?.normalizedValue ?? input.selected.subject?.value ?? '';
    const candidateSubject =
      input.candidate.subject?.normalizedValue ?? input.candidate.subject?.value ?? '';

    if (
      selectedSubject.length > 0 &&
      candidateSubject.length > 0 &&
      selectedSubject !== candidateSubject
    ) {
      return false;
    }

    const queryTokenSet = new Set(input.queryTokens);
    const selectedScopeOverlap = countQueryTokenOverlap(
      summarizeAxisSummaryScope(input.selected),
      queryTokenSet,
    );
    const candidateScopeOverlap = countQueryTokenOverlap(
      summarizeAxisSummaryScope(input.candidate),
      queryTokenSet,
    );

    return selectedScopeOverlap > 0 && candidateScopeOverlap > 0;
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

function tokenizeSubjectAlignmentText(
  locale: string | null | undefined,
  value: string,
) {
  return expandGroundingEquivalentTokens(locale, tokenizeSummaryText(value));
}

function countQueryTokenOverlap(value: string, queryTokenSet: Set<string>) {
  return tokenizeSummaryText(value).filter((token) => queryTokenSet.has(token))
    .length;
}

function summarizeAxisSummaryScope(axisSummary: DocumentKnowledgeAxisSummary) {
  return (axisSummary.appliesTo ?? [])
    .map((scope) => `${scope.axis} ${scope.normalizedValue ?? scope.value}`)
    .join(' ');
}

function isScopedCostAxis(axis: string) {
  return axis === 'commercial_visit_cost' || axis === 'travel_cost_responsibility';
}

function shouldPreferStructuredScopedSummary(input: {
  selectedClaims: DocumentKnowledgeAxisSummary[];
  matches: Array<
    NonNullable<ApprovedResponseContext['documentContext']>['matches'][number]
  >;
}) {
  const selectedExplicitCostClaims = input.selectedClaims.filter(
    (claim) => isScopedCostAxis(claim.axis) && claim.supportClass === 'explicit_fact',
  );

  if (selectedExplicitCostClaims.length === 0) {
    return false;
  }

  const partialAdjacentCostClaims = input.matches.flatMap(
    (match) =>
      (match.supportSummary?.axisSummaries ?? []).filter(
        (claim) => isScopedCostAxis(claim.axis) && claim.supportClass !== 'explicit_fact',
      ),
  );

  return partialAdjacentCostClaims.some((candidate) =>
    selectedExplicitCostClaims.some(
      (selected) =>
        sameAxisSummarySubject(selected, candidate) &&
        sameAxisSummaryScope(selected, candidate),
      ),
    );
}

function sameAxisSummarySubject(
  left: DocumentKnowledgeAxisSummary,
  right: DocumentKnowledgeAxisSummary,
) {
  const leftSubject = left.subject?.normalizedValue ?? left.subject?.value ?? '';
  const rightSubject = right.subject?.normalizedValue ?? right.subject?.value ?? '';

  return leftSubject.length > 0 && leftSubject === rightSubject;
}

function sameAxisSummaryScope(
  left: DocumentKnowledgeAxisSummary,
  right: DocumentKnowledgeAxisSummary,
) {
  return summarizeAxisSummaryScope(left) === summarizeAxisSummaryScope(right);
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
  const normalizedFamilySegment = familySegment
    .replace(/\s+en\s+[\p{L}\p{N}\s]+$/u, '')
    .trim();

  return normalizeDocumentKnowledgeText(normalizedFamilySegment || familySegment);
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

function shouldUseSubjectAvailabilitySummary(context: ApprovedResponseContext) {
  if ((context.documentContext?.matches.length ?? 0) === 0) {
    return false;
  }

  const requestedDetailTypes =
    context.documentContext?.grounding.requestedDetailTypes ?? [];

  if (requestedDetailTypes.length > 1) {
    return false;
  }

  if (
    requestedDetailTypes.length === 1 &&
    requestedDetailTypes[0] !== 'availability'
  ) {
    return false;
  }

  const parsedSubject = extractDisplayTopicLabel(resolveParsedProductSubject(context));

  if (
    !parsedSubject ||
    !hasConcreteDocumentSubjectAlignment(context) ||
    looksLikeRequestedDetailSubject({
      locale: context.locale,
      requestedDetailTypes:
        requestedDetailTypes.length > 0 ? requestedDetailTypes : ['availability'],
      value: parsedSubject,
    })
  ) {
    return false;
  }

  if (requestedDetailTypes.length === 0) {
    return isAvailabilityStyleQuestion(context);
  }

  return (context.documentContext?.matches ?? []).some((match) =>
    collectSupportFactualEvidence(match).some(
      (summary) =>
        summary.axis === 'product_types' || summary.axis === 'materials',
    ),
  );
}

function countUserQuestionClauses(value: string) {
  return value
    .split(/[?!]+/u)
    .map((segment) => normalizeDocumentKnowledgeText(segment))
    .filter((segment) => /[\p{L}\p{N}]/u.test(segment)).length;
}

function hasConcreteDocumentSubjectAlignment(context: ApprovedResponseContext) {
  const parsedSubject = extractDisplayTopicLabel(resolveParsedProductSubject(context));

  if (!parsedSubject) {
    return true;
  }

  const subjectTokens = expandGroundingEquivalentTokens(
    context.locale,
    tokenizeSubjectAlignmentText(context.locale, parsedSubject),
  ).filter((token) => token.length >= 3);

  if (subjectTokens.length === 0) {
    return true;
  }

  const evidenceTokens = new Set(
    (context.documentContext?.matches ?? []).flatMap((match) => {
      const topicTokens = expandGroundingEquivalentTokens(
        context.locale,
        tokenizeSubjectAlignmentText(
          context.locale,
          match.supportSummary?.topic ?? '',
        ),
      );
      const excerptTokens = expandGroundingEquivalentTokens(
        context.locale,
        tokenizeSubjectAlignmentText(
          context.locale,
          match.excerpt ?? '',
        ),
      );
      const factualTokens = collectSupportFactualEvidence(match).flatMap((summary) =>
        expandGroundingEquivalentTokens(
          context.locale,
          tokenizeSubjectAlignmentText(
            context.locale,
            [
              summary.axis,
              summary.facet ?? '',
              summary.subject?.normalizedValue ?? summary.subject?.value ?? '',
              ...summary.values,
              ...(summary.appliesTo ?? []).map(
                (scope) => scope.normalizedValue ?? scope.value,
              ),
            ].join(' '),
          ),
        ),
      );
      const propositionTokens = (match.supportSummary?.propositionSummaries ?? []).flatMap(
        (summary) =>
          expandGroundingEquivalentTokens(
            context.locale,
            tokenizeSubjectAlignmentText(
              context.locale,
              [
                summary.predicate,
                summary.facet ?? '',
                summary.objectNormalizedValue ?? summary.objectValue,
                summary.subject?.normalizedValue ?? summary.subject?.value ?? '',
                ...(summary.relationScope ?? []).map(
                  (scope) => scope.normalizedValue ?? scope.value,
                ),
              ].join(' '),
            ),
          ),
      );

      return [
        ...topicTokens,
        ...excerptTokens,
        ...factualTokens,
        ...propositionTokens,
      ].filter((token) => token.length >= 3);
    }),
  );
  const overlapCount = subjectTokens.filter((token) =>
    evidenceTokens.has(token),
  ).length;

  return (
    overlapCount >= Math.min(2, subjectTokens.length) ||
    overlapCount / Math.max(1, subjectTokens.length) >= 0.5
  );
}

function hasConcreteDetailScope(
  context: ApprovedResponseContext,
  requestedDetailTypes: ResponseGroundingDetailType[],
) {
  return (
    resolveConcreteDetailScopeLabel(context, requestedDetailTypes).length > 0
  );
}

function hasAmbiguousRequestedDetailScope(
  context: ApprovedResponseContext,
  detailType: ResponseGroundingDetailType,
) {
  const scopeLabel = resolveConcreteDetailScopeLabel(context, [detailType]);

  if (!scopeLabel) {
    return false;
  }

  const familyLabels = resolveDistinctFamilyLabels(context);

  if (familyLabels.length >= 2) {
    return true;
  }

  return looksLikeRequestedDetailSubject({
    locale: context.locale,
    requestedDetailTypes: [detailType],
    value: scopeLabel,
  });
}

function resolvePreferredContextLimitedDetailType(
  context: ApprovedResponseContext,
  candidateDetailTypes: ResponseGroundingDetailType[],
) {
  if (candidateDetailTypes.length === 0) {
    return null;
  }

  const candidateSet = new Set(candidateDetailTypes);
  const requestedAssessments = assessRequestedGroundingDetails({
    locale: context.locale,
    userText: context.userMessage,
    queryText: context.documentContext?.query ?? '',
  });
  const preferredAssessedDetailType =
    requestedAssessments.find((assessment) =>
      candidateSet.has(assessment.detailType),
    )?.detailType ?? null;

  if (preferredAssessedDetailType) {
    return preferredAssessedDetailType;
  }

  const requestedDetailTypes =
    context.documentContext?.grounding.requestedDetailTypes ?? [];
  const preferredRequestedDetailType =
    requestedDetailTypes.find((detailType) => candidateSet.has(detailType)) ?? null;

  return preferredRequestedDetailType ?? candidateDetailTypes[0] ?? null;
}

function resolveConcreteDetailScopeLabel(
  context: ApprovedResponseContext,
  requestedDetailTypes: ResponseGroundingDetailType[],
) {
  const familyLabels = resolveDistinctFamilyLabels(context);
  const evidenceSubjectLabels = resolveEvidenceSubjectLabels(
    context,
    requestedDetailTypes,
  );
  const subjectEvidenceLabels = Array.from(
    new Set([...familyLabels, ...evidenceSubjectLabels]),
  );
  const approvedFacts =
    context.conversationState?.approvedFacts &&
    typeof context.conversationState.approvedFacts === 'object'
      ? (context.conversationState.approvedFacts as Record<string, unknown>)
      : null;
  const storedScopeCandidates = [
    typeof approvedFacts?.subjectSummary === 'string'
      ? approvedFacts.subjectSummary
      : '',
    typeof approvedFacts?.topicSummary === 'string'
      ? approvedFacts.topicSummary
      : '',
  ]
    .map((candidate) => extractDisplayTopicLabel(candidate))
    .filter((candidate) => candidate.length > 0);

  const alignedStoredScopeCandidate =
    storedScopeCandidates.find(
      (candidate) =>
        !looksLikeRequestedDetailSubject({
          locale: context.locale,
          requestedDetailTypes,
          value: candidate,
        }) &&
        isAlignedEvidenceSubject(context.locale, candidate, subjectEvidenceLabels),
    ) ?? '';

  if (alignedStoredScopeCandidate) {
    return alignedStoredScopeCandidate;
  }

  const parsedSubject = extractDisplayTopicLabel(resolveParsedProductSubject(context));

  if (
    !parsedSubject ||
    looksLikeRequestedDetailSubject({
      locale: context.locale,
      requestedDetailTypes,
      value: parsedSubject,
    })
  ) {
    return '';
  }

  if (familyLabels.length === 0) {
    return evidenceSubjectLabels.length === 1 ? evidenceSubjectLabels[0] ?? '' : '';
  }

  const candidateTokens = tokenizeSummaryText(parsedSubject);

  const matchesFamily = familyLabels.some((label) => {
    const normalizedLabel = extractDisplayTopicLabel(label);
    const labelTokens = tokenizeSummaryText(normalizedLabel);

    return (
      normalizedLabel === parsedSubject ||
      normalizedLabel.includes(parsedSubject) ||
      parsedSubject.includes(normalizedLabel) ||
      candidateTokens.some((token) => labelTokens.includes(token))
    );
  });

  if (matchesFamily) {
    return parsedSubject;
  }

  if (familyLabels.length === 1) {
    return familyLabels[0] ?? '';
  }

  if (evidenceSubjectLabels.length === 1) {
    return evidenceSubjectLabels[0] ?? '';
  }

  return '';
}

function isAlignedEvidenceSubject(
  locale: string | null | undefined,
  candidate: string,
  evidenceLabels: string[],
) {
  if (!candidate || evidenceLabels.length === 0) {
    return false;
  }

  const candidateTokens = tokenizeSubjectAlignmentText(locale, candidate);

  return evidenceLabels.some((label) => {
    const normalizedLabel = extractDisplayTopicLabel(label);
    const labelTokens = tokenizeSubjectAlignmentText(locale, normalizedLabel);

    return (
      normalizedLabel === candidate ||
      normalizedLabel.includes(candidate) ||
      candidate.includes(normalizedLabel) ||
      candidateTokens.some((token) => labelTokens.includes(token))
    );
  });
}

function resolveEvidenceSubjectLabels(
  context: ApprovedResponseContext,
  requestedDetailTypes: ResponseGroundingDetailType[],
) {
  return Array.from(
    new Set(
      (context.documentContext?.matches ?? [])
        .flatMap((match) => collectSupportFactualEvidence(match))
        .map((summary) =>
          extractDisplayTopicLabel(
            summary.subject?.value ?? summary.subject?.normalizedValue,
          ),
        )
        .filter(
          (label) =>
            label.length > 0 &&
            !looksLikeRequestedDetailSubject({
              locale: context.locale,
              requestedDetailTypes,
              value: label,
            }),
        ),
    ),
  );
}

function resolveDistinctFamilyLabels(
  context: ApprovedResponseContext,
  claims: DocumentKnowledgeAxisSummary[] = [],
) {
  return resolveFamilyLabels(context, claims, true);
}

function resolveQueryAlignedFamilyLabels(
  context: ApprovedResponseContext,
  claims: DocumentKnowledgeAxisSummary[] = [],
) {
  return resolveFamilyLabels(context, claims, false);
}

function resolveFamilyLabels(
  context: ApprovedResponseContext,
  claims: DocumentKnowledgeAxisSummary[],
  fallbackToAllFamilies: boolean,
) {
  const familyMap = new Map<string, string>();

  for (const match of context.documentContext?.matches ?? []) {
    for (const summary of collectSupportFactualEvidence(match)) {
      if (!isMixedFamilyPartitionEligibleSummary(summary)) {
        continue;
      }

      const familyKey = extractAxisSummaryFamilyKey(
        summary,
        match.supportSummary?.topic,
      );
      const familyLabel = extractDisplayTopicLabel(
        summary.subject?.value ?? summary.subject?.normalizedValue,
      );

      if (familyKey && !familyMap.has(familyKey)) {
        familyMap.set(familyKey, familyLabel || familyKey);
      }
    }
  }

  for (const claim of claims) {
    if (!isMixedFamilyPartitionEligibleSummary(claim)) {
      continue;
    }

    const familyKey = extractAxisSummaryFamilyKey(claim);
    const familyLabel = extractDisplayTopicLabel(
      claim.subject?.value ?? claim.subject?.normalizedValue,
    );

    if (familyKey && !familyMap.has(familyKey)) {
      familyMap.set(familyKey, familyLabel || familyKey);
    }
  }

  const normalizedQuery = normalizeDocumentKnowledgeText(
    `${context.userMessage} ${context.documentContext?.query ?? ''}`,
  );
  const labels = Array.from(familyMap.entries())
    .filter(([familyKey, familyLabel]) => {
      const candidateTokens = tokenizeSummaryText(familyKey).filter(
        (token) => token.length >= 4,
      );

      return (
        candidateTokens.length > 0 &&
        candidateTokens.some((token) => normalizedQuery.includes(token))
      );
    })
    .map(([, familyLabel]) => familyLabel);

  if (labels.length > 0) {
    return dedupeEquivalentFamilyLabels(labels);
  }

  return fallbackToAllFamilies
    ? dedupeEquivalentFamilyLabels(Array.from(familyMap.values()))
    : [];
}

function dedupeEquivalentFamilyLabels(labels: string[]) {
  const selected: string[] = [];

  for (const label of labels) {
    const normalizedLabel = extractDisplayTopicLabel(label);

    if (!normalizedLabel) {
      continue;
    }

    const existingIndex = selected.findIndex((candidate) =>
      areEquivalentFamilyLabels(candidate, normalizedLabel),
    );

    if (existingIndex < 0) {
      selected.push(normalizedLabel);
      continue;
    }

    const existing = selected[existingIndex] ?? '';

    if (shouldPreferFamilyLabel(normalizedLabel, existing)) {
      selected[existingIndex] = normalizedLabel;
    }
  }

  return selected;
}

function areEquivalentFamilyLabels(left: string, right: string) {
  const normalizedLeft = extractDisplayTopicLabel(left);
  const normalizedRight = extractDisplayTopicLabel(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return true;
  }

  const leftTokens = Array.from(new Set(tokenizeSummaryText(normalizedLeft)));
  const rightTokens = Array.from(new Set(tokenizeSummaryText(normalizedRight)));
  const sharedTokenCount = leftTokens.filter((token) =>
    rightTokens.includes(token),
  ).length;

  if (sharedTokenCount === 0) {
    return false;
  }

  const shortestTokenCount = Math.min(leftTokens.length, rightTokens.length);
  return shortestTokenCount > 0 && sharedTokenCount / shortestTokenCount >= 0.75;
}

function shouldPreferFamilyLabel(candidate: string, existing: string) {
  const candidateTokens = tokenizeSummaryText(candidate);
  const existingTokens = tokenizeSummaryText(existing);
  const candidateLength = candidate.replace(/\s+/gu, '').length;
  const existingLength = existing.replace(/\s+/gu, '').length;

  if (candidateTokens.length !== existingTokens.length) {
    return candidateTokens.length < existingTokens.length;
  }

  return candidateLength < existingLength;
}

function isMixedFamilyPartitionEligibleSummary(
  summary: DocumentKnowledgeAxisSummary,
) {
  return (
    summary.layer === 'factual' &&
    ['product_types', 'materials', 'operation_modes', 'feature_support'].includes(
      summary.axis,
    )
  );
}

function shouldOfferMixedFamilyPartition(context: ApprovedResponseContext) {
  if ((context.documentContext?.matches.length ?? 0) < 2) {
    return false;
  }

  const grounding = context.documentContext?.grounding;
  const catalog = resolveResponseGroundingCatalog(context.locale);
  const contextLimitedCandidates = Array.from(
    new Set(
      [
        ...(grounding?.requiredUnspecifiedDetailTypes ?? []),
        ...(grounding?.requestedDetailTypes ?? []),
      ].filter((detailType) => catalog.detailTypes[detailType]?.requiresProductContext),
    ),
  );
  const preferredDetailType = resolvePreferredContextLimitedDetailType(
    context,
    contextLimitedCandidates,
  );

  if (
    preferredDetailType &&
    catalog.detailTypes[preferredDetailType]?.preferFamilyChoiceWhenContextLimited ===
      false
  ) {
    return false;
  }

  const familyLabelCount = resolveQueryAlignedFamilyLabels(context).length;
  const normalized = normalizeDocumentKnowledgeText(
    `${context.userMessage} ${context.documentContext?.query ?? ''}`,
  );
  const bridgeTerms =
    resolveConversationSignalCatalog(context.locale).textSupport.bridgeTerms;
  const hasBridgeCue =
    bridgeTerms.some((term) =>
      normalized.includes(normalizeDocumentKnowledgeText(term)),
    ) || /[,;/]/u.test(context.userMessage);
  const requestedDetailTypes =
    context.documentContext?.grounding.requestedDetailTypes ?? [];

  return familyLabelCount >= 2 && (hasBridgeCue || requestedDetailTypes.length >= 2);
}

function hasRequestedProductContextSensitiveDetail(
  context: ApprovedResponseContext,
) {
  const grounding = context.documentContext?.grounding;

  if (!grounding) {
    return false;
  }

  const catalog = resolveResponseGroundingCatalog(context.locale);
  const candidateDetailTypes = new Set([
    ...(grounding.requiredUnspecifiedDetailTypes ?? []),
    ...(grounding.requestedDetailTypes ?? []),
  ]);

  return Array.from(candidateDetailTypes).some(
    (detailType) => catalog.detailTypes[detailType]?.requiresProductContext,
  );
}

function isQuoteScopeStillMissing(context: ApprovedResponseContext) {
  const missingFields = context.decision?.missingFields ?? [];

  return missingFields.includes('quote_scope');
}

function hasServiceCapabilityQueryOverlap(
  locale: string,
  claims: DocumentKnowledgeAxisSummary[],
  queryText: string,
) {
  const queryTokens = tokenizeSubjectAlignmentText(locale, queryText).filter(
    (token) => token.length >= 4,
  );

  if (queryTokens.length === 0) {
    return false;
  }

  return claims.some(
    (claim) =>
      claim.axis === 'service_offers' &&
      claim.supportClass === 'explicit_fact' &&
      claim.values.some((value) =>
        tokenizeSubjectAlignmentText(locale, value)
          .filter((token) => token.length >= 4)
          .some((token) => queryTokens.includes(token)),
      ),
  );
}

function summaryMentionsMultipleFamilies(
  summary: string,
  familyLabels: string[],
  locale: string,
) {
  if (!summary.trim() || familyLabels.length < 2) {
    return false;
  }

  const normalizedSummary = normalizeDocumentKnowledgeText(summary);
  const mentionedFamilies = familyLabels.filter((label) => {
    const normalizedLabel = extractDisplayTopicLabel(label);

    if (!normalizedLabel) {
      return false;
    }

    const labelTokens = tokenizeSubjectAlignmentText(locale, normalizedLabel).filter(
      (token) => token.length >= 4,
    );

    return (
      normalizedSummary.includes(normalizedLabel) ||
      labelTokens.some((token) => normalizedSummary.includes(token))
    );
  });

  return mentionedFamilies.length >= 2;
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

function resolveRecommendationSubjectLabel(context: ApprovedResponseContext) {
  const parsedSubject = extractDisplayTopicLabel(resolveParsedProductSubject(context));

  if (
    parsedSubject &&
    !looksLikeRequestedDetailSubject({
      locale: context.locale,
      requestedDetailTypes: ['recommendation'],
      value: parsedSubject,
    })
  ) {
    return parsedSubject;
  }

  return '';
}

function resolveConcreteOutOfDomainSubjects(context: ApprovedResponseContext) {
  const entities = context.interpretation.entities;
  const rawSubject =
    typeof entities.productQuery === 'string' && entities.productQuery.trim().length > 0
      ? entities.productQuery.trim()
      : '';

  if (!rawSubject) {
    return [];
  }

  const segments = rawSubject
    .split(/\s*(?:,|;|\/|\b(?:o|y|or|and)\b)\s*/iu)
    .map((value) => value.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);

  return Array.from(
    new Set(
      (segments.length > 1 ? segments : [rawSubject]).filter((segment) => {
        const normalized = normalizeDocumentKnowledgeText(segment);

        return (
          normalized.length > 0 &&
          !normalized.startsWith('el usuario ') &&
          !normalized.startsWith('la consulta ') &&
          !normalized.startsWith('solicitud de ') &&
          !normalized.startsWith('consulta sobre ')
        );
      }),
    ),
  );
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

function looksLikeRequestedDetailSubject(input: {
  locale: string;
  requestedDetailTypes: ResponseGroundingDetailType[];
  value: string;
}) {
  const normalizedValue = normalizeDocumentKnowledgeText(input.value);

  if (!normalizedValue) {
    return false;
  }

  const catalog = resolveResponseGroundingCatalog(input.locale);

  return input.requestedDetailTypes.some((detailType) => {
    const detailConfig = catalog.detailTypes[detailType];

    if (!detailConfig) {
      return false;
    }

    const candidateTerms = [
      ...(detailConfig.requestTerms ?? []),
      ...(detailConfig.generalEvidenceTerms ?? []),
    ]
      .map((term) => normalizeDocumentKnowledgeText(term))
      .filter((term) => term.length > 0);

    return candidateTerms.some(
      (term) =>
        normalizedValue === term ||
        normalizedValue.includes(term) ||
        term.includes(normalizedValue),
    );
  });
}

function resolveRequestedCoverageRelation(context: ApprovedResponseContext) {
  const normalized = normalizeDocumentKnowledgeText(
    `${context.userMessage} ${context.documentContext?.query ?? ''}`,
  );

  if (!normalized) {
    return '';
  }

  const catalog = resolveResponseGroundingCatalog(context.locale);

  if (
    hasGroundingCatalogSignal(
      normalized,
      catalog.coverageScopeSignals.outsideLocationTerms,
    )
  ) {
    return 'outside';
  }

  if (
    hasGroundingCatalogSignal(
      normalized,
      catalog.coverageScopeSignals.insideLocationTerms,
    )
  ) {
    return 'inside';
  }

  return '';
}

function requiresAxisBackedVariantFallback(context: ApprovedResponseContext) {
  const requestedDetailTypes =
    context.documentContext?.grounding.requestedDetailTypes ?? [];
  const supportedDetailTypes =
    context.documentContext?.grounding.supportedDetailTypes ?? [];

  if (!requestedDetailTypes.includes('specific_variants')) {
    return false;
  }

  if (supportedDetailTypes.length > 0) {
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

function collectSupportFactualEvidence(
  match: NonNullable<ApprovedResponseContext['documentContext']>['matches'][number],
) {
  return match.supportSummary?.axisSummaries ?? [];
}

function collectSupportMetadataNotes(
  match: NonNullable<ApprovedResponseContext['documentContext']>['matches'][number],
  layers?: Array<'prudence' | 'workflow' | 'guidance'>,
) {
  const notes = match.supportSummary?.metadataNotes ?? [];

  if (!layers || layers.length === 0) {
    return notes;
  }

  const allowedLayers = new Set(layers);
  return notes.filter((note) => allowedLayers.has(note.layer));
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

function buildNaturalColorSummary(
  locale: string,
  claims: DocumentKnowledgeAxisSummary[],
) {
  const colorClaims = claims.filter(
    (claim) =>
      claim.axis === 'color_options' &&
      claim.supportClass === 'explicit_fact' &&
      claim.values.length > 0,
  );

  if (colorClaims.length === 0) {
    return '';
  }

  const scopedSummaries = colorClaims
    .map((claim) => {
      const material = claim.appliesTo?.find(
        (scope) => scope.axis === 'material',
      )?.value;
      const values = Array.from(
        new Set(
          claim.values
            .map((value) => formatInlineResponseValue(value))
            .filter(Boolean),
        ),
      );

      if (!material || values.length === 0) {
        return null;
      }

      const materialLabel = formatScopeDisplayValue(material);

      if (values.length === 1) {
        return renderGroundingPolicyTemplate({
          locale,
          templateKey: 'colorSingleScoped',
          values: {
            scope: materialLabel,
            values: values[0],
          },
        });
      }

      return renderGroundingPolicyTemplate({
        locale,
        templateKey: 'colorMultipleScoped',
        values: {
          scope: materialLabel,
          values: formatLocalizedList(values, locale, 'conjunction'),
        },
      });
    })
    .filter((value): value is string => Boolean(value));

  if (scopedSummaries.length > 0) {
    return scopedSummaries.join(' ');
  }

  const values = Array.from(
    new Set(
      colorClaims.flatMap((claim) =>
        claim.values
          .map((value) => formatInlineResponseValue(value))
          .filter(Boolean),
      ),
    ),
  );

  if (values.length === 0) {
    return '';
  }

  if (values.length === 1) {
    return renderGroundingPolicyTemplate({
      locale,
      templateKey: 'colorSingleGeneric',
      values: {
        values: values[0],
      },
    });
  }

  return renderGroundingPolicyTemplate({
    locale,
    templateKey: 'colorMultipleGeneric',
    values: {
      values: formatLocalizedList(values, locale, 'conjunction'),
    },
  });
}

function buildNaturalPaymentSummary(
  locale: string,
  claims: DocumentKnowledgeAxisSummary[],
) {
  const paymentMethodValues = Array.from(
    new Set(
      claims
        .filter(
          (claim) =>
            claim.axis === 'payment_methods' &&
            claim.supportClass === 'explicit_fact',
        )
        .flatMap((claim) =>
          claim.values
            .map((value) => formatInlineResponseValue(value))
            .filter(Boolean),
        ),
    ),
  );
  const installmentClaims = claims.filter(
    (claim) =>
      (claim.axis === 'payment_terms' && claim.facet === 'installment_count') ||
      claim.axis === 'installment_count',
  );
  const cardBrandClaims = claims.filter(
    (claim) => claim.axis === 'payment_terms' && claim.facet === 'card_brands',
  );
  const sentences: string[] = [];

  if (paymentMethodValues.length > 0) {
    sentences.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'paymentMethods',
        values: {
          values: formatLocalizedList(paymentMethodValues, locale, 'conjunction'),
        },
      }),
    );
  }

  const mercadoPagoInstallmentClaim = installmentClaims.find((claim) =>
    (claim.appliesTo ?? []).some(
      (scope) =>
        scope.axis === 'payment_method' &&
        (scope.normalizedValue ?? scope.value).toLowerCase() === 'mercado pago',
    ),
  );
  const mercadoPagoCardClaim = cardBrandClaims.find((claim) =>
    (claim.appliesTo ?? []).some(
      (scope) =>
        scope.axis === 'payment_method' &&
        (scope.normalizedValue ?? scope.value).toLowerCase() === 'mercado pago',
    ),
  );
  const installmentValue = mercadoPagoInstallmentClaim?.values[0]?.trim() ?? '';
  const cardValues = Array.from(
    new Set(
      (mercadoPagoCardClaim?.values ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  if (installmentValue && cardValues.length > 0) {
    sentences.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'paymentMercadoPagoInstallmentsAndCards',
        values: {
          installments: installmentValue,
          cards: formatLocalizedList(cardValues, locale, 'conjunction'),
        },
      }),
    );
  } else if (installmentValue) {
    sentences.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'paymentMercadoPagoInstallments',
        values: {
          installments: installmentValue,
        },
      }),
    );
  } else if (cardValues.length > 0) {
    sentences.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'paymentMercadoPagoCards',
        values: {
          cards: formatLocalizedList(cardValues, locale, 'conjunction'),
        },
      }),
    );
  }

  if (sentences.length === 0) {
    return '';
  }

  return sentences.join(' ');
}

function buildNaturalPurchaseChannelSummary(
  locale: string,
  claims: DocumentKnowledgeAxisSummary[],
) {
  const presenceClaims = claims.filter(
    (claim) =>
      claim.axis === 'commercial_presence' &&
      claim.supportClass === 'explicit_fact' &&
      claim.values.length > 0,
  );
  const serviceOfferValues = Array.from(
    new Set(
      claims
        .filter(
          (claim) =>
            claim.axis === 'service_offers' &&
            claim.supportClass === 'explicit_fact',
        )
        .flatMap((claim) => claim.values)
        .map((value) => normalizeDocumentKnowledgeText(value))
        .filter(Boolean),
    ),
  );
  const coverageValues = Array.from(
    new Set(
      claims
        .filter(
          (claim) =>
            claim.axis === 'coverage_locations' &&
            claim.supportClass === 'explicit_fact',
        )
        .flatMap((claim) => claim.values)
        .map((value) => formatScopeDisplayValue(value))
        .filter(Boolean),
    ),
  );
  const normalizedPresenceValues = new Set(
    presenceClaims.flatMap((claim) =>
      claim.values
        .map((value) => normalizeDocumentKnowledgeText(value))
        .filter(Boolean),
    ),
  );
  const sentences: string[] = [];
  const isSpanish = usesSpanishResponseFamily(locale);
  const hasNoPhysicalStore =
    normalizedPresenceValues.has('sin local comercial') ||
    normalizedPresenceValues.has('no physical store');
  const hasPhysicalStore =
    normalizedPresenceValues.has('con local comercial') ||
    normalizedPresenceValues.has('physical store');
  const hasOnlineAttention =
    normalizedPresenceValues.has('atencion online') ||
    normalizedPresenceValues.has('online attention');

  if (hasPhysicalStore) {
    sentences.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'purchaseChannelHasStore',
        values: {},
      }),
    );
  } else if (hasNoPhysicalStore) {
    sentences.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'purchaseChannelNoStore',
        values: {},
      }),
    );
  }

  if (hasOnlineAttention) {
    sentences.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'purchaseChannelOnlineAttention',
        values: {},
      }),
    );
  }

  const offersHomeVisit = serviceOfferValues.some(
    (value) => value.includes('visita') || value.includes('home visit'),
  );
  const offersSamples = serviceOfferValues.some(
    (value) => value.includes('muestra') || value.includes('sample'),
  );
  const offersMeasurements = serviceOfferValues.some(
    (value) =>
      value.includes('medidas') ||
      value.includes('measurement') ||
      value.includes('relevamiento'),
  );
  const montevideo = coverageValues.find(
    (value) => normalizeDocumentKnowledgeText(value) === 'montevideo',
  );

  if (offersHomeVisit) {
    const actions = [
      offersSamples
        ? isSpanish
          ? 'mostrarte el producto'
          : 'show you the product'
        : '',
      offersMeasurements
        ? isSpanish
          ? 'tomar medidas'
          : 'take measurements'
        : '',
    ].filter(Boolean);
    const actionText =
      actions.length > 0
        ? isSpanish
          ? ` para ${formatLocalizedList(actions, locale, 'conjunction')}`
          : ` to ${formatLocalizedList(actions, locale, 'conjunction')}`
        : '';

    if (montevideo) {
      const locationLabel = formatScopeDisplayValue(montevideo);
      sentences.push(
        renderGroundingPolicyTemplate({
          locale,
          templateKey: 'purchaseChannelVisitWithLocation',
          values: {
            location: locationLabel,
            actionText,
          },
        }),
      );
    } else {
      sentences.push(
        renderGroundingPolicyTemplate({
          locale,
          templateKey: 'purchaseChannelVisitGeneric',
          values: {
            actionText,
          },
        }),
      );
    }
  }

  return sentences.join(' ').trim();
}

function buildNaturalServiceCapabilitySummary(
  locale: string,
  factualClaims: DocumentKnowledgeAxisSummary[],
  behavioralNotes: DocumentKnowledgeMetadataSummary[],
  subject?: string,
  queryText?: string,
) {
  const inferredSubjectLabels = Array.from(
    new Set(
      factualClaims
        .map((claim) =>
          extractDisplayTopicLabel(
            claim.subject?.value ?? claim.subject?.normalizedValue,
          ),
        )
        .filter((value) => value.length > 0),
    ),
  );
  const allServiceOfferValues = Array.from(
    new Set(
      factualClaims
        .filter(
          (claim) =>
            claim.axis === 'service_offers' &&
            claim.supportClass === 'explicit_fact',
        )
        .flatMap((claim) => claim.values)
        .map((value) => normalizeDocumentKnowledgeText(value))
        .filter(Boolean),
    ),
  );
  const queryTokens = tokenizeSummaryText(queryText ?? '').filter(
    (token) => token.length >= 4,
  );
  const overlappingServiceOfferValues =
    queryTokens.length === 0
      ? []
      : allServiceOfferValues.filter((value) => {
          const valueTokens = tokenizeSummaryText(value).filter(
            (token) => token.length >= 4,
          );
          return valueTokens.some((token) => queryTokens.includes(token));
        });
  const serviceOfferValues =
    overlappingServiceOfferValues.length > 0
      ? overlappingServiceOfferValues
      : allServiceOfferValues;
  const organicPatterns = behavioralNotes
    .filter(
      (note) =>
        note.axis === 'organic_response_pattern' &&
        note.values.length > 0,
    )
    .flatMap((note) => note.values)
    .map((value) => toCustomerFacingSummaryText(value))
    .filter(Boolean);
  const normalizedSubject =
    extractDisplayTopicLabel(subject) ||
    (inferredSubjectLabels.length === 1 ? inferredSubjectLabels[0] ?? '' : '');
  const isSpanish = usesSpanishResponseFamily(locale);
  const offersVisit = serviceOfferValues.some(
    (value) => value.includes('visita') || value.includes('home visit'),
  );
  const offersMeasurement = serviceOfferValues.some(
    (value) =>
      value.includes('medidas') ||
      value.includes('measurement') ||
      value.includes('relevamiento'),
  );
  const offersInstallation = serviceOfferValues.some(
    (value) => value.includes('instal') || value.includes('installation'),
  );
  const offersRepair = serviceOfferValues.some(
    (value) => value.includes('repara') || value.includes('repair'),
  );
  const offersMaintenance = serviceOfferValues.some(
    (value) => value.includes('manten') || value.includes('maintenance'),
  );
  const offersAutomation = serviceOfferValues.some(
    (value) => value.includes('automat') || value.includes('automation'),
  );
  const offersMotorization = serviceOfferValues.some(
    (value) => value.includes('motoriz') || value.includes('motorization'),
  );
  const clauses: string[] = [];

  if (offersVisit && offersMeasurement) {
    clauses.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'serviceCapabilityClauseVisitAndMeasurements',
        values: {},
      }),
    );
  } else if (offersVisit) {
    clauses.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'serviceCapabilityClauseVisitOnly',
        values: {},
      }),
    );
  } else if (offersMeasurement) {
    clauses.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'serviceCapabilityClauseMeasurementsOnly',
        values: {},
      }),
    );
  }

  if (offersInstallation) {
    clauses.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'serviceCapabilityClauseInstallation',
        values: {},
      }),
    );
  }

  if (offersAutomation && offersMotorization) {
    clauses.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'serviceCapabilityClauseAutomationAndMotorization',
        values: {},
      }),
    );
  } else if (offersAutomation) {
    clauses.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'serviceCapabilityClauseAutomation',
        values: {},
      }),
    );
  } else if (offersMotorization) {
    clauses.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'serviceCapabilityClauseMotorization',
        values: {},
      }),
    );
  }

  if (offersRepair && offersMaintenance) {
    clauses.push(
      renderGroundingPolicyTemplate({
        locale,
        templateKey: 'serviceCapabilityClauseRepairAndMaintenance',
        values: {},
      }),
    );
  } else {
    if (offersRepair) {
      clauses.push(
        renderGroundingPolicyTemplate({
          locale,
          templateKey: 'serviceCapabilityClauseRepair',
          values: {},
        }),
      );
    }

    if (offersMaintenance) {
      clauses.push(
        renderGroundingPolicyTemplate({
          locale,
          templateKey: 'serviceCapabilityClauseMaintenance',
          values: {},
        }),
      );
    }
  }

  if (clauses.length > 0) {
    const subjectTail = normalizedSubject
      ? isSpanish
        ? ` para ${normalizedSubject}`
        : ` for ${normalizedSubject}`
      : '';
    const localizedClauses = [
      normalizeStandaloneServiceCapabilityClause(
        `${clauses[0]}${subjectTail}`,
        locale,
      ),
      ...clauses.slice(1),
    ];

    if (localizedClauses.length === 1) {
      return renderGroundingPolicyTemplate({
        locale,
        templateKey: 'serviceCapabilityYesSingle',
        values: {
          clauses: localizedClauses[0],
        },
      });
    }

    return renderGroundingPolicyTemplate({
      locale,
      templateKey: 'serviceCapabilityYesMultiple',
      values: {
        clauses: formatLocalizedList(localizedClauses, locale, 'conjunction'),
      },
    });
  }

  return organicPatterns[0] ?? '';
}

function normalizeStandaloneServiceCapabilityClause(
  value: string,
  locale: string,
) {
  const trimmed = value.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (usesSpanishResponseFamily(locale)) {
    return trimmed.replace(/^también\s+/iu, '');
  }

  return trimmed.replace(/^also\s+/iu, '');
}

function buildNaturalQuoteRequirementsSummary(
  locale: string,
  notes: DocumentKnowledgeMetadataSummary[],
) {
  const quoteFieldClaims = notes.filter(
    (note) =>
      note.axis === 'quote_fields' &&
      note.layer === 'workflow' &&
      note.supportClass === 'explicit_fact' &&
      note.values.length > 0,
  );
  const quoteTransitionClaims = notes.filter(
    (note) =>
      note.axis === 'quote_transition' &&
      note.layer === 'guidance' &&
      note.values.length > 0,
  );
  const quoteFieldValues = Array.from(
    new Set(
      quoteFieldClaims.flatMap((claim) =>
        claim.values.map((value) => formatInlineResponseValue(value)).filter(Boolean),
      ),
    ),
  );

  if (quoteFieldValues.length > 0) {
    return renderGroundingPolicyTemplate({
      locale,
      templateKey: 'quoteRequirementsFields',
      values: {
        values: formatLocalizedList(quoteFieldValues, locale, 'conjunction'),
      },
    });
  }

  const transitionValues = Array.from(
    new Set(
      quoteTransitionClaims.flatMap((claim) =>
        claim.values.map((value) => formatInlineResponseValue(value)).filter(Boolean),
      ),
    ),
  );

  if (transitionValues.length === 0) {
    return '';
  }

  return renderGroundingPolicyTemplate({
    locale,
    templateKey: 'quoteRequirementsTransition',
    values: {
      values: formatLocalizedList(transitionValues, locale, 'conjunction'),
    },
  });
}

function buildNaturalRecommendationSummary(
  locale: string,
  factualClaims: DocumentKnowledgeAxisSummary[],
  guidanceNotes: DocumentKnowledgeMetadataSummary[],
  subjectHint = '',
) {
  const guidanceClaims = guidanceNotes.filter(
    (note) =>
      note.axis === 'comparison_guidance' &&
      note.layer === 'guidance' &&
      note.values.length > 0,
  );
  const alignedGuidanceClaims =
    subjectHint.length > 0
      ? guidanceClaims.filter((claim) =>
          isRecommendationGuidanceAligned(subjectHint, claim),
        )
      : guidanceClaims;
  const preferredGuidanceClaims =
    subjectHint.length > 0 ? alignedGuidanceClaims : guidanceClaims;

  if (preferredGuidanceClaims.length > 0) {
    const guidanceAlternativeValues = Array.from(
      new Set(
        preferredGuidanceClaims.flatMap((claim) =>
          extractGuidanceAlternativeValues(
            claim.subject?.value ?? claim.subject?.normalizedValue ?? '',
          ),
        ),
      ),
    );

    if (subjectHint && guidanceAlternativeValues.length > 0) {
      return renderGroundingPolicyTemplate({
        locale,
        templateKey: 'recommendationMaterialsOrientation',
        values: {
          subject: subjectHint,
          materials: formatLocalizedList(
            guidanceAlternativeValues,
            locale,
            'conjunction',
          ),
        },
      });
    }

    const bestGuidanceSummary = preferredGuidanceClaims
      .map((claim) => toCustomerFacingSummaryText(claim.values[0] ?? ''))
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => {
        const leftSentenceCount = splitSummarySentences(left).length;
        const rightSentenceCount = splitSummarySentences(right).length;

        if (leftSentenceCount !== rightSentenceCount) {
          return leftSentenceCount - rightSentenceCount;
        }

        return left.length - right.length;
      })[0];

    if (bestGuidanceSummary) {
      return bestGuidanceSummary;
    }
  }

  const suitabilityClaims = factualClaims.filter(
    (claim) =>
      claim.axis === 'suitability' &&
      claim.supportClass === 'explicit_fact' &&
      claim.values.length > 0,
  );

  if (suitabilityClaims.length > 0) {
    const first = suitabilityClaims[0];
    const subject = extractDisplayTopicLabel(
      first.subject?.value ?? first.subject?.normalizedValue,
    );
    const useCases = first.values.map((value) => formatInlineResponseValue(value));
    const isSpanish = usesSpanishResponseFamily(locale);

    if (subject && useCases.length > 0) {
      return renderGroundingPolicyTemplate({
        locale,
        templateKey: 'recommendationSuitability',
        values: {
          useCases: formatLocalizedList(useCases, locale, 'conjunction'),
          subject,
        },
      });
    }
  }

  const materialClaims = factualClaims.filter(
    (claim) =>
      claim.axis === 'materials' &&
      claim.supportClass === 'explicit_fact' &&
      claim.values.length > 0,
  );
  const materialValues = Array.from(
    new Set(
      materialClaims.flatMap((claim) =>
        claim.values.map((value) => formatInlineResponseValue(value)),
      ),
    ),
  );

  if (materialValues.length > 0) {
    const subject =
      extractDisplayTopicLabel(
        materialClaims[0]?.subject?.value ??
          materialClaims[0]?.subject?.normalizedValue ??
          '',
      ) || subjectHint;

    if (subject) {
      return renderGroundingPolicyTemplate({
        locale,
        templateKey: 'recommendationMaterialsOrientation',
        values: {
          subject,
          materials: formatLocalizedList(materialValues, locale, 'conjunction'),
        },
      });
    }
  }

  return '';
}

function buildNaturalMaterialsSummary(
  locale: string,
  claims: DocumentKnowledgeAxisSummary[],
) {
  const materialClaims = claims.filter(
    (claim) =>
      claim.axis === 'materials' &&
      claim.supportClass === 'explicit_fact' &&
      claim.values.length > 0,
  );

  if (materialClaims.length === 0) {
    return '';
  }

  const materialValues = Array.from(
    new Set(
      materialClaims.flatMap((claim) =>
        claim.values.map((value) => formatInlineResponseValue(value)),
      ),
    ),
  );

  if (materialValues.length === 0) {
    return '';
  }

  const subject =
    extractDisplayTopicLabel(
      materialClaims[0]?.subject?.value ??
        materialClaims[0]?.subject?.normalizedValue ??
        '',
    ) || '';

  if (!subject) {
    return '';
  }

  return renderGroundingPolicyTemplate({
    locale,
    templateKey: 'broadOverviewMaterials',
    values: {
      subject,
      materials: formatLocalizedList(materialValues, locale, 'conjunction'),
    },
  });
}

function buildMetadataBackedSummary(summary: DocumentKnowledgeMetadataSummary) {
  const subject = extractDisplayTopicLabel(
    summary.subject?.value ?? summary.subject?.normalizedValue,
  );
  const values = summary.values
    .map((value) => formatInlineResponseValue(value))
    .filter(Boolean)
    .join(' ');

  return [summary.axis, subject, values].filter(Boolean).join(' ');
}

function isRecommendationGuidanceAligned(
  subjectHint: string,
  note: DocumentKnowledgeMetadataSummary,
) {
  const normalizedHint = extractDisplayTopicLabel(subjectHint);
  const normalizedSubject = extractDisplayTopicLabel(
    note.subject?.value ?? note.subject?.normalizedValue,
  );

  if (!normalizedHint || !normalizedSubject) {
    return true;
  }

  const hintTokens = new Set(tokenizeSummaryText(normalizedHint));
  const subjectTokens = tokenizeSummaryText(normalizedSubject);

  return (
    normalizedHint.includes(normalizedSubject) ||
    normalizedSubject.includes(normalizedHint) ||
    subjectTokens.some((token) => hintTokens.has(token))
  );
}

function extractGuidanceAlternativeValues(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\s*(?:,|;|\/|\b(?:y|e|o|and|or)\b)\s*/iu)
    .map((entry) => formatInlineResponseValue(entry))
    .filter((entry) => entry.length > 0);
}

function buildNaturalWarrantySummary(
  locale: string,
  claims: DocumentKnowledgeAxisSummary[],
) {
  const warrantyClaims = claims.filter(
    (claim) =>
      claim.axis === 'warranty_terms' &&
      claim.supportClass === 'explicit_fact' &&
      claim.values.length > 0,
  );

  if (warrantyClaims.length === 0) {
    return '';
  }

  const scopedClaims = warrantyClaims
    .map((claim) => {
      const material = claim.appliesTo?.find(
        (scope) => scope.axis === 'material',
      )?.value;
      const value = claim.values[0]?.trim();

      if (!material || !value) {
        return null;
      }

      return {
        material: formatScopeDisplayValue(material),
        value,
      };
    })
    .filter(
      (
        value,
      ): value is {
        material: string;
        value: string;
      } => Boolean(value),
    );

  if (scopedClaims.length > 0) {
    const uniqueValues = Array.from(
      new Set(scopedClaims.map((claim) => claim.value)),
    );

    if (uniqueValues.length === 1) {
      const materials = scopedClaims.map((claim) => claim.material);

      if (materials.length === 2) {
        return renderGroundingPolicyTemplate({
          locale,
          templateKey: 'warrantySingleSharedTwoMaterials',
          values: {
            value: uniqueValues[0],
            firstMaterial: materials[0],
            secondMaterial: materials[1],
          },
        });
      }

      return renderGroundingPolicyTemplate({
        locale,
        templateKey: 'warrantySingleSharedManyMaterials',
        values: {
          value: uniqueValues[0],
          materials: formatLocalizedList(materials, locale, 'conjunction'),
        },
      });
    }

    return scopedClaims
      .map((claim) =>
        renderGroundingPolicyTemplate({
          locale,
          templateKey: 'warrantyScoped',
          values: {
            scope: claim.material,
            value: claim.value,
          },
        }),
      )
      .join(' ');
  }

  const values = Array.from(
    new Set(warrantyClaims.flatMap((claim) => claim.values.map((value) => value.trim()))),
  ).filter(Boolean);

  if (values.length === 0) {
    return '';
  }

  if (values.length === 1) {
    return renderGroundingPolicyTemplate({
      locale,
      templateKey: 'warrantySingleGeneric',
      values: {
        value: values[0],
      },
    });
  }

  return renderGroundingPolicyTemplate({
    locale,
    templateKey: 'warrantyMultipleGeneric',
    values: {
      values: formatLocalizedList(values, locale, 'conjunction'),
    },
  });
}

function formatScopeDisplayValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (/^[A-Z0-9]+$/u.test(trimmed) && trimmed.length <= 5) {
    return trimmed;
  }

  if (/^[A-ZÁÉÍÓÚÜÑ\s]+$/u.test(trimmed)) {
    return trimmed.toLocaleLowerCase();
  }

  return trimmed;
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

function formatConcreteOutOfDomainSubjectList(
  locale: string,
  subjects: string[],
) {
  const normalizedSubjects = subjects
    .map((subject) => subject.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);

  if (normalizedSubjects.length <= 1) {
    return normalizedSubjects[0] ?? '';
  }

  if (usesSpanishResponseFamily(locale)) {
    const [firstSubject, ...remainingSubjects] = normalizedSubjects;
    return [
      firstSubject,
      ...remainingSubjects.map((subject) => `con ${subject}`),
    ].join(' ni ');
  }

  return formatLocalizedList(normalizedSubjects, locale, 'disjunction');
}

function usesSpanishResponseFamily(locale: string) {
  return resolveResponseGroundingLocaleFamily(locale) === 'es';
}

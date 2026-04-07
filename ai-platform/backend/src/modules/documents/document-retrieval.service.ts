import { Injectable } from '@nestjs/common';

import type {
  ContinuityAwareInterpretation,
  ConversationStateSnapshot,
} from '../continuity/continuity.types';
import {
  normalizeConversationSignalText,
  resolveConversationSignalCatalog,
  tokenizeConversationSignalText,
} from '../conversation-signals/conversation-signal.catalogs';
import { ConversationSignalResolverService } from '../conversation-signals/conversation-signal-resolver.service';
import type { ConversationRoutingSignals } from '../conversation-signals/conversation-signal.types';
import type { DecisionResult } from '../decision/decision.types';
import { DocumentChunkRepository } from '../persistence/repositories/document-chunk.repository';
import {
  assessRequestedGroundingDetails,
  isUserBackedGroundingDetailAssessment,
  resolveResponseGroundingCatalog,
} from '../response/response-grounding.catalogs';
import type { ResponseGroundingDetailType } from '../response/response.types';
import { classifyDocumentChunkUsageBoundary } from './document-chunk-boundary';
import { composeActiveCorpusByLayer } from './document-corpus';
import {
  buildStructuralKnowledgeSummary,
  extractStructuredKnowledgeClaims,
  extractKnowledgeAxisSummaries,
  extractKnowledgeMetadataSummaries,
  resolveStructuralKnowledgeAxisLabel,
} from './document-knowledge-claims';
import {
  buildKnowledgePropositionSummary,
  buildStructuralKnowledgePropositionSummary,
  extractStructuredKnowledgePropositions,
} from './document-knowledge-propositions';
import {
  DocumentRetrievalAttempt,
  DocumentRetrievalResult,
} from './document.types';

@Injectable()
export class DocumentRetrievalService {
  constructor(
    private readonly documentChunkRepository: DocumentChunkRepository,
    private readonly conversationSignalResolver: ConversationSignalResolverService,
  ) {}

  async retrieveForConversation(input: {
    message: string;
    interpretation: ContinuityAwareInterpretation;
    conversationState?: ConversationStateSnapshot | null;
    signals?: ConversationRoutingSignals | null;
  }): Promise<DocumentRetrievalAttempt> {
    const signals =
      input.signals ??
      this.conversationSignalResolver.resolve({
        message: input.message,
        interpretation: input.interpretation,
        conversationState: input.conversationState,
      });
    const previousTopic = this.resolveConversationTopic(input.conversationState);
    const previousDocumentQuery = this.resolvePreviousDocumentQuery(
      input.conversationState,
    );
    const explicitSubjectTopic = resolveExplicitSubjectTopic(
      input.interpretation.entities,
    );
    const reason = this.resolveReason(input, signals);

    if (reason === 'not_requested') {
      return {
        attempted: false,
        reason,
        result: null,
      };
    }

    const query = this.resolveQuery(
      input,
      reason,
      signals,
      previousTopic,
      previousDocumentQuery,
      explicitSubjectTopic,
    );
    const queryTokens = tokenizeQuery(query, input.interpretation.language);
    const currentFocusText = this.resolveRawMessage(input);
    const segmentQueries = resolveSupplementalSegmentQueries(
      currentFocusText || query,
      input.interpretation.language,
    );
    const focusTokens =
      previousTopic || previousDocumentQuery
        ? tokenizeQuery(currentFocusText, input.interpretation.language)
        : [];
    const preferredTopicText = resolvePreferredTopicText({
      currentTopic: signals.topicText || this.resolveRawMessage(input),
      previousTopic,
      explicitSubjectTopic,
      locale: input.interpretation.language,
    });
    const preferredTopicTokens = preferredTopicText
      ? tokenizeQuery(preferredTopicText, input.interpretation.language)
      : [];
    const explicitSubjectTokens = explicitSubjectTopic
      ? tokenizeSubjectQuery(explicitSubjectTopic, input.interpretation.language)
      : [];
    const requestedDetailAssessments = assessRequestedGroundingDetails({
      locale: input.interpretation.language,
      userText: currentFocusText || input.message,
      queryText: query,
    });
    const currentFocusDetailAssessments = assessRequestedGroundingDetails({
      locale: input.interpretation.language,
      userText: currentFocusText || input.message,
      queryText: currentFocusText || input.message,
    });
    const requestedDetailTypes = requestedDetailAssessments.map(
      (entry) => entry.detailType,
    );
    const primaryRequestedDetailType =
      requestedDetailAssessments[0]?.detailType ?? null;
    const userBackedServiceCapability = requestedDetailAssessments.some(
      (entry) =>
        entry.detailType === 'service_capability' &&
        isUserBackedGroundingDetailAssessment(entry),
    );
    const userBackedSpecificVariants = requestedDetailAssessments.some(
      (entry) =>
        entry.detailType === 'specific_variants' &&
        isUserBackedGroundingDetailAssessment(entry),
    );
    const recommendationPrimaryFocus =
      primaryRequestedDetailType === 'recommendation' &&
      requestedDetailAssessments.some(
        (entry) =>
          entry.detailType === 'recommendation' &&
          isUserBackedGroundingDetailAssessment(entry),
      );
    const actionScopedRequestedDetails = hasActionScopedRequestedDetails(
      requestedDetailTypes,
      input.interpretation.language,
    ) && !(recommendationPrimaryFocus && !userBackedServiceCapability);
    const serviceCapabilityContinuationFocus =
      reason === 'active_document_continuation' &&
      requestedDetailTypes.includes('service_capability') &&
      actionScopedRequestedDetails;
    const recommendationContinuationFocus =
      reason === 'active_document_continuation' &&
      recommendationPrimaryFocus &&
      !userBackedServiceCapability;
    const specificVariantsContinuationFocus =
      reason === 'active_document_continuation' && userBackedSpecificVariants;
    const clarificationCarryoverFocus =
      reason === 'active_document_continuation' &&
      Boolean(explicitSubjectTopic) &&
      requestedDetailTypes.length > 0 &&
      !currentFocusDetailAssessments.some((entry) =>
        isUserBackedGroundingDetailAssessment(entry),
      );
    const effectiveFocusTokens =
      serviceCapabilityContinuationFocus ||
      recommendationContinuationFocus ||
      specificVariantsContinuationFocus ||
      clarificationCarryoverFocus
      ? queryTokens
      : focusTokens;
    const preferPrimaryRequestedDetail =
      primaryRequestedDetailType !== null &&
      requestedDetailAssessments.some(
        (entry) =>
          entry.detailType === primaryRequestedDetailType &&
          isUserBackedGroundingDetailAssessment(entry),
      );

    if (queryTokens.length === 0) {
      return {
        attempted: true,
        reason,
        result: null,
      };
    }

    const activeDocumentIds = this.resolveActiveDocumentIds(
      input.conversationState,
    );
    const allActiveChunks = await this.documentChunkRepository.listActiveReadyChunks(
      600,
      activeDocumentIds,
    );
    const chunks = composeActiveCorpusByLayer(allActiveChunks).chunks;
    const scored = chunks
      .map((chunk) => {
        const usageBoundary = classifyDocumentChunkUsageBoundary({
          content: chunk.content,
          metadata:
            chunk.metadata && typeof chunk.metadata === 'object' && !Array.isArray(chunk.metadata)
              ? (chunk.metadata as Record<string, unknown>)
              : null,
        });
        const structuralText = buildChunkStructuralText(chunk);
        const scopeAlignmentScore = scoreScopeAlignment(
          chunk.knowledgeItems ?? [],
          effectiveFocusTokens,
          input.interpretation.language,
        );
        const axisAlignmentScore = scoreAxisAlignment(
          chunk.knowledgeItems ?? [],
          effectiveFocusTokens,
          input.interpretation.language,
        );
        const actionCapabilityScore = scoreActionCapabilityRelevance(
          chunk.knowledgeItems ?? [],
          effectiveFocusTokens.length > 0 ? effectiveFocusTokens : queryTokens,
          input.interpretation.language,
        );
        const recommendationOrientationScore = scoreRecommendationOrientationRelevance(
          chunk.knowledgeItems ?? [],
          effectiveFocusTokens.length > 0 ? effectiveFocusTokens : queryTokens,
          input.interpretation.language,
        );
        const recommendationEvidenceTier = resolveRecommendationEvidenceTier(
          chunk.knowledgeItems ?? [],
        );
        const requestedDetailAlignmentScore = scoreRequestedDetailAxisAlignment(
          chunk.knowledgeItems ?? [],
          requestedDetailTypes,
          input.interpretation.language,
        );
        const requestedDetailTextAlignmentScore = scoreRequestedDetailTextAlignment(
          [chunk.searchText, chunk.retrievalProjection ?? '', structuralText].join(' '),
          requestedDetailTypes,
          input.interpretation.language,
        );
        const detailDriftPenalty = scoreRequestedDetailDriftPenalty(
          chunk.knowledgeItems ?? [],
          {
            locale: input.interpretation.language,
            primaryDetailType: primaryRequestedDetailType,
            preferRecommendation: recommendationContinuationFocus,
            preferPrimaryRequestedDetail,
          },
        );
        const subjectTokens = extractChunkSubjectTokens(
          chunk,
          input.interpretation.language,
        );
        const exactSubjectAlignmentScore = scoreExactSubjectAlignment(
          subjectTokens,
          explicitSubjectTokens,
        );
        const structuralTopicOverlap = scoreTopicTokenOverlap(
          structuralText,
          preferredTopicTokens,
        );
        const segmentScores = segmentQueries.map((segment) =>
          scoreChunk(
            segment.text,
            segment.tokens,
            segment.tokens,
            chunk.searchText,
            chunk.retrievalProjection,
            structuralText,
            chunk.knowledgeItems,
            input.interpretation.language,
            {
              activeDocumentIds,
              preferredTopicTokens: segment.preferredTopicTokens,
              hasTopicCarryover: false,
              activeDocumentMatch:
                Boolean(activeDocumentIds?.includes(chunk.documentId)),
              usageBoundary,
              structuralTopicOverlap: scoreTopicTokenOverlap(
                structuralText,
                segment.preferredTopicTokens,
              ),
              axisAlignmentScore,
              axisFocusActive: true,
            },
          ) +
            exactSubjectAlignmentScore *
              (actionScopedRequestedDetails ? 1 : 2) +
            requestedDetailAlignmentScore +
            requestedDetailTextAlignmentScore * 2 +
            (actionScopedRequestedDetails ? actionCapabilityScore * 1.5 : 0) +
            (recommendationContinuationFocus
              ? recommendationOrientationScore * 2
              : 0) -
            (recommendationContinuationFocus
              ? recommendationEvidenceTier * 2
              : 0) -
            detailDriftPenalty,
        );

        return {
          chunk,
          usageBoundary,
          richness: computeChunkRichness(chunk),
          structuralTopicOverlap,
          scopeAlignmentScore,
          axisAlignmentScore,
          actionCapabilityScore,
          recommendationOrientationScore,
          recommendationEvidenceTier,
          requestedDetailAlignmentScore,
          requestedDetailTextAlignmentScore,
          detailDriftPenalty,
          subjectTokens,
          exactSubjectAlignmentScore,
          segmentScores,
          claimSummary: buildClaimBackedSummary(
            chunk,
            effectiveFocusTokens.length > 0 ? effectiveFocusTokens : queryTokens,
            input.interpretation.language,
          ),
          propositionSummary: buildPropositionBackedSummary(
            chunk,
            effectiveFocusTokens.length > 0 ? effectiveFocusTokens : queryTokens,
            input.interpretation.language,
          ),
          score: scoreChunk(
            query,
            queryTokens,
            effectiveFocusTokens,
            chunk.searchText,
            chunk.retrievalProjection,
            structuralText,
            chunk.knowledgeItems,
            input.interpretation.language,
            {
              activeDocumentIds,
              preferredTopicTokens,
              hasTopicCarryover:
                Boolean(previousTopic) && signals.threading.topicCarryoverEligible,
              activeDocumentMatch:
                Boolean(activeDocumentIds?.includes(chunk.documentId)),
              usageBoundary,
              structuralTopicOverlap,
              axisAlignmentScore,
              axisFocusActive: focusTokens.length > 0,
            },
          ) +
            exactSubjectAlignmentScore *
              (actionScopedRequestedDetails ? 1.5 : 4) +
            requestedDetailAlignmentScore +
            requestedDetailTextAlignmentScore * 2.5 +
            (actionScopedRequestedDetails ? actionCapabilityScore * 2 : 0) +
            (recommendationContinuationFocus
              ? recommendationOrientationScore * 3
              : 0) -
            (recommendationContinuationFocus
              ? recommendationEvidenceTier * 3
              : 0) -
            detailDriftPenalty,
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (right.richness !== left.richness) {
          return right.richness - left.richness;
        }

        if (right.exactSubjectAlignmentScore !== left.exactSubjectAlignmentScore) {
          return right.exactSubjectAlignmentScore - left.exactSubjectAlignmentScore;
        }

        return left.chunk.sequence - right.chunk.sequence;
      });
    const minimumScore = resolveMinimumScore(queryTokens.length, {
      hasTopicCarryover:
        Boolean(previousTopic) && signals.threading.topicCarryoverEligible,
      hasActiveDocumentIds: Boolean(activeDocumentIds?.length),
    });
    const matched = scored.filter((entry) => entry.score >= minimumScore);
    const relaxedMatched =
      matched.length > 0 || reason === 'document_query'
        ? matched
        : scored.filter((entry) => entry.score >= Math.max(1, minimumScore - 1));
    const axisLockedMatched = filterAxisLockedMatches(
      relaxedMatched,
      effectiveFocusTokens,
    );
    const actionLockedMatched = filterActionLockedMatches(
      axisLockedMatched,
      effectiveFocusTokens,
    );
    const detailLockedMatched = filterRequestedDetailMatches(
      actionLockedMatched,
      requestedDetailTypes,
      input.interpretation.language,
    );
    const coherentMatched = filterStructurallyCoherentMatches(
      detailLockedMatched,
      preferredTopicTokens,
      requestedDetailTypes,
      input.interpretation.language,
    );
    const exactSubjectMatched = filterExactSubjectMatches(
      coherentMatched,
      explicitSubjectTokens,
      requestedDetailTypes,
      input.interpretation.language,
    );
    const diversifiedMatched = diversifySupplementalSegmentMatches(
      exactSubjectMatched,
      scored,
      segmentQueries.length,
      minimumScore,
    );
    const primaryRequestedDetailPromotedMatched =
      preferPrimaryRequestedDetail && primaryRequestedDetailType
        ? promotePrimaryRequestedDetailMatches(
            diversifiedMatched,
            scored,
          )
        : diversifiedMatched;
    const recommendationPromotedMatched = recommendationContinuationFocus
      ? promoteRecommendationContinuationMatches(
          primaryRequestedDetailPromotedMatched,
          scored,
        )
      : primaryRequestedDetailPromotedMatched;
    const specificVariantsPromotedMatched = specificVariantsContinuationFocus
      ? promoteSpecificVariantsContinuationMatches(
          recommendationPromotedMatched,
          scored,
        )
      : recommendationPromotedMatched;
    const topMatched = specificVariantsPromotedMatched.slice(0, 4);

    if (topMatched.length === 0) {
      return {
        attempted: true,
        reason,
        result: {
          source: 'document_origin',
          query,
          groundedSummary: '',
          matches: [],
        },
      };
    }

    const matches = topMatched.map((entry) => ({
      documentId: entry.chunk.documentId,
      title: entry.chunk.document.title,
      excerpt: buildExcerpt(
        entry.chunk.content,
        effectiveFocusTokens.length > 0 ? effectiveFocusTokens : queryTokens,
      ),
      sequence: entry.chunk.sequence,
      score: Number(entry.score.toFixed(3)),
      supportSummary: buildChunkSupportSummary(entry.chunk),
    }));

    return {
      attempted: true,
      reason,
      result: {
        source: 'document_origin',
        query,
        groundedSummary: buildGroundedSummary(matches, queryTokens, {
          incremental:
            signals.threading.incrementalFollowUp ||
            reason === 'active_document_continuation',
          preferPrimaryExcerpt: actionScopedRequestedDetails,
          preferredSummaries: selectPreferredGroundedSummaries(topMatched, {
            requestedDetailTypes,
          }),
        }),
        matches,
      },
    };
  }

  withDecisionContext(
    attempt: DocumentRetrievalAttempt,
    decision: DecisionResult,
  ): DocumentRetrievalAttempt {
    if (
      !attempt.attempted ||
      !attempt.result ||
      decision.action !== 'invoke_tool' ||
      decision.toolName !== 'create_booking'
    ) {
      return attempt;
    }

    return {
      ...attempt,
      reason: 'combined_booking_document_query',
    };
  }

  private resolveReason(
    input: {
      message: string;
      interpretation: ContinuityAwareInterpretation;
      conversationState?: ConversationStateSnapshot | null;
    },
    signals: ConversationRoutingSignals,
  ) {
    if (signals.noise.channelInterference) {
      return 'not_requested' as const;
    }

    if (signals.document.explicitRequest) {
      return 'document_query' as const;
    }

    if (
      signals.document.continuationEligible &&
      !signals.threading.switchSuggested
    ) {
      return 'active_document_continuation' as const;
    }

    if (signals.threading.topicCarryoverEligible) {
      return 'knowledge_query' as const;
    }

    if (signals.document.implicitEligible) {
      return 'knowledge_query' as const;
    }

    if (this.shouldRetrieveTransactionalInformation(input, signals)) {
      return 'knowledge_query' as const;
    }

    return 'not_requested' as const;
  }

  private shouldRetrieveTransactionalInformation(
    input: {
      message: string;
      interpretation: ContinuityAwareInterpretation;
      conversationState?: ConversationStateSnapshot | null;
    },
    signals: ConversationRoutingSignals,
  ) {
    const rawMessage = this.resolveRawMessage(input);
    const activeLane =
      input.interpretation.continuity?.activeLane ??
      input.conversationState?.lane ??
      null;
    const transactionalIntent =
      input.interpretation.intent === 'CREATE_BOOKING' ||
      input.interpretation.intent === 'CREATE_QUOTE';
    const transactionalLane =
      input.interpretation.intent === 'CREATE_BOOKING'
        ? 'booking'
        : input.interpretation.intent === 'CREATE_QUOTE'
          ? 'quote'
          : activeLane === 'booking' || activeLane === 'quote'
            ? activeLane
            : null;
    const hasExplorationContext =
      activeLane === 'document_exploration' ||
      activeLane === 'advisory_exploration' ||
      input.conversationState?.lane === 'document_exploration' ||
      input.conversationState?.lane === 'advisory_exploration';
    const hasThreadedContext =
      hasExplorationContext ||
      Boolean(input.conversationState) ||
      Boolean(input.interpretation.continuity?.previousStateSummary);

    if (!transactionalIntent && !transactionalLane) {
      return false;
    }

    if (this.hasConcreteTransactionalProgression(input)) {
      return false;
    }

    if (signals.closure.supported || signals.noise.channelInterference) {
      return false;
    }

    return (
      signals.document.explicitRequest ||
      signals.document.implicitEligible ||
      signals.document.continuationEligible ||
      /[?¿]/u.test(rawMessage) ||
      signals.advisory.supported ||
      signals.advisory.questionLike ||
      hasExplorationContext ||
      (hasThreadedContext &&
        (signals.threading.topicCarryoverEligible ||
          signals.threading.activeContinuation ||
          signals.threading.shortFollowUp ||
          signals.threading.incrementalFollowUp))
    );
  }

  private hasConcreteTransactionalProgression(input: {
    message: string;
    interpretation: ContinuityAwareInterpretation;
    conversationState?: ConversationStateSnapshot | null;
  }) {
    return (
      input.interpretation.normalizedEntities.dates.length > 0 ||
      input.interpretation.normalizedEntities.measurements.length > 0 ||
      input.interpretation.normalizedEntities.dimensions.length > 0
    );
  }

  private resolveQuery(
    input: {
      message: string;
      interpretation: ContinuityAwareInterpretation;
      conversationState?: ConversationStateSnapshot | null;
    },
    reason: DocumentRetrievalAttempt['reason'],
    signals: ConversationRoutingSignals,
    previousTopic: string | null,
    previousDocumentQuery: string | null,
    explicitSubjectTopic: string | null,
  ) {
    const currentTopic = resolveRequestAwareTopic({
      currentTopic: signals.topicText || input.message.trim(),
      entities: input.interpretation.entities,
      locale: input.interpretation.language,
    });
    const currentRawMessage = this.resolveRawMessage(input);
    const briefFollowUp = isBriefFollowUpQuestion(currentRawMessage);
    const incrementalFacet = this.resolveIncrementalFacet({
      currentRawMessage,
      previousTopic,
      locale: input.interpretation.language,
    });

    if (
      (reason === 'document_query' || reason === 'knowledge_query') &&
      typeof signals.document.focusText === 'string' &&
      signals.document.focusText.trim().length > 0
    ) {
      const focusedQuery = signals.document.focusText.trim();
      const preferCurrentTopicForThinFocus = shouldPreferCurrentTopicForThinFocus({
        focusedQuery,
        currentTopic,
        explicitSubjectTopic,
        previousTopic,
        locale: input.interpretation.language,
      });
      const effectiveFocusedQuery = preferCurrentTopicForThinFocus
        ? resolvePivotQuery({
            currentTopic,
            explicitSubjectTopic,
            locale: input.interpretation.language,
          })
        : focusedQuery;

      if (preferCurrentTopicForThinFocus) {
        return effectiveFocusedQuery;
      }

      if (
        previousTopic &&
        signals.threading.activeContinuation &&
        effectiveFocusedQuery !== previousTopic
      ) {
        if (
          shouldPivotToCurrentTopic({
            currentTopic: effectiveFocusedQuery,
            previousTopic,
            explicitSubjectTopic,
            locale: input.interpretation.language,
          })
        ) {
          return resolvePivotQuery({
            currentTopic: focusedQuery,
            explicitSubjectTopic,
            locale: input.interpretation.language,
          });
        }

        return `${previousTopic}. ${effectiveFocusedQuery}`.trim();
      }

      return effectiveFocusedQuery;
    }

    if (
      (reason === 'active_document_continuation' || reason === 'knowledge_query') &&
      previousTopic
    ) {
      if (briefFollowUp && !explicitSubjectTopic) {
        if (previousDocumentQuery) {
          if (incrementalFacet) {
            return `${previousDocumentQuery}. ${incrementalFacet}`.trim();
          }

          return previousDocumentQuery;
        }

        if (incrementalFacet) {
          const incrementalTokenCount = tokenizeConversationSignalText(incrementalFacet, {
            locale: input.interpretation.language,
            minimumTokenLength: 2,
            stopWordSet: 'informative',
          }).length;

          if (incrementalTokenCount <= 1) {
            return previousTopic;
          }

          return `${previousTopic}. ${incrementalFacet}`.trim();
        }

        return previousTopic;
      }

      const subjectClarificationCarryoverQuery =
        explicitSubjectTopic && currentTopic
          ? resolveSubjectClarificationCarryoverQuery({
              previousTopic,
              currentTopic,
              explicitSubjectTopic,
              locale: input.interpretation.language,
            })
          : null;

      if (subjectClarificationCarryoverQuery) {
        return subjectClarificationCarryoverQuery;
      }

      if (
        explicitSubjectTopic &&
        currentTopic &&
        shouldPivotToCurrentTopic({
          currentTopic,
          previousTopic,
          explicitSubjectTopic,
          locale: input.interpretation.language,
        })
      ) {
        return resolvePivotQuery({
          currentTopic,
          explicitSubjectTopic,
          locale: input.interpretation.language,
        });
      }

      if (
        explicitSubjectTopic &&
        currentTopic &&
        shouldPreferCurrentTopicOverPrevious({
          currentTopic,
          previousTopic,
          explicitSubjectTopic,
          locale: input.interpretation.language,
        })
      ) {
        return explicitSubjectTopic?.trim() || currentTopic;
      }

      if (incrementalFacet) {
        return `${previousTopic}. ${incrementalFacet}`.trim();
      }

      if (
        !currentTopic ||
        normalizeConversationSignalText(currentTopic) ===
          normalizeConversationSignalText(previousTopic)
      ) {
        return previousTopic;
      }

      if (signals.threading.topicCarryoverEligible) {
        return `${previousTopic}. ${currentTopic}`.trim();
      }

      return `${previousTopic}. ${currentTopic}`.trim();
    }

    return currentTopic || previousTopic || input.message.trim();
  }

  private resolveConversationTopic(state: ConversationStateSnapshot | null | undefined) {
    if (
      !state ||
      (state.lane !== 'document_exploration' &&
        state.lane !== 'advisory_exploration')
    ) {
      return null;
    }

    const facts =
      state.approvedFacts && typeof state.approvedFacts === 'object'
        ? state.approvedFacts
        : {};

    if (
      typeof facts.subjectSummary === 'string' &&
      facts.subjectSummary.trim().length > 0
    ) {
      return facts.subjectSummary.trim();
    }

    if (
      typeof facts.topicSummary === 'string' &&
      facts.topicSummary.trim().length > 0
    ) {
      return facts.topicSummary.trim();
    }

    return null;
  }

  private resolvePreviousDocumentQuery(
    state: ConversationStateSnapshot | null | undefined,
  ) {
    if (
      !state ||
      (state.lane !== 'document_exploration' &&
        state.lane !== 'advisory_exploration')
    ) {
      return null;
    }

    const facts =
      state.approvedFacts && typeof state.approvedFacts === 'object'
        ? state.approvedFacts
        : {};

    if (
      typeof facts.lastDocumentQuery === 'string' &&
      facts.lastDocumentQuery.trim().length > 0
    ) {
      return facts.lastDocumentQuery.trim();
    }

    return null;
  }

  private resolveActiveDocumentIds(
    state: ConversationStateSnapshot | null | undefined,
  ) {
    if (
      !state ||
      (state.lane !== 'document_exploration' &&
        state.lane !== 'advisory_exploration')
    ) {
      return undefined;
    }

    const facts =
      state.approvedFacts && typeof state.approvedFacts === 'object'
        ? state.approvedFacts
        : {};

    if (!Array.isArray(facts.activeDocumentIds)) {
      return undefined;
    }

    const ids = facts.activeDocumentIds.filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    );

    return ids.length > 0 ? ids : undefined;
  }

  private resolveRawMessage(input: {
    message: string;
    interpretation: ContinuityAwareInterpretation;
  }) {
    if (
      typeof input.interpretation.entities.rawMessage === 'string' &&
      input.interpretation.entities.rawMessage.trim().length > 0
    ) {
      return input.interpretation.entities.rawMessage.trim();
    }

    return input.message.trim();
  }

  private resolveIncrementalFacet(input: {
    currentRawMessage: string;
    previousTopic: string | null;
    locale?: string | null;
  }) {
    if (!input.previousTopic || !input.currentRawMessage) {
      return null;
    }

    const currentTokens = tokenizeConversationSignalText(input.currentRawMessage, {
      locale: input.locale,
      minimumTokenLength: 3,
      stopWordSet: 'retrieval',
    });
    const previousTokens = new Set(
      tokenizeConversationSignalText(input.previousTopic, {
        locale: input.locale,
        minimumTokenLength: 3,
        stopWordSet: 'retrieval',
      }),
    );
    const incrementalTokens = currentTokens.filter(
      (token) => !previousTokens.has(token),
    );

    if (incrementalTokens.length === 0) {
      return null;
    }

    return incrementalTokens.slice(0, 6).join(' ');
  }
}

function scoreChunk(
  query: string,
  queryTokens: string[],
  focusTokens: string[],
  searchText: string,
  retrievalProjection: string | null | undefined,
  structuralText: string,
  knowledgeItems:
    | Array<{
        kind: string;
        label: string;
        valueText: string;
        normalizedValue?: string | null;
        supportClass: string;
        metadata?: unknown;
      }>
    | undefined,
  locale: string | null | undefined,
  input: {
    activeDocumentIds?: string[];
    preferredTopicTokens: string[];
    hasTopicCarryover: boolean;
    activeDocumentMatch: boolean;
    usageBoundary: 'knowledge' | 'operational';
    structuralTopicOverlap: number;
    axisAlignmentScore: number;
    axisFocusActive: boolean;
  },
) {
  const effectiveSearchText = [searchText, retrievalProjection ?? '', structuralText]
    .join(' ')
    .trim();
  const tokenSet = new Set(effectiveSearchText.split(/\s+/));
  let score = 0;

  for (const token of queryTokens) {
    if (tokenSet.has(token)) {
      score += 1;
    }
  }

  for (const token of focusTokens) {
    if (tokenSet.has(token)) {
      score += 2;
    }
  }

  const normalizedQuery = normalizeConversationSignalText(query);
  const normalizedFocus = normalizeConversationSignalText(focusTokens.join(' '));

  if (normalizedQuery.length > 0 && effectiveSearchText.includes(normalizedQuery)) {
    score += 4;
  }

  if (
    normalizedFocus.length > 0 &&
    normalizedFocus !== normalizedQuery &&
    effectiveSearchText.includes(normalizedFocus)
  ) {
    score += 5;
  }

  for (const phrase of buildTokenPhrases(queryTokens)) {
    if (effectiveSearchText.includes(phrase)) {
      score += 2;
    }
  }

  for (const phrase of buildTokenPhrases(focusTokens)) {
    if (effectiveSearchText.includes(phrase)) {
      score += 3;
    }
  }

  score += scoreStructuredKnowledgeRelevance(
    knowledgeItems ?? [],
    queryTokens,
    locale,
  );
  score += scoreStructuredKnowledgeRelevance(
    knowledgeItems ?? [],
    focusTokens,
    locale,
  );
  score += scoreActionCapabilityRelevance(
    knowledgeItems ?? [],
    queryTokens,
    locale,
  );
  score += scoreActionCapabilityRelevance(
    knowledgeItems ?? [],
    focusTokens,
    locale,
  );
  score += scoreScopeAlignment(
    knowledgeItems ?? [],
    focusTokens,
    locale,
  );

  const preferredTopicOverlapCount = input.preferredTopicTokens.filter((token) =>
    tokenSet.has(token),
  ).length;

  score += preferredTopicOverlapCount * 1.5;
  score += input.structuralTopicOverlap * 2.5;
  score += input.axisAlignmentScore * 1.75;

  if (
    input.hasTopicCarryover &&
    input.preferredTopicTokens.length > 0 &&
    preferredTopicOverlapCount === 0
  ) {
    score -= 1.5;
  }

  if (input.activeDocumentMatch) {
    score += 2;
  } else if (input.hasTopicCarryover && input.activeDocumentIds?.length) {
    score += 0.5;
  }

  if (input.usageBoundary === 'operational') {
    score -= 1;
  }

  if (
    input.axisFocusActive &&
    input.axisAlignmentScore === 0 &&
    input.usageBoundary === 'operational'
  ) {
    score -= 4;
  }

  return score;
}

function buildTokenPhrases(tokens: string[]) {
  const phrases: string[] = [];

  for (let index = 0; index < tokens.length - 1; index += 1) {
    phrases.push(tokens.slice(index, index + 2).join(' '));
  }

  return phrases;
}

function buildExcerpt(content: string, queryTokens: string[]) {
  const sentences = content
    .split(/\n{2,}|(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  const rankedSentence =
    sentences
      .map((sentence, index) => ({
        index,
        sentence,
        score: scoreExcerptSentence(sentence, queryTokens),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return right.index - left.index;
      })[0] ?? null;

  const matchedSentence = rankedSentence?.sentence ?? sentences[0] ?? content;
  const nextSentence =
    rankedSentence && rankedSentence.index < sentences.length - 1
      ? sentences[rankedSentence.index + 1]
      : null;
  const excerpt =
    nextSentence && shouldAppendNextSentence(matchedSentence, nextSentence)
      ? `${matchedSentence} ${nextSentence}`
      : matchedSentence;

  return excerpt.slice(0, 260).trim();
}

function buildGroundedSummary(
  matches: DocumentRetrievalResult['matches'],
  queryTokens: string[],
  options?: {
    incremental?: boolean;
    preferPrimaryExcerpt?: boolean;
    preferredSummaries?: string[];
  },
) {
  const preferredSummaries = (options?.preferredSummaries ?? [])
    .map((summary) => normalizeSummaryExcerpt(summary))
    .filter((summary): summary is string => Boolean(summary));
  const preferredSummary = preferredSummaries[0];

  if (preferredSummary) {
    const rankedPreferredSummaries = preferredSummaries.map((summary) => ({
      summary,
      score: scoreSummaryExcerpt(summary, queryTokens),
    }))
      .sort((left, right) => right.score - left.score);
    const primaryPreferredSummary = rankedPreferredSummaries[0];
    const primaryExcerptCandidate = matches
      .slice(0, 1)
      .map((match) => normalizeSummaryExcerpt(match.excerpt))
      .find((summary): summary is string => Boolean(summary));

    if (
      primaryExcerptCandidate &&
      shouldPreferExcerptOverPreferredSummary({
        preferredSummary: primaryPreferredSummary.summary,
        excerptSummary: primaryExcerptCandidate,
        queryTokens,
      })
    ) {
      return primaryExcerptCandidate
        .slice(0, options?.incremental ? 220 : 320)
        .trim();
    }

    const selectedPreferredSummaries = [primaryPreferredSummary.summary];

    if (!options?.incremental) {
      const secondaryPreferredSummary = rankedPreferredSummaries[1];

      if (
        secondaryPreferredSummary &&
        secondaryPreferredSummary.score > 0 &&
        secondaryPreferredSummary.score >= primaryPreferredSummary.score - 1
      ) {
        selectedPreferredSummaries.push(secondaryPreferredSummary.summary);
      }
    }

    return selectedPreferredSummaries
      .join(' ')
      .slice(0, options?.incremental ? 220 : 320)
      .trim();
  }

  const rankedExcerpts = matches
    .slice(0, 3)
    .map((match, matchIndex) => ({
      sentence: normalizeSummaryExcerpt(match.excerpt),
      score:
        scoreSummaryExcerpt(match.excerpt, queryTokens) +
        (options?.preferPrimaryExcerpt ? Math.max(0, 2 - matchIndex) : 0),
      retrievalScore: match.score,
      matchIndex,
      sequence: match.sequence,
      index: 0,
    }))
    .filter(
      (entry): entry is {
        sentence: string;
        score: number;
        retrievalScore: number;
        matchIndex: number;
        sequence: number;
        index: number;
      } => Boolean(entry.sentence),
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.retrievalScore !== left.retrievalScore) {
        return right.retrievalScore - left.retrievalScore;
      }

      if (left.matchIndex !== right.matchIndex) {
        return left.matchIndex - right.matchIndex;
      }

      if (left.sequence !== right.sequence) {
        return left.sequence - right.sequence;
      }

      return left.index - right.index;
    });
  const positiveRankedSentences = rankedExcerpts.filter((entry) => entry.score > 0);
  const candidateSentences =
    positiveRankedSentences.length > 0 ? positiveRankedSentences : rankedExcerpts;

  const selectedSentences: string[] = [];

  for (const [index, entry] of candidateSentences.entries()) {
    if (
      selectedSentences.some(
        (existing) =>
          existing === entry.sentence ||
          existing.includes(entry.sentence) ||
          entry.sentence.includes(existing),
      )
    ) {
      continue;
    }

    selectedSentences.push(entry.sentence);

    if (
      selectedSentences.length === 1 &&
      shouldStopAfterPrimaryGroundedSentence({
        sentence: entry.sentence,
        score: entry.score,
        nextScore: candidateSentences[index + 1]?.score,
      })
    ) {
      break;
    }

    if (selectedSentences.length >= (options?.incremental ? 1 : 2)) {
      break;
    }
  }

  return selectedSentences
    .join(' ')
    .slice(0, options?.incremental ? 220 : 320)
    .trim();
}

function selectPreferredGroundedSummaries<
  T extends {
    claimSummary?: string | null;
    propositionSummary?: string | null;
    requestedDetailAlignmentScore?: number;
  },
>(
  entries: T[],
  input: {
    requestedDetailTypes: ResponseGroundingDetailType[];
  },
) {
  const requestedDetailConstrained = input.requestedDetailTypes.length > 0;
  const detailAlignedEntries = requestedDetailConstrained
    ? entries.filter((entry) => (entry.requestedDetailAlignmentScore ?? 0) > 0)
    : entries;
  const sourceEntries =
    requestedDetailConstrained && detailAlignedEntries.length > 0
      ? detailAlignedEntries
      : requestedDetailConstrained
        ? []
        : entries;

  return sourceEntries
    .map((entry) => entry.claimSummary || entry.propositionSummary)
    .filter((value): value is string => Boolean(value));
}

function shouldPreferExcerptOverPreferredSummary(input: {
  preferredSummary: string;
  excerptSummary: string;
  queryTokens: string[];
}) {
  const preferredScore = scoreSummaryExcerpt(
    input.preferredSummary,
    input.queryTokens,
  );
  const excerptScore = scoreSummaryExcerpt(input.excerptSummary, input.queryTokens);

  if (
    looksRetrievalLowSignalSummary(input.preferredSummary) &&
    !looksRetrievalLowSignalSummary(input.excerptSummary)
  ) {
    return true;
  }

  if (
    countDelimitedSegments(input.preferredSummary) <= 1 &&
    countDelimitedSegments(input.excerptSummary) >= 2 &&
    excerptScore >= preferredScore
  ) {
    return true;
  }

  return false;
}

function looksRetrievalLowSignalSummary(summary: string) {
  const tokens = tokenizeQuery(summary);

  return tokens.length > 0 && new Set(tokens).size <= 1;
}

function resolveMinimumScore(
  queryTokenCount: number,
  input: {
    hasTopicCarryover: boolean;
    hasActiveDocumentIds: boolean;
  },
) {
  if (input.hasTopicCarryover || input.hasActiveDocumentIds) {
    return 1;
  }

  if (queryTokenCount <= 2) {
    return 1;
  }

  return 2;
}

function scoreExcerptSentence(sentence: string, queryTokens: string[]) {
  const normalized = normalizeConversationSignalText(sentence);

  let score = 0;

  for (const token of queryTokens) {
    if (normalized.includes(token)) {
      score += 1;
    }
  }

  for (const phrase of buildTokenPhrases(queryTokens)) {
    if (normalized.includes(phrase)) {
      score += 2;
    }
  }

  return score;
}

function shouldAppendNextSentence(currentSentence: string, nextSentence: string) {
  const normalizedCurrent = currentSentence.trim().replace(/\s+/g, ' ');
  const normalizedNext = nextSentence.trim().replace(/\s+/g, ' ');

  return (
    normalizedCurrent.length > 0 &&
    normalizedCurrent.length <= 48 &&
    normalizedNext.length > 0
  );
}

function normalizeSummarySentence(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return null;
  }

  const withoutHeadingDecorators = normalized
    .replace(/^[A-ZÁÉÍÓÚÜÑ0-9\s]{8,}\s*[=:.-]{2,}\s*/u, '')
    .replace(/^[=:_\-]{4,}\s*/u, '')
    .trim();

  if (!withoutHeadingDecorators) {
    return null;
  }

  const headingSplit = withoutHeadingDecorators.match(/^([^:]{1,48}):\s+(.+)$/u);

  if (headingSplit?.[2]) {
    return normalizeBulletSeries(headingSplit[2].trim());
  }

  return normalizeBulletSeries(withoutHeadingDecorators);
}

function normalizeSummaryExcerpt(value: string) {
  return value
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => normalizeSummarySentence(sentence))
    .filter((sentence): sentence is string => Boolean(sentence))
    .join(' ')
    .trim();
}

function normalizeBulletSeries(value: string) {
  return value
    .replace(/^-\s+/u, '')
    .replace(/\s+-\s+/gu, ', ')
    .replace(/\s*,\s*/gu, ', ')
    .trim();
}

function shouldStopAfterPrimaryGroundedSentence(input: {
  sentence: string;
  score: number;
  nextScore?: number;
}) {
  const normalized = input.sentence.trim();

  if (!normalized) {
    return false;
  }

  const hasDenseFacts =
    normalized.includes(',') ||
    normalized.includes(';') ||
    /\by\b/iu.test(normalized);
  const isAlreadyInformative =
    normalized.length >= 72 || countDelimitedSegments(normalized) >= 2;

  return (
    hasDenseFacts &&
    isAlreadyInformative
  );
}

function countDelimitedSegments(value: string) {
  return value
    .split(/[;,]/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

function tokenizeQuery(value: string, locale?: string | null) {
  const baseTokens = tokenizeConversationSignalText(value, {
    locale,
    minimumTokenLength: 3,
    stopWordSet: 'retrieval',
  });

  return Array.from(
    new Set([
      ...baseTokens,
      ...expandRetrievalEquivalentTokens(baseTokens),
    ]),
  );
}

function resolveSupplementalSegmentQueries(value: string, locale?: string | null) {
  const normalized = normalizeConversationSignalText(value);

  if (!normalized) {
    return [];
  }

  const signalCatalog = resolveConversationSignalCatalog(locale);
  const bridgeTerms = signalCatalog.textSupport.bridgeTerms
    .map((term) => normalizeConversationSignalText(term))
    .filter(Boolean);
  const bridgeAlternation = bridgeTerms.length
    ? bridgeTerms.map((term) => escapeRegExp(term)).join('|')
    : '';
  const rawSegments = normalized
    .split(
      bridgeAlternation.length > 0
        ? new RegExp(`(?:[,;/]+|\\b(?:${bridgeAlternation})\\b)`, 'u')
        : /[,;/]+/u,
    )
    .map((segment) => trimSegmentStopWords(segment, locale))
    .filter((segment) => segment.length > 0);
  const baseTokens = tokenizeQuery(normalized, locale);
  const seen = new Set<string>();

  return rawSegments
    .map((segment) => {
      const tokens = tokenizeQuery(segment, locale);

      if (tokens.length < 2) {
        return null;
      }

      const signature = tokens.join('|');

      if (signature === baseTokens.join('|') || seen.has(signature)) {
        return null;
      }

      seen.add(signature);

      return {
        text: segment,
        tokens,
        preferredTopicTokens: tokenizeSubjectQuery(segment, locale),
      };
    })
    .filter(
      (
        value,
      ): value is {
        text: string;
        tokens: string[];
        preferredTopicTokens: string[];
      } => Boolean(value),
    );
}

function trimSegmentStopWords(value: string, locale?: string | null) {
  const parts = value.split(/\s+/u).filter(Boolean);

  if (parts.length === 0) {
    return '';
  }

  const stopWordSet = new Set(
    resolveConversationSignalCatalog(locale).textSupport.informativeStopWords.map(
      (term) => normalizeConversationSignalText(term),
    ),
  );
  let start = 0;
  let end = parts.length;

  while (start < end && stopWordSet.has(normalizeConversationSignalText(parts[start]))) {
    start += 1;
  }

  while (
    end > start &&
    stopWordSet.has(normalizeConversationSignalText(parts[end - 1]))
  ) {
    end -= 1;
  }

  return parts.slice(start, end).join(' ').trim();
}

function tokenizeSubjectQuery(value: string, locale?: string | null) {
  return tokenizeConversationSignalText(value, {
    locale,
    minimumTokenLength: 2,
    stopWordSet: 'informative',
  });
}

function expandRetrievalEquivalentTokens(tokens: string[]) {
  const tokenSet = new Set(tokens);
  const expanded: string[] = [];

  if (tokenSet.has('cotizacion') || tokenSet.has('quotation') || tokenSet.has('quote')) {
    expanded.push('presupuesto', 'budget');
  }

  if (tokenSet.has('presupuesto') || tokenSet.has('budget')) {
    expanded.push('cotizacion', 'quotation', 'quote');
  }

  if (tokenSet.has('automatizar') || tokenSet.has('automation')) {
    expanded.push('automatizacion', 'automation');
  }

  if (tokenSet.has('automatizacion')) {
    expanded.push('automatizar', 'automation');
  }

  if (tokenSet.has('motorizacion') || tokenSet.has('motorization')) {
    expanded.push('motorizar', 'motorizacion', 'motorization');
  }

  if (tokenSet.has('motorizar')) {
    expanded.push('motorizacion', 'motorization');
  }

  if (tokenSet.has('reparar') || tokenSet.has('repair') || tokenSet.has('repairs')) {
    expanded.push('reparacion', 'repair', 'repairs');
  }

  if (tokenSet.has('reparacion')) {
    expanded.push('reparar', 'repair', 'repairs');
  }

  for (const token of tokenSet) {
    if (token.length <= 4) {
      continue;
    }

    if (token.endsWith('es') && token.length > 5) {
      expanded.push(token.slice(0, -2));
    }

    if (token.endsWith('s')) {
      expanded.push(token.slice(0, -1));
      continue;
    }

    expanded.push(`${token}s`);
  }

  return expanded;
}

function resolvePreferredTopicText(input: {
  currentTopic: string;
  previousTopic: string | null;
  explicitSubjectTopic: string | null;
  locale?: string | null;
}) {
  if (!input.previousTopic) {
    return null;
  }

  if (
    shouldPivotToCurrentTopic({
      currentTopic: input.currentTopic,
      previousTopic: input.previousTopic,
      explicitSubjectTopic: input.explicitSubjectTopic,
      locale: input.locale,
    }) ||
    shouldPreferCurrentTopicOverPrevious({
      currentTopic: input.currentTopic,
      previousTopic: input.previousTopic,
      explicitSubjectTopic: input.explicitSubjectTopic,
      locale: input.locale,
    })
  ) {
    return resolvePivotQuery({
      currentTopic: input.currentTopic,
      explicitSubjectTopic: input.explicitSubjectTopic,
      locale: input.locale,
    });
  }

  return input.previousTopic;
}

function diversifySupplementalSegmentMatches<
  T extends {
    score: number;
    segmentScores: number[];
    chunk: { documentId: string; sequence: number };
    richness: number;
    exactSubjectAlignmentScore: number;
  },
>(baseEntries: T[], allEntries: T[], segmentCount: number, minimumScore: number) {
  if (segmentCount === 0) {
    return baseEntries;
  }

  const merged = [...baseEntries];
  const seen = new Set(
    baseEntries.map((entry) => `${entry.chunk.documentId}:${entry.chunk.sequence}`),
  );

  for (let index = 0; index < segmentCount; index += 1) {
    const segmentCandidate = [...allEntries]
      .filter(
        (entry) =>
          (entry.segmentScores[index] ?? 0) >= Math.max(2, minimumScore - 1),
      )
      .sort((left, right) => {
        const leftScore = left.segmentScores[index] ?? 0;
        const rightScore = right.segmentScores[index] ?? 0;

        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }

        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (right.exactSubjectAlignmentScore !== left.exactSubjectAlignmentScore) {
          return right.exactSubjectAlignmentScore - left.exactSubjectAlignmentScore;
        }

        return right.richness - left.richness;
      })[0];

    if (!segmentCandidate) {
      continue;
    }

    const key = `${segmentCandidate.chunk.documentId}:${segmentCandidate.chunk.sequence}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(segmentCandidate);
  }

  return merged.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (right.exactSubjectAlignmentScore !== left.exactSubjectAlignmentScore) {
      return right.exactSubjectAlignmentScore - left.exactSubjectAlignmentScore;
    }

    return right.richness - left.richness;
  });
}

function promoteRecommendationContinuationMatches<
  T extends {
    score: number;
    recommendationOrientationScore?: number;
    recommendationEvidenceTier?: number;
    detailDriftPenalty?: number;
    structuralTopicOverlap: number;
    exactSubjectAlignmentScore: number;
    chunk: { documentId: string; sequence: number };
  },
>(baseEntries: T[], allEntries: T[]) {
  const baseEvidenceTier = Math.max(
    ...baseEntries.map((entry) => entry.recommendationEvidenceTier ?? 0),
    0,
  );

  const promotedCandidate = [...allEntries]
    .filter(
      (entry) =>
        entry.score > 0 &&
        (entry.recommendationEvidenceTier ?? 0) > 0 &&
        (
          (entry.recommendationOrientationScore ?? 0) > 0 ||
          entry.exactSubjectAlignmentScore > 0
        ) &&
        (entry.detailDriftPenalty ?? 0) === 0,
    )
    .sort((left, right) => {
      const rightEvidenceTier = right.recommendationEvidenceTier ?? 0;
      const leftEvidenceTier = left.recommendationEvidenceTier ?? 0;

      if (rightEvidenceTier !== leftEvidenceTier) {
        return rightEvidenceTier - leftEvidenceTier;
      }

      const rightRecommendationScore = right.recommendationOrientationScore ?? 0;
      const leftRecommendationScore = left.recommendationOrientationScore ?? 0;

      if (rightRecommendationScore !== leftRecommendationScore) {
        return rightRecommendationScore - leftRecommendationScore;
      }

      if (right.structuralTopicOverlap !== left.structuralTopicOverlap) {
        return right.structuralTopicOverlap - left.structuralTopicOverlap;
      }

      if (
        right.exactSubjectAlignmentScore !== left.exactSubjectAlignmentScore
      ) {
        return right.exactSubjectAlignmentScore - left.exactSubjectAlignmentScore;
      }

      return right.score - left.score;
    })[0];

  if (!promotedCandidate) {
    return baseEntries;
  }

  if ((promotedCandidate.recommendationEvidenceTier ?? 0) <= baseEvidenceTier) {
    return baseEntries;
  }

  const promotedKey = `${promotedCandidate.chunk.documentId}:${promotedCandidate.chunk.sequence}`;
  const retained = baseEntries.filter(
    (entry) =>
      `${entry.chunk.documentId}:${entry.chunk.sequence}` !== promotedKey,
  );

  return [promotedCandidate, ...retained];
}

function promoteSpecificVariantsContinuationMatches<
  T extends {
    score: number;
    requestedDetailTextAlignmentScore?: number;
    requestedDetailAlignmentScore?: number;
    exactSubjectAlignmentScore: number;
    structuralTopicOverlap: number;
    detailDriftPenalty?: number;
    chunk: { documentId: string; sequence: number };
  },
>(baseEntries: T[], allEntries: T[]) {
  const promotedCandidate = [...allEntries]
    .filter(
      (entry) =>
        entry.score > 0 &&
        ((entry.requestedDetailAlignmentScore ?? 0) > 0 ||
          (entry.requestedDetailTextAlignmentScore ?? 0) > 0) &&
        ((entry.requestedDetailTextAlignmentScore ?? 0) > 0 ||
          entry.exactSubjectAlignmentScore > 0) &&
        (entry.detailDriftPenalty ?? 0) === 0,
    )
    .sort((left, right) => {
      const rightTextAlignment = right.requestedDetailTextAlignmentScore ?? 0;
      const leftTextAlignment = left.requestedDetailTextAlignmentScore ?? 0;

      if (rightTextAlignment !== leftTextAlignment) {
        return rightTextAlignment - leftTextAlignment;
      }

      const rightAxisAlignment = right.requestedDetailAlignmentScore ?? 0;
      const leftAxisAlignment = left.requestedDetailAlignmentScore ?? 0;

      if (rightAxisAlignment !== leftAxisAlignment) {
        return rightAxisAlignment - leftAxisAlignment;
      }

      if (right.exactSubjectAlignmentScore !== left.exactSubjectAlignmentScore) {
        return right.exactSubjectAlignmentScore - left.exactSubjectAlignmentScore;
      }

      if (right.structuralTopicOverlap !== left.structuralTopicOverlap) {
        return right.structuralTopicOverlap - left.structuralTopicOverlap;
      }

      return right.score - left.score;
    })[0];

  if (!promotedCandidate) {
    return baseEntries;
  }

  const baseTextAlignment = Math.max(
    ...baseEntries.map((entry) => entry.requestedDetailTextAlignmentScore ?? 0),
    0,
  );
  const baseAxisAlignment = Math.max(
    ...baseEntries.map((entry) => entry.requestedDetailAlignmentScore ?? 0),
    0,
  );

  if (
    (promotedCandidate.requestedDetailTextAlignmentScore ?? 0) < baseTextAlignment &&
    (promotedCandidate.requestedDetailAlignmentScore ?? 0) <= baseAxisAlignment
  ) {
    return baseEntries;
  }

  const promotedKey = `${promotedCandidate.chunk.documentId}:${promotedCandidate.chunk.sequence}`;
  const retained = baseEntries.filter(
    (entry) =>
      `${entry.chunk.documentId}:${entry.chunk.sequence}` !== promotedKey,
  );

  return [promotedCandidate, ...retained];
}

function promotePrimaryRequestedDetailMatches<
  T extends {
    score: number;
    requestedDetailTextAlignmentScore?: number;
    requestedDetailAlignmentScore?: number;
    exactSubjectAlignmentScore: number;
    structuralTopicOverlap: number;
    scopeAlignmentScore?: number;
    detailDriftPenalty?: number;
    chunk: { documentId: string; sequence: number };
  },
>(
  baseEntries: T[],
  allEntries: T[],
) {
  const promotedCandidate = [...allEntries]
    .filter(
      (entry) =>
        entry.score > 0 &&
        ((entry.requestedDetailAlignmentScore ?? 0) > 0 ||
          (entry.requestedDetailTextAlignmentScore ?? 0) > 0) &&
        (entry.detailDriftPenalty ?? 0) === 0,
    )
    .sort((left, right) => {
      const rightAxisAlignment = right.requestedDetailAlignmentScore ?? 0;
      const leftAxisAlignment = left.requestedDetailAlignmentScore ?? 0;

      if (rightAxisAlignment !== leftAxisAlignment) {
        return rightAxisAlignment - leftAxisAlignment;
      }

      const rightTextAlignment = right.requestedDetailTextAlignmentScore ?? 0;
      const leftTextAlignment = left.requestedDetailTextAlignmentScore ?? 0;

      if (rightTextAlignment !== leftTextAlignment) {
        return rightTextAlignment - leftTextAlignment;
      }

      if ((right.scopeAlignmentScore ?? 0) !== (left.scopeAlignmentScore ?? 0)) {
        return (right.scopeAlignmentScore ?? 0) - (left.scopeAlignmentScore ?? 0);
      }

      if (right.exactSubjectAlignmentScore !== left.exactSubjectAlignmentScore) {
        return right.exactSubjectAlignmentScore - left.exactSubjectAlignmentScore;
      }

      if (right.structuralTopicOverlap !== left.structuralTopicOverlap) {
        return right.structuralTopicOverlap - left.structuralTopicOverlap;
      }

      return right.score - left.score;
    })[0];

  if (!promotedCandidate) {
    return baseEntries;
  }

  const primaryRequestedEntry = baseEntries[0];

  if (
    primaryRequestedEntry &&
    (primaryRequestedEntry.requestedDetailAlignmentScore ?? 0) > 0 &&
    (primaryRequestedEntry.detailDriftPenalty ?? 0) === 0 &&
    (primaryRequestedEntry.requestedDetailAlignmentScore ?? 0) >=
      (promotedCandidate.requestedDetailAlignmentScore ?? 0) &&
    (primaryRequestedEntry.scopeAlignmentScore ?? 0) >=
      (promotedCandidate.scopeAlignmentScore ?? 0)
  ) {
    return baseEntries;
  }

  const promotedKey = `${promotedCandidate.chunk.documentId}:${promotedCandidate.chunk.sequence}`;
  const retained = baseEntries.filter(
    (entry) =>
      `${entry.chunk.documentId}:${entry.chunk.sequence}` !== promotedKey,
  );

  return [promotedCandidate, ...retained];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function shouldPivotToCurrentTopic(input: {
  currentTopic: string;
  previousTopic: string;
  explicitSubjectTopic: string | null;
  locale?: string | null;
}) {
  return (
    resolveTopicShiftCandidate({
      currentTopic: input.currentTopic,
      previousTopic: input.previousTopic,
      explicitSubjectTopic: input.explicitSubjectTopic,
      locale: input.locale,
    }) !== null
  );
}

function resolvePivotQuery(input: {
  currentTopic: string;
  explicitSubjectTopic: string | null;
  locale?: string | null;
}) {
  const explicitSubject = input.explicitSubjectTopic?.trim();

  if (!explicitSubject) {
    return input.currentTopic;
  }

  const explicitTokens = new Set(
    tokenizeConversationSignalText(explicitSubject, {
      locale: input.locale,
      minimumTokenLength: 2,
      stopWordSet: 'informative',
    }),
  );
  const currentTokens = tokenizeConversationSignalText(input.currentTopic, {
    locale: input.locale,
    minimumTokenLength: 2,
    stopWordSet: 'informative',
  });

  if (currentTokens.length === 0 || explicitTokens.size === 0) {
    return explicitSubject;
  }

  const novelCurrentTokens = currentTokens.filter((token) => !explicitTokens.has(token));

  return novelCurrentTokens.length === 0 ? explicitSubject : input.currentTopic;
}

function shouldPreferCurrentTopicOverPrevious(input: {
  currentTopic: string;
  previousTopic: string;
  explicitSubjectTopic: string | null;
  locale?: string | null;
}) {
  return (
    resolveTopicShiftCandidate({
      currentTopic: input.currentTopic,
      previousTopic: input.previousTopic,
      explicitSubjectTopic: input.explicitSubjectTopic,
      locale: input.locale,
    }) !== null
  );
}

function shouldPreferCurrentTopicForThinFocus(input: {
  focusedQuery: string;
  currentTopic: string;
  explicitSubjectTopic: string | null;
  previousTopic: string | null;
  locale?: string | null;
}) {
  if (!input.explicitSubjectTopic) {
    return false;
  }

  const focusTokens = tokenizeConversationSignalText(input.focusedQuery, {
    locale: input.locale,
    minimumTokenLength: 2,
    stopWordSet: 'informative',
  });

  if (focusTokens.length > 2) {
    return false;
  }

  const pivotQuery = resolvePivotQuery({
    currentTopic: input.currentTopic,
    explicitSubjectTopic: input.explicitSubjectTopic,
    locale: input.locale,
  });
  const pivotTokens = tokenizeConversationSignalText(pivotQuery, {
    locale: input.locale,
    minimumTokenLength: 2,
    stopWordSet: 'informative',
  });

  if (pivotTokens.length <= focusTokens.length) {
    return false;
  }

  const focusTokenSet = new Set(focusTokens);
  const containsFocusedSignal =
    focusTokens.length === 0 ||
    focusTokens.every((token) => pivotTokens.includes(token));

  if (!containsFocusedSignal) {
    return false;
  }

  if (!input.previousTopic) {
    return true;
  }

  return shouldPreferCurrentTopicOverPrevious({
    currentTopic: pivotQuery,
    previousTopic: input.previousTopic,
    explicitSubjectTopic: input.explicitSubjectTopic,
    locale: input.locale,
  });
}

function resolveTopicShiftCandidate(input: {
  currentTopic: string;
  previousTopic: string;
  explicitSubjectTopic: string | null;
  locale?: string | null;
}) {
  const previousTokens = new Set(
    tokenizeConversationSignalText(input.previousTopic, {
      locale: input.locale,
      minimumTokenLength: 2,
      stopWordSet: 'informative',
    }),
  );

  if (previousTokens.size === 0) {
    return null;
  }

  const candidates = [
    extractSubjectRefreshCandidate(input.currentTopic, input.locale),
    input.explicitSubjectTopic?.trim() || null,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const currentTokens = tokenizeConversationSignalText(candidate, {
      locale: input.locale,
      minimumTokenLength: 2,
      stopWordSet: 'informative',
    });

    if (currentTokens.length < 2) {
      continue;
    }

    const overlapCount = currentTokens.filter((token) => previousTokens.has(token)).length;
    const novelTokenCount = currentTokens.length - overlapCount;

    if (overlapCount === 0) {
      return candidate;
    }

    if (novelTokenCount > 0 && overlapCount < currentTokens.length) {
      return candidate;
    }
  }

  return null;
}

function extractSubjectRefreshCandidate(
  value: string,
  locale?: string | null,
) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const tokens = tokenizeConversationSignalText(normalized, {
    locale,
    minimumTokenLength: 2,
    stopWordSet: 'informative',
  });

  if (tokens.length < 2) {
    return null;
  }

  return normalized;
}

function resolveExplicitSubjectTopic(entities: Record<string, unknown>) {
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

  return null;
}

function resolveRequestAwareTopic(input: {
  currentTopic: string;
  entities: Record<string, unknown>;
  locale?: string | null;
}) {
  const requestSummary =
    typeof input.entities.requestSummary === 'string' &&
    input.entities.requestSummary.trim().length > 0
      ? input.entities.requestSummary.trim()
      : null;

  if (!requestSummary) {
    return input.currentTopic;
  }

  const currentTokens = new Set(
    tokenizeConversationSignalText(input.currentTopic, {
      locale: input.locale,
      minimumTokenLength: 2,
      stopWordSet: 'informative',
    }),
  );
  const requestTokens = tokenizeConversationSignalText(requestSummary, {
    locale: input.locale,
    minimumTokenLength: 2,
    stopWordSet: 'informative',
  });

  if (requestTokens.length === 0) {
    return input.currentTopic;
  }

  if (currentTokens.size === 0) {
    return requestSummary;
  }

  const hasNovelRequestTokens = requestTokens.some((token) => !currentTokens.has(token));

  return hasNovelRequestTokens ? requestSummary : input.currentTopic;
}

function resolveSubjectClarificationCarryoverQuery(input: {
  previousTopic: string;
  currentTopic: string;
  explicitSubjectTopic: string;
  locale?: string | null;
}) {
  const previousDetailAssessments = assessRequestedGroundingDetails({
    locale: input.locale,
    userText: input.previousTopic,
    queryText: input.previousTopic,
  });
  const currentDetailAssessments = assessRequestedGroundingDetails({
    locale: input.locale,
    userText: input.currentTopic,
    queryText: input.currentTopic,
  });
  const currentHasUserBackedDetail = currentDetailAssessments.some((assessment) =>
    isUserBackedGroundingDetailAssessment(assessment),
  );

  if (currentHasUserBackedDetail) {
    return null;
  }

  const previousHasUserBackedDetail = previousDetailAssessments.some((assessment) =>
    isUserBackedGroundingDetailAssessment(assessment),
  );

  if (!previousHasUserBackedDetail) {
    return null;
  }

  return `${input.explicitSubjectTopic.trim()}. ${input.previousTopic.trim()}`.trim();
}

function scoreSummaryExcerpt(excerpt: string, queryTokens: string[]) {
  const baseScore = scoreExcerptSentence(excerpt, queryTokens);
  const normalized = normalizeSummaryExcerpt(excerpt);

  if (!normalized) {
    return baseScore;
  }

  const itemCount = normalized.split(/\s*,\s*/u).filter(Boolean).length;
  const broadListPenalty = itemCount >= 5 ? 1.25 : 0;

  return baseScore - broadListPenalty;
}

function buildClaimBackedSummary(
  chunk: {
    knowledgeItems?: Array<{
      kind: string;
      label: string;
      valueText: string;
      normalizedValue?: string | null;
      supportClass: string;
      metadata?: unknown;
    }>;
  },
  queryTokens: string[],
  locale?: string | null,
) {
  const claims = mergeAxisSummaries(
    extractKnowledgeAxisSummaries(chunk.knowledgeItems ?? []),
  );
  const axisMatchedClaims = claims.filter((claim) =>
    tokenizeQuery(resolveStructuralKnowledgeAxisLabel(claim.axis, locale), locale).some(
      (token) => queryTokens.includes(token),
    ) ||
    tokenizeQuery(
      [
        ...(claim.appliesTo ?? []).map(
          (scope) => scope.normalizedValue ?? scope.value,
        ),
        ...claim.values,
      ].join(' '),
      locale,
    ).some((token) => queryTokens.includes(token)),
  );
  const candidateClaims =
    axisMatchedClaims.length > 0
      ? axisMatchedClaims
      : selectBroadOverviewClaimsForQuery(claims, queryTokens, locale);

  if (candidateClaims.length === 0) {
    return null;
  }

  const ranked = candidateClaims
    .map((claim) => ({
      summary: buildStructuralKnowledgeSummary({
        locale,
        claims: [claim],
        limit: 1,
      }),
      score: scoreStructuredClaimQueryAlignment(claim, queryTokens) +
        (claim.supportClass === 'explicit_fact' ? 2 : 1),
    }))
    .filter((claim) => claim.summary.length > 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.summary ?? null;
}

function buildPropositionBackedSummary(
  chunk: {
    propositions?: Array<{
      predicate: string;
      facet?: string | null;
      objectValue: string;
      objectNormalized?: string | null;
      polarity: string;
      supportClass: string;
      evidenceTier: string;
      confidence: number;
      relationScope?: unknown;
      metadata?: unknown;
      patternKey: string;
      canonicalKey?: string | null;
      promotionState?: string | null;
      promotedAxis?: string | null;
      promotedFacet?: string | null;
    }>;
  },
  queryTokens: string[],
  locale?: string | null,
) {
  const propositions = extractStructuredKnowledgePropositions(
    chunk.propositions ?? [],
    {
      layers: ['factual'],
    },
  );

  if (propositions.length === 0 || queryTokens.length === 0) {
    return null;
  }

  const ranked = propositions
    .map((proposition) => ({
      summary: buildStructuralKnowledgePropositionSummary({
        locale,
        propositions: [proposition],
        limit: 1,
      }),
      score: scoreStructuredPropositionQueryAlignment(proposition, queryTokens, locale),
    }))
    .filter((entry) => entry.summary.length > 0 && entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.summary ?? null;
}

function selectBroadOverviewClaimsForQuery(
  claims: ReturnType<typeof mergeAxisSummaries>,
  queryTokens: string[],
  locale?: string | null,
) {
  if (claims.length === 0 || queryTokens.length === 0) {
    return [];
  }

  const prioritizedAxes = new Set([
    'product_types',
    'materials',
    'operation_modes',
    'service_offers',
  ]);
  const subjectMatchedClaims = claims.filter((claim) => {
    const subjectTokens = tokenizeQuery(
      `${claim.subject?.normalizedValue ?? claim.subject?.value ?? ''}`,
      locale,
    );
    const scopeTokens = tokenizeQuery(
      (claim.appliesTo ?? [])
        .map((scope) => scope.normalizedValue ?? scope.value)
        .join(' '),
      locale,
    );

    return (
      prioritizedAxes.has(claim.axis) &&
      [...subjectTokens, ...scopeTokens].some((token) => queryTokens.includes(token))
    );
  });

  return subjectMatchedClaims.sort((left, right) => {
    const rightPriority = prioritizedAxes.has(right.axis)
      ? broadOverviewAxisPriority(right.axis)
      : 0;
    const leftPriority = prioritizedAxes.has(left.axis)
      ? broadOverviewAxisPriority(left.axis)
      : 0;

    if (rightPriority !== leftPriority) {
      return rightPriority - leftPriority;
    }

    return right.values.length - left.values.length;
  });
}

function broadOverviewAxisPriority(axis: string) {
  switch (axis) {
    case 'product_types':
      return 5;
    case 'materials':
      return 4;
    case 'operation_modes':
      return 3;
    case 'service_offers':
      return 2;
    default:
      return 0;
  }
}

function mergeAxisSummaries(
  claims: ReturnType<typeof extractKnowledgeAxisSummaries>,
) {
  const grouped = new Map<string, (typeof claims)[number]>();

  for (const claim of claims) {
    const key = JSON.stringify({
      axis: claim.axis,
      facet: claim.facet ?? null,
      layer: claim.layer,
      supportClass: claim.supportClass,
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

    existing.values = Array.from(
      new Set([...existing.values, ...claim.values]),
    );
  }

  return Array.from(grouped.values());
}

function isBriefFollowUpQuestion(value: string) {
  const tokenCount = value
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length;

  return tokenCount > 0 && tokenCount <= 6;
}

function scoreStructuredKnowledgeRelevance(
  knowledgeItems: Array<{
    kind: string;
    label: string;
    valueText: string;
    normalizedValue?: string | null;
    supportClass: string;
    metadata?: unknown;
  }>,
  queryTokens: string[],
  locale?: string | null,
) {
  const claims = extractStructuredKnowledgeClaims(knowledgeItems, {
    layers: ['factual'],
  });

  if (claims.length === 0 || queryTokens.length === 0) {
    return 0;
  }

  return Math.max(
    ...claims.map((claim) =>
      scoreStructuredClaimQueryAlignment(claim, queryTokens, locale),
    ),
    0,
  );
}

function scoreActionCapabilityRelevance(
  knowledgeItems: Array<{
    kind: string;
    label: string;
    valueText: string;
    normalizedValue?: string | null;
    supportClass: string;
    metadata?: unknown;
  }>,
  queryTokens: string[],
  locale?: string | null,
) {
  if (queryTokens.length === 0) {
    return 0;
  }

  const factualCandidates = extractStructuredKnowledgeClaims(knowledgeItems, {
    layers: ['factual'],
  }).filter((claim) =>
    claim.axis === 'service_offers' ||
    claim.axis === 'commercial_visit_cost' ||
    claim.axis === 'travel_cost_responsibility',
  );
  const metadataCandidates = extractKnowledgeMetadataSummaries(knowledgeItems, {
    layers: ['workflow', 'guidance'],
  }).filter(
    (note) =>
      note.axis === 'organic_response_pattern' ||
      note.axis === 'quote_fields' ||
      note.axis === 'quote_transition',
  );
  const queryTokenSet = new Set(queryTokens);
  const candidates = [
    ...factualCandidates.map((claim) => ({
      axis: claim.axis,
      facet: claim.facet,
      values: claim.values,
      subject: claim.subject,
      appliesTo: claim.appliesTo ?? [],
      supportClass: claim.supportClass,
    })),
    ...metadataCandidates.map((note) => ({
      axis: note.axis,
      facet: note.facet,
      values: note.values,
      subject: note.subject,
      appliesTo: note.appliesTo ?? [],
      supportClass: note.supportClass,
    })),
  ];

  if (candidates.length === 0) {
    return 0;
  }

  return Math.max(
    ...candidates.map((candidate) => {
      const axisTokens = tokenizeQuery(
        [
          resolveStructuralKnowledgeAxisLabel(candidate.axis, locale),
          candidate.facet ?? '',
        ].join(' '),
        locale,
      );
      const valueTokens = tokenizeQuery(candidate.values.join(' '), locale);
      const subjectTokens = tokenizeQuery(
        `${candidate.subject?.axis ?? ''} ${candidate.subject?.normalizedValue ?? candidate.subject?.value ?? ''}`,
        locale,
      );
      const scopeTokens = tokenizeQuery(
        candidate.appliesTo
          .map((scope) => `${scope.axis} ${scope.normalizedValue ?? scope.value}`)
          .join(' '),
        locale,
      );
      const axisOverlap = axisTokens.filter((token) => queryTokenSet.has(token)).length;
      const valueOverlap = valueTokens.filter((token) => queryTokenSet.has(token)).length;
      const subjectOverlap = subjectTokens.filter((token) => queryTokenSet.has(token)).length;
      const scopeOverlap = scopeTokens.filter((token) => queryTokenSet.has(token)).length;

      let score =
        axisOverlap * 2 +
        valueOverlap * 3 +
        subjectOverlap * 2 +
        scopeOverlap * 2;

      if (score > 0) {
        score += candidate.supportClass === 'explicit_fact' ? 2 : 1;
      }

      return score;
    }),
    0,
  );
}

function scoreRecommendationOrientationRelevance(
  knowledgeItems: Array<{
    kind: string;
    label: string;
    valueText: string;
    normalizedValue?: string | null;
    supportClass: string;
    metadata?: unknown;
  }>,
  queryTokens: string[],
  locale?: string | null,
) {
  if (queryTokens.length === 0) {
    return 0;
  }

  const factualCandidates = extractStructuredKnowledgeClaims(knowledgeItems, {
    layers: ['factual'],
  }).filter((claim) =>
    RECOMMENDATION_ORIENTATION_AXES.has(claim.axis),
  );
  const metadataCandidates = extractKnowledgeMetadataSummaries(knowledgeItems, {
    layers: ['workflow', 'guidance'],
  }).filter((note) => note.axis === 'comparison_guidance');
  const queryTokenSet = new Set(queryTokens);
  const candidates = [
    ...factualCandidates.map((claim) => ({
      axis: claim.axis,
      facet: claim.facet,
      values: claim.values,
      subject: claim.subject,
      appliesTo: claim.appliesTo ?? [],
      supportClass: claim.supportClass,
      isMetadata: false,
    })),
    ...metadataCandidates.map((note) => ({
      axis: note.axis,
      facet: note.facet,
      values: note.values,
      subject: note.subject,
      appliesTo: note.appliesTo ?? [],
      supportClass: note.supportClass,
      isMetadata: true,
    })),
  ];

  if (candidates.length === 0) {
    return 0;
  }

  return Math.max(
    ...candidates.map((candidate) => {
      const axisTokens = tokenizeQuery(
        [
          resolveStructuralKnowledgeAxisLabel(candidate.axis, locale),
          candidate.facet ?? '',
        ].join(' '),
        locale,
      );
      const valueTokens = tokenizeQuery(candidate.values.join(' '), locale);
      const subjectTokens = tokenizeQuery(
        `${candidate.subject?.axis ?? ''} ${candidate.subject?.normalizedValue ?? candidate.subject?.value ?? ''}`,
        locale,
      );
      const scopeTokens = tokenizeQuery(
        candidate.appliesTo
          .map((scope) => `${scope.axis} ${scope.normalizedValue ?? scope.value}`)
          .join(' '),
        locale,
      );
      const axisOverlap = axisTokens.filter((token) => queryTokenSet.has(token)).length;
      const valueOverlap = valueTokens.filter((token) => queryTokenSet.has(token)).length;
      const subjectOverlap = subjectTokens.filter((token) => queryTokenSet.has(token)).length;
      const scopeOverlap = scopeTokens.filter((token) => queryTokenSet.has(token)).length;

      let score =
        axisOverlap * 2 +
        valueOverlap * 3 +
        subjectOverlap * 2 +
        scopeOverlap * 2;

      if (score > 0) {
        score += candidate.isMetadata
          ? 2
          : candidate.supportClass === 'explicit_fact'
            ? 2
            : 1;

        if (
          candidate.axis === 'materials' ||
          candidate.axis === 'product_types' ||
          candidate.axis === 'suitability'
        ) {
          score += 1;
        }
      }

      return score;
    }),
    0,
  );
}

function resolveRecommendationEvidenceTier(
  knowledgeItems: Array<{
    kind: string;
    label: string;
    valueText: string;
    normalizedValue?: string | null;
    supportClass: string;
    metadata?: unknown;
  }>,
) {
  const metadataAxes = new Set(
    extractKnowledgeMetadataSummaries(knowledgeItems, {
      layers: ['workflow', 'guidance'],
    }).map((note) => note.axis),
  );

  if (metadataAxes.has('comparison_guidance')) {
    return 3;
  }

  const factualAxes = new Set(
    extractStructuredKnowledgeClaims(knowledgeItems, {
      layers: ['factual'],
    }).map((claim) => claim.axis),
  );

  if (factualAxes.has('suitability')) {
    return 2;
  }

  if (
    factualAxes.has('materials') ||
    factualAxes.has('product_types') ||
    factualAxes.has('feature_support')
  ) {
    return 1;
  }

  return 0;
}

function scoreRequestedDetailDriftPenalty(
  knowledgeItems: Array<{
    kind: string;
    label: string;
    valueText: string;
    normalizedValue?: string | null;
    supportClass: string;
    metadata?: unknown;
  }>,
  input: {
    locale?: string | null;
    primaryDetailType: ResponseGroundingDetailType | null;
    preferRecommendation: boolean;
    preferPrimaryRequestedDetail: boolean;
  },
) {
  if (!input.primaryDetailType || !input.preferPrimaryRequestedDetail) {
    return 0;
  }

  const catalog = resolveResponseGroundingCatalog(input.locale);
  const primarySupportedAxes = new Set(
    catalog.detailTypes[input.primaryDetailType]?.supportedAxes ?? [],
  );
  const recommendationAxes = new Set(
    catalog.detailTypes.recommendation?.supportedAxes ?? [],
  );
  const factualAxes = new Set(
    extractStructuredKnowledgeClaims(knowledgeItems, {
      layers: ['factual'],
    }).map((claim) => claim.axis),
  );
  const metadataAxes = new Set(
    extractKnowledgeMetadataSummaries(knowledgeItems, {
      layers: ['workflow', 'guidance'],
    }).map((note) => note.axis),
  );
  const allAxes = new Set([...factualAxes, ...metadataAxes]);
  const hasPrimaryAxis = [...allAxes].some((axis) => primarySupportedAxes.has(axis));
  const hasRecommendationAxis = [...allAxes].some((axis) =>
    recommendationAxes.has(axis),
  );
  const hasActionAxis = [...allAxes].some((axis) =>
    ACTION_SCOPED_DETAIL_AXES.has(axis),
  );
  const hasOffTargetAxis = [...allAxes].some(
    (axis) =>
      !primarySupportedAxes.has(axis) &&
      axis !== 'organic_response_pattern',
  );

  if (
    input.preferRecommendation &&
    input.primaryDetailType === 'recommendation' &&
    hasActionAxis &&
    !hasRecommendationAxis
  ) {
    return 10;
  }

  const primaryDetailIsActionScoped = [...primarySupportedAxes].some((axis) =>
    ACTION_SCOPED_DETAIL_AXES.has(axis),
  );

  if (!primaryDetailIsActionScoped && !hasPrimaryAxis && hasOffTargetAxis) {
    return 8;
  }

  if (!primaryDetailIsActionScoped && hasActionAxis && !hasPrimaryAxis) {
    return 10;
  }

  return 0;
}

function scoreRequestedDetailAxisAlignment(
  knowledgeItems: Array<{
    kind: string;
    label: string;
    valueText: string;
    normalizedValue?: string | null;
    supportClass: string;
    metadata?: unknown;
  }>,
  requestedDetailTypes: ResponseGroundingDetailType[],
  locale?: string | null,
) {
  if (requestedDetailTypes.length === 0) {
    return 0;
  }

  const catalog = resolveResponseGroundingCatalog(locale);
  const supportedAxes = new Set(
    requestedDetailTypes.flatMap(
      (detailType) => catalog.detailTypes[detailType].supportedAxes ?? [],
    ),
  );

  if (supportedAxes.size === 0) {
    return 0;
  }

  const factualAxisMatches = new Set(
    extractStructuredKnowledgeClaims(knowledgeItems, {
      layers: ['factual'],
    })
      .filter((claim) => supportedAxes.has(claim.axis))
      .map((claim) => claim.axis),
  );
  const metadataAxisMatches = new Set(
    extractKnowledgeMetadataSummaries(knowledgeItems, {
      layers: ['workflow', 'guidance'],
    })
      .filter((note) => supportedAxes.has(note.axis))
      .map((note) => note.axis),
  );

  return factualAxisMatches.size * 6 + metadataAxisMatches.size * 3;
}

function scoreRequestedDetailTextAlignment(
  value: string,
  requestedDetailTypes: ResponseGroundingDetailType[],
  locale?: string | null,
) {
  if (!value.trim() || requestedDetailTypes.length === 0) {
    return 0;
  }

  const normalizedValue = normalizeConversationSignalText(value);

  if (!normalizedValue) {
    return 0;
  }

  const catalog = resolveResponseGroundingCatalog(locale);

  return requestedDetailTypes.reduce((score, detailType) => {
    const detailConfig = catalog.detailTypes[detailType];

    if (!detailConfig) {
      return score;
    }

    const contextualRequestTerms = Array.isArray(
      (
        detailConfig as {
          contextualRequestTerms?: unknown;
        }
      ).contextualRequestTerms,
    )
      ? (detailConfig as { contextualRequestTerms: string[] }).contextualRequestTerms
      : [];

    const cues = Array.from(
      new Set(
        [
          ...(detailConfig.requestTerms ?? []),
          ...(detailConfig.generalEvidenceTerms ?? []),
          ...contextualRequestTerms,
        ]
          .map((term) => normalizeConversationSignalText(term))
          .filter((term) => term.length > 0),
      ),
    );
    const cueMatches = cues.filter((cue) => normalizedValue.includes(cue)).length;

    return score + cueMatches;
  }, 0);
}

function scoreStructuredClaimQueryAlignment(
  claim: {
    axis: string;
    facet?: string;
    values: string[];
    supportClass?: string;
    subject?: { axis: string; value: string; normalizedValue?: string | null };
    appliesTo?: Array<{ axis: string; value: string; normalizedValue?: string | null }>;
  },
  queryTokens: string[],
  locale?: string | null,
) {
  const structuralSentence = buildStructuralKnowledgeSummary({
    locale,
    claims: [
      {
        axis: claim.axis,
        facet: claim.facet,
        layer: 'factual',
        values: claim.values,
        supportClass: 'explicit_fact',
        subject: claim.subject
          ? {
              axis: claim.subject.axis,
              value: claim.subject.value,
              normalizedValue: claim.subject.normalizedValue ?? undefined,
            }
          : undefined,
        appliesTo: claim.appliesTo?.map((scope) => ({
          axis: scope.axis,
          value: scope.value,
          normalizedValue: scope.normalizedValue ?? undefined,
        })),
      },
    ],
    limit: 1,
  });
  const axisTokens = tokenizeQuery(
    [
      resolveStructuralKnowledgeAxisLabel(claim.axis, locale),
      claim.facet ?? '',
    ].join(' '),
    locale,
  );
  const summaryTokens = tokenizeQuery(structuralSentence, locale);
  const valueTokens = tokenizeQuery(claim.values.join(' '), null);
  const subjectTokens = tokenizeQuery(
    `${claim.subject?.axis ?? ''} ${claim.subject?.normalizedValue ?? claim.subject?.value ?? ''}`,
    null,
  );
  const scopeTokens = tokenizeQuery(
    (claim.appliesTo ?? [])
      .map((scope) => `${scope.axis} ${scope.normalizedValue ?? scope.value}`)
      .join(' '),
    null,
  );
  const queryTokenSet = new Set(queryTokens);
  const axisOverlap = axisTokens.filter((token) => queryTokenSet.has(token)).length;
  const summaryOverlap = summaryTokens.filter((token) => queryTokenSet.has(token)).length;
  const valueOverlap = valueTokens.filter((token) => queryTokenSet.has(token)).length;
  const subjectOverlap = subjectTokens.filter((token) => queryTokenSet.has(token)).length;
  const scopeOverlap = scopeTokens.filter((token) => queryTokenSet.has(token)).length;

  let score =
    axisOverlap * 4 +
    summaryOverlap +
    valueOverlap +
    subjectOverlap +
    scopeOverlap * 2.5;

  if (scopeOverlap > 0 && (valueOverlap > 0 || axisOverlap > 0)) {
    score += 2;
  }

  if (subjectOverlap > 0 && (valueOverlap > 0 || axisOverlap > 0)) {
    score += 1;
  }

  return score;
}

function buildChunkSupportSummary(chunk: {
  metadata?: unknown;
  knowledgeItems?: Array<{
    kind: string;
    label: string;
    valueText: string;
    normalizedValue?: string | null;
      supportClass: string;
      metadata?: unknown;
    }>;
  propositions?: Array<{
    predicate: string;
    facet?: string | null;
    objectValue: string;
    objectNormalized?: string | null;
    polarity: string;
    supportClass: string;
    evidenceTier: string;
    confidence: number;
    relationScope?: unknown;
    metadata?: unknown;
    patternKey: string;
    canonicalKey?: string | null;
    promotionState?: string | null;
    promotedAxis?: string | null;
    promotedFacet?: string | null;
  }>;
}) {
  const supportSummary = extractChunkSupportSummary(chunk.metadata);
  const axisSummaries = extractKnowledgeAxisSummaries(chunk.knowledgeItems ?? []);
  const metadataNotes = extractKnowledgeMetadataSummaries(chunk.knowledgeItems ?? []);
  const propositionSummaries = extractStructuredKnowledgePropositions(
    chunk.propositions ?? [],
    {
      layers: ['factual'],
    },
  ).map(buildKnowledgePropositionSummary);

  if (
    !supportSummary &&
    axisSummaries.length === 0 &&
    metadataNotes.length === 0 &&
    propositionSummaries.length === 0
  ) {
    return undefined;
  }

  const supportedAxes = Array.from(
    new Set([
      ...(supportSummary?.supportedAxes ?? []),
      ...axisSummaries.map((summary) => summary.axis),
    ]),
  );
  const unspecifiedAxes = Array.from(
    new Set([
      ...(supportSummary?.unspecifiedAxes ?? []),
      ...axisSummaries.flatMap((summary) => summary.unspecifiedAxes ?? []),
    ]),
  );

  return {
    topic: supportSummary?.topic,
    supportedAxes,
    unspecifiedAxes,
    axisSummaries: axisSummaries.length > 0 ? axisSummaries : undefined,
    metadataNotes: metadataNotes.length > 0 ? metadataNotes : undefined,
    propositionSummaries:
      propositionSummaries.length > 0 ? propositionSummaries : undefined,
    evidenceTier: (
      axisSummaries.length > 0
        ? 'typed_claim'
        : propositionSummaries.length > 0
          ? 'normalized_proposition'
          : undefined
    ) as 'typed_claim' | 'normalized_proposition' | undefined,
  };
}

function buildChunkStructuralText(chunk: {
  metadata?: unknown;
  propositions?: Array<{
    predicate: string;
    facet?: string | null;
    objectValue: string;
    objectNormalized?: string | null;
    polarity: string;
    supportClass: string;
    evidenceTier: string;
    confidence: number;
    relationScope?: unknown;
    metadata?: unknown;
    patternKey: string;
    canonicalKey?: string | null;
    promotionState?: string | null;
    promotedAxis?: string | null;
    promotedFacet?: string | null;
  }>;
  document?: { title?: string | null };
}) {
  if (!chunk.metadata || typeof chunk.metadata !== 'object' || Array.isArray(chunk.metadata)) {
    return normalizeConversationSignalText(chunk.document?.title ?? '');
  }

  const metadata = chunk.metadata as Record<string, unknown>;
  const supportSummary =
    metadata.supportSummary &&
    typeof metadata.supportSummary === 'object' &&
    !Array.isArray(metadata.supportSummary)
      ? (metadata.supportSummary as Record<string, unknown>)
      : null;
  const structuralBits = [
    typeof metadata.section === 'string' ? metadata.section : '',
    typeof metadata.parentSection === 'string' ? metadata.parentSection : '',
    typeof supportSummary?.topic === 'string' ? supportSummary.topic : '',
    buildStructuralKnowledgePropositionSummary({
      propositions: extractStructuredKnowledgePropositions(chunk.propositions ?? [], {
        layers: ['factual'],
      }),
      limit: 2,
    }),
    typeof chunk.document?.title === 'string' ? chunk.document.title : '',
  ].filter((value) => value.trim().length > 0);

  return normalizeConversationSignalText(structuralBits.join(' '));
}

function scoreTopicTokenOverlap(structuralText: string, topicTokens: string[]) {
  if (!structuralText || topicTokens.length === 0) {
    return 0;
  }

  const tokenSet = new Set(structuralText.split(/\s+/u).filter(Boolean));

  return topicTokens.filter((token) => tokenSet.has(token)).length;
}

function filterStructurallyCoherentMatches<
  T extends {
    structuralTopicOverlap: number;
    scopeAlignmentScore: number;
    axisAlignmentScore: number;
    requestedDetailTextAlignmentScore?: number;
    subjectTokens: string[];
  },
>(
  entries: T[],
  preferredTopicTokens: string[],
  requestedDetailTypes: ResponseGroundingDetailType[] = [],
  locale?: string | null,
) {
  if (entries.length <= 1 || preferredTopicTokens.length === 0) {
    return entries;
  }

  if (hasActionScopedRequestedDetails(requestedDetailTypes, locale)) {
    return entries;
  }

  const queryTokenSet = new Set(preferredTopicTokens);
  const anchor = entries[0];
  const anchorSubjectOverlap = anchor.subjectTokens.filter((token) =>
    queryTokenSet.has(token),
  ).length;
  const maxStructuralTopicOverlap = Math.max(
    ...entries.map((entry) => entry.structuralTopicOverlap),
    0,
  );
  let filtered = entries;

  if (anchorSubjectOverlap > 0) {
    const subjectFiltered = filtered.filter((entry) => {
      if (entry === anchor || entry.subjectTokens.length === 0) {
        return true;
      }

      const candidateSubjectOverlap = entry.subjectTokens.filter((token) =>
        queryTokenSet.has(token),
      ).length;

      return candidateSubjectOverlap > 0 || entry.scopeAlignmentScore > 0;
    });

    if (subjectFiltered.length > 0) {
      filtered = subjectFiltered;
    }
  }

  if (maxStructuralTopicOverlap < 2) {
    const maxRequestedDetailTextAlignment = Math.max(
      ...filtered.map((entry) => entry.requestedDetailTextAlignmentScore ?? 0),
      0,
    );

    if (requestedDetailTypes.length > 0 && maxRequestedDetailTextAlignment > 0) {
      const detailFiltered = filtered.filter(
        (entry) =>
          (entry.requestedDetailTextAlignmentScore ?? 0) >=
            Math.max(1, maxRequestedDetailTextAlignment - 1) ||
          entry.scopeAlignmentScore > 0,
      );

      if (detailFiltered.length > 0) {
        return detailFiltered;
      }
    }

    return filtered;
  }

  const minimumAllowedOverlap = Math.max(1, maxStructuralTopicOverlap - 1);
  const structureFiltered = filtered.filter(
    (entry) =>
      entry.structuralTopicOverlap >= minimumAllowedOverlap ||
      entry.scopeAlignmentScore > 0,
  );

  return structureFiltered.length > 0 ? structureFiltered : filtered;
}

function filterAxisLockedMatches<
  T extends {
    axisAlignmentScore: number;
    scopeAlignmentScore: number;
    subjectTokens: string[];
  },
>(entries: T[], focusTokens: string[]) {
  if (entries.length <= 1 || focusTokens.length === 0) {
    return entries;
  }

  const maxAxisAlignmentScore = Math.max(
    ...entries.map((entry) => entry.axisAlignmentScore),
    0,
  );

  if (maxAxisAlignmentScore < 4) {
    return entries;
  }

  const minimumAllowedAlignment = Math.max(1, maxAxisAlignmentScore - 3);
  const filtered = entries.filter(
    (entry) =>
      entry.axisAlignmentScore >= minimumAllowedAlignment ||
      entry.scopeAlignmentScore > 0,
  );

  return filtered.length > 0 ? filtered : entries;
}

function filterRequestedDetailMatches<
  T extends {
    requestedDetailAlignmentScore?: number;
    requestedDetailTextAlignmentScore?: number;
    scopeAlignmentScore: number;
  },
>(
  entries: T[],
  requestedDetailTypes: ResponseGroundingDetailType[] = [],
  locale?: string | null,
) {
  if (
    entries.length <= 1 ||
    requestedDetailTypes.length === 0 ||
    hasActionScopedRequestedDetails(requestedDetailTypes, locale)
  ) {
    return entries;
  }

  const maxAxisAlignment = Math.max(
    ...entries.map((entry) => entry.requestedDetailAlignmentScore ?? 0),
    0,
  );
  const maxTextAlignment = Math.max(
    ...entries.map((entry) => entry.requestedDetailTextAlignmentScore ?? 0),
    0,
  );

  if (maxAxisAlignment <= 0 && maxTextAlignment <= 0) {
    return entries;
  }

  const filtered = entries.filter(
    (entry) =>
      (entry.requestedDetailAlignmentScore ?? 0) >=
        Math.max(1, maxAxisAlignment - 3) ||
      (entry.requestedDetailTextAlignmentScore ?? 0) >=
        Math.max(1, maxTextAlignment - 1) ||
      entry.scopeAlignmentScore > 0,
  );

  return filtered.length > 0 ? filtered : entries;
}

function filterActionLockedMatches<
  T extends {
    actionCapabilityScore: number;
    scopeAlignmentScore: number;
  },
>(entries: T[], focusTokens: string[]) {
  if (entries.length <= 1 || focusTokens.length === 0) {
    return entries;
  }

  const maxActionCapabilityScore = Math.max(
    ...entries.map((entry) => entry.actionCapabilityScore),
    0,
  );

  if (maxActionCapabilityScore < 4) {
    return entries;
  }

  const filtered = entries.filter(
    (entry) =>
      entry.actionCapabilityScore >= Math.max(2, maxActionCapabilityScore - 2) ||
      entry.scopeAlignmentScore > 0,
  );

  return filtered.length > 0 ? filtered : entries;
}

function filterExactSubjectMatches<
  T extends {
    exactSubjectAlignmentScore: number;
  },
>(
  entries: T[],
  explicitSubjectTokens: string[],
  requestedDetailTypes: ResponseGroundingDetailType[] = [],
  locale?: string | null,
) {
  if (entries.length <= 1 || explicitSubjectTokens.length === 0) {
    return entries;
  }

  if (shouldBypassExactSubjectLock(requestedDetailTypes, locale)) {
    return entries;
  }

  const maxExactSubjectAlignment = Math.max(
    ...entries.map((entry) => entry.exactSubjectAlignmentScore),
    0,
  );

  if (maxExactSubjectAlignment < 4) {
    return entries;
  }

  const filtered = entries.filter(
    (entry) => entry.exactSubjectAlignmentScore >= maxExactSubjectAlignment - 1,
  );

  return filtered.length > 0 ? filtered : entries;
}

function shouldBypassExactSubjectLock(
  requestedDetailTypes: ResponseGroundingDetailType[],
  locale?: string | null,
) {
  return hasActionScopedRequestedDetails(requestedDetailTypes, locale);
}

function hasActionScopedRequestedDetails(
  requestedDetailTypes: ResponseGroundingDetailType[],
  locale?: string | null,
) {
  if (requestedDetailTypes.length === 0) {
    return false;
  }

  const catalog = resolveResponseGroundingCatalog(locale);
  const actionScopedAxes = ACTION_SCOPED_DETAIL_AXES;

  return requestedDetailTypes.some((detailType) =>
    (catalog.detailTypes[detailType]?.supportedAxes ?? []).some((axis) =>
      actionScopedAxes.has(axis),
    ),
  );
}

const ACTION_SCOPED_DETAIL_AXES = new Set([
  'service_offers',
  'commercial_visit_cost',
  'travel_cost_responsibility',
  'quote_fields',
  'quote_transition',
  'commercial_presence',
  'coverage_locations',
]);

const RECOMMENDATION_ORIENTATION_AXES = new Set([
  'comparison_guidance',
  'suitability',
  'feature_support',
  'materials',
  'product_types',
]);

function computeChunkRichness(chunk: {
  knowledgeItems?: Array<{
    kind: string;
    label: string;
    valueText: string;
    normalizedValue?: string | null;
      supportClass: string;
      metadata?: unknown;
    }>;
  propositions?: Array<{
    predicate: string;
    facet?: string | null;
    objectValue: string;
    objectNormalized?: string | null;
    polarity: string;
    supportClass: string;
    evidenceTier: string;
    confidence: number;
    relationScope?: unknown;
    metadata?: unknown;
    patternKey: string;
    canonicalKey?: string | null;
    promotionState?: string | null;
    promotedAxis?: string | null;
    promotedFacet?: string | null;
  }>;
  metadata?: unknown;
}) {
  const axisSummaries = extractKnowledgeAxisSummaries(chunk.knowledgeItems ?? []);
  const propositions = extractStructuredKnowledgePropositions(chunk.propositions ?? [], {
    layers: ['factual'],
  });
  const supportSummary = extractChunkSupportSummary(chunk.metadata);
  const valueCount = axisSummaries.reduce(
    (total, summary) => total + summary.values.length,
    0,
  );
  const scopeCount = axisSummaries.reduce(
    (total, summary) => total + (summary.appliesTo?.length ?? 0),
    0,
  );

  return (
    axisSummaries.length * 2 +
    propositions.length +
    valueCount +
    scopeCount +
    (supportSummary?.supportedAxes.length ?? 0)
  );
}

function extractChunkSubjectTokens(
  chunk: {
    knowledgeItems?: Array<{
      kind: string;
      label: string;
      valueText: string;
      normalizedValue?: string | null;
      supportClass: string;
      metadata?: unknown;
    }>;
    propositions?: Array<{
      predicate: string;
      facet?: string | null;
      objectValue: string;
      objectNormalized?: string | null;
      polarity: string;
      supportClass: string;
      evidenceTier: string;
      confidence: number;
      relationScope?: unknown;
      metadata?: unknown;
      patternKey: string;
      canonicalKey?: string | null;
      promotionState?: string | null;
      promotedAxis?: string | null;
      promotedFacet?: string | null;
    }>;
    metadata?: unknown;
  },
  locale?: string | null,
) {
  const subjectValues = extractKnowledgeAxisSummaries(chunk.knowledgeItems ?? [])
    .map((summary) =>
      [
        summary.subject?.axis ?? '',
        summary.subject?.normalizedValue ?? summary.subject?.value ?? '',
      ]
        .join(' ')
        .trim(),
    )
    .filter((value) => value.length > 0);
  const metadataSubjectValues = extractMetadataSubjectValues(chunk.metadata);
  const propositionSubjectValues = extractStructuredKnowledgePropositions(
    chunk.propositions ?? [],
    {
      layers: ['factual'],
    },
  )
    .flatMap((proposition) => [
      [
        proposition.subject?.axis ?? '',
        proposition.subject?.normalizedValue ?? proposition.subject?.value ?? '',
      ]
        .join(' ')
        .trim(),
      ...proposition.relationScope.map((scope) =>
        [scope.axis, scope.relation ?? '', scope.normalizedValue ?? scope.value]
          .join(' ')
          .trim(),
      ),
    ])
    .filter((value) => value.length > 0);

  return Array.from(
    new Set(
      [...subjectValues, ...metadataSubjectValues, ...propositionSubjectValues].flatMap((value) =>
        tokenizeSubjectQuery(value, locale),
      ),
    ),
  );
}

function scoreStructuredPropositionQueryAlignment(
  proposition: ReturnType<typeof extractStructuredKnowledgePropositions>[number],
  queryTokens: string[],
  locale?: string | null,
) {
  const summary = buildStructuralKnowledgePropositionSummary({
    locale,
    propositions: [proposition],
    limit: 1,
  });
  const axisTokens = tokenizeQuery(
    [
      resolveStructuralKnowledgeAxisLabel(proposition.predicate, locale),
      proposition.facet ?? '',
    ].join(' '),
    locale,
  );
  const summaryTokens = tokenizeQuery(summary, locale);
  const objectTokens = tokenizeQuery(
    proposition.objectNormalizedValue ?? proposition.objectValue,
    locale,
  );
  const subjectTokens = tokenizeQuery(
    `${proposition.subject?.axis ?? ''} ${proposition.subject?.normalizedValue ?? proposition.subject?.value ?? ''}`,
    locale,
  );
  const scopeTokens = tokenizeQuery(
    proposition.relationScope
      .map(
        (scope) =>
          `${scope.axis} ${scope.relation ?? ''} ${scope.normalizedValue ?? scope.value}`,
      )
      .join(' '),
    locale,
  );
  const queryTokenSet = new Set(queryTokens);
  const axisOverlap = axisTokens.filter((token) => queryTokenSet.has(token)).length;
  const summaryOverlap = summaryTokens.filter((token) => queryTokenSet.has(token)).length;
  const objectOverlap = objectTokens.filter((token) => queryTokenSet.has(token)).length;
  const subjectOverlap = subjectTokens.filter((token) => queryTokenSet.has(token)).length;
  const scopeOverlap = scopeTokens.filter((token) => queryTokenSet.has(token)).length;

  return (
    axisOverlap * 3 +
    summaryOverlap +
    objectOverlap * 2 +
    subjectOverlap * 2 +
    scopeOverlap * 2
  );
}

function extractMetadataSubjectValues(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return [];
  }

  const metadataRecord = metadata as Record<string, unknown>;
  const supportSummary = extractChunkSupportSummary(metadata);
  const values = [
    typeof metadataRecord.section === 'string' ? metadataRecord.section : '',
    typeof metadataRecord.parentSection === 'string'
      ? metadataRecord.parentSection
      : '',
    supportSummary?.topic ?? '',
  ].filter((value) => value.trim().length > 0);

  return Array.from(new Set(values));
}

function scoreExactSubjectAlignment(
  subjectTokens: string[],
  explicitSubjectTokens: string[],
) {
  if (subjectTokens.length === 0 || explicitSubjectTokens.length === 0) {
    return 0;
  }

  const subjectTokenSet = new Set(subjectTokens);
  const overlaps = explicitSubjectTokens.filter((token) => subjectTokenSet.has(token));
  const numericOverlap = overlaps.filter((token) => /\d/.test(token)).length;

  return overlaps.length + numericOverlap * 4;
}

function scoreScopeAlignment(
  knowledgeItems: Array<{
    kind: string;
    label: string;
    valueText: string;
    normalizedValue?: string | null;
    supportClass: string;
    metadata?: unknown;
  }>,
  focusTokens: string[],
  locale?: string | null,
) {
  if (focusTokens.length === 0) {
    return 0;
  }

  const claims = extractStructuredKnowledgeClaims(knowledgeItems, {
    layers: ['factual'],
  });
  const scopedClaims = claims.filter((claim) => (claim.appliesTo?.length ?? 0) > 0);

  if (scopedClaims.length === 0) {
    return 0;
  }

  const focusTokenSet = new Set(focusTokens);
  const scopeOverlap = Math.max(
    ...scopedClaims.map((claim) =>
      tokenizeQuery(
        (claim.appliesTo ?? [])
          .map((scope) => `${scope.axis} ${scope.normalizedValue ?? scope.value}`)
          .join(' '),
        locale,
      ).filter((token) => focusTokenSet.has(token)).length,
    ),
    0,
  );
  const subjectOverlap = Math.max(
    ...scopedClaims.map((claim) =>
      tokenizeQuery(
        `${claim.subject?.axis ?? ''} ${claim.subject?.normalizedValue ?? claim.subject?.value ?? ''}`,
        locale,
      ).filter((token) => focusTokenSet.has(token)).length,
    ),
    0,
  );

  if (scopeOverlap > 0) {
    return 2 + scopeOverlap;
  }

  if (subjectOverlap > 0) {
    return -1.5;
  }

  return 0;
}

function scoreAxisAlignment(
  knowledgeItems: Array<{
    kind: string;
    label: string;
    valueText: string;
    normalizedValue?: string | null;
    supportClass: string;
    metadata?: unknown;
  }>,
  focusTokens: string[],
  locale?: string | null,
) {
  if (focusTokens.length === 0) {
    return 0;
  }

  const focusTokenSet = new Set(focusTokens);
  const claims = extractStructuredKnowledgeClaims(knowledgeItems, {
    layers: ['factual'],
  });

  if (claims.length === 0) {
    return 0;
  }

  return Math.max(
    ...claims.map((claim) => {
      const axisTokens = tokenizeQuery(
        [
          resolveStructuralKnowledgeAxisLabel(claim.axis, locale),
          claim.facet ?? '',
        ].join(' '),
        locale,
      );
      const valueTokens = tokenizeQuery(claim.values.join(' '), locale);
      const subjectTokens = tokenizeQuery(
        `${claim.subject?.axis ?? ''} ${claim.subject?.normalizedValue ?? claim.subject?.value ?? ''}`,
        locale,
      );
      const scopeTokens = tokenizeQuery(
        (claim.appliesTo ?? [])
          .map((scope) => `${scope.axis} ${scope.normalizedValue ?? scope.value}`)
          .join(' '),
        locale,
      );
      const axisOverlap = axisTokens.filter((token) => focusTokenSet.has(token)).length;
      const valueOverlap = valueTokens.filter((token) => focusTokenSet.has(token)).length;
      const subjectOverlap = subjectTokens.filter((token) => focusTokenSet.has(token)).length;
      const scopeOverlap = scopeTokens.filter((token) => focusTokenSet.has(token)).length;

      let score =
        axisOverlap * 5 +
        valueOverlap * 3 +
        scopeOverlap * 4 +
        subjectOverlap * 2;

      if (score > 0) {
        score += claim.supportClass === 'explicit_fact' ? 2 : 1;
      }

      return score;
    }),
    0,
  );
}

function extractChunkSupportSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  const supportSummary =
    typeof metadataRecord.supportSummary === 'object' && metadataRecord.supportSummary
      ? (metadataRecord.supportSummary as Record<string, unknown>)
      : null;

  if (!supportSummary) {
    return undefined;
  }

  return {
    topic:
      typeof supportSummary.topic === 'string' ? supportSummary.topic : undefined,
    supportedAxes: Array.isArray(supportSummary.supportedAxes)
      ? supportSummary.supportedAxes.filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
    unspecifiedAxes: Array.isArray(supportSummary.unspecifiedAxes)
      ? supportSummary.unspecifiedAxes.filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
  };
}

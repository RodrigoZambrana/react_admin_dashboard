import { Injectable } from '@nestjs/common';

import type {
  ContinuityAwareInterpretation,
  ConversationStateSnapshot,
} from '../continuity/continuity.types';
import {
  normalizeConversationSignalText,
  tokenizeConversationSignalText,
} from '../conversation-signals/conversation-signal.catalogs';
import { ConversationSignalResolverService } from '../conversation-signals/conversation-signal-resolver.service';
import type { ConversationRoutingSignals } from '../conversation-signals/conversation-signal.types';
import type { DecisionResult } from '../decision/decision.types';
import { DocumentChunkRepository } from '../persistence/repositories/document-chunk.repository';
import { classifyDocumentChunkUsageBoundary } from './document-chunk-boundary';
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
    const explicitSubjectTopic = resolveExplicitSubjectTopic(
      input.interpretation.entities,
    );
    const reason = this.resolveReason(signals);

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
      explicitSubjectTopic,
    );
    const queryTokens = tokenizeQuery(query, input.interpretation.language);
    const preferredTopicText = resolvePreferredTopicText({
      currentTopic: signals.topicText || this.resolveRawMessage(input),
      previousTopic,
      explicitSubjectTopic,
      locale: input.interpretation.language,
    });
    const preferredTopicTokens = preferredTopicText
      ? tokenizeQuery(preferredTopicText, input.interpretation.language)
      : [];

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
    const chunks = await this.documentChunkRepository.listActiveReadyChunks(
      600,
      activeDocumentIds,
    );
    const scored = chunks
      .map((chunk) => {
        const usageBoundary = classifyDocumentChunkUsageBoundary({
          content: chunk.content,
          metadata:
            chunk.metadata && typeof chunk.metadata === 'object' && !Array.isArray(chunk.metadata)
              ? (chunk.metadata as Record<string, unknown>)
              : null,
        });

        return {
          chunk,
          usageBoundary,
          score: scoreChunk(query, queryTokens, chunk.searchText, {
            activeDocumentIds,
            preferredTopicTokens,
            hasTopicCarryover:
              Boolean(previousTopic) && signals.threading.topicCarryoverEligible,
            activeDocumentMatch:
              Boolean(activeDocumentIds?.includes(chunk.documentId)),
            usageBoundary,
          }),
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);
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
    const topMatched = relaxedMatched.slice(0, 4);

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
      excerpt: buildExcerpt(entry.chunk.content, queryTokens),
      sequence: entry.chunk.sequence,
      score: Number(entry.score.toFixed(3)),
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

  private resolveReason(signals: ConversationRoutingSignals) {
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

    return 'not_requested' as const;
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
    explicitSubjectTopic: string | null,
  ) {
    const currentTopic = signals.topicText || input.message.trim();
    const currentRawMessage = this.resolveRawMessage(input);
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

      if (
        previousTopic &&
        signals.threading.activeContinuation &&
        focusedQuery !== previousTopic
      ) {
        return `${previousTopic}. ${focusedQuery}`.trim();
      }

      return focusedQuery;
    }

    if (
      (reason === 'active_document_continuation' || reason === 'knowledge_query') &&
      previousTopic
    ) {
      if (
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
  searchText: string,
  input: {
    activeDocumentIds?: string[];
    preferredTopicTokens: string[];
    hasTopicCarryover: boolean;
    activeDocumentMatch: boolean;
    usageBoundary: 'knowledge' | 'operational';
  },
) {
  const tokenSet = new Set(searchText.split(/\s+/));
  let score = 0;

  for (const token of queryTokens) {
    if (tokenSet.has(token)) {
      score += 1;
    }
  }

  const normalizedQuery = normalizeConversationSignalText(query);

  if (normalizedQuery.length > 0 && searchText.includes(normalizedQuery)) {
    score += 4;
  }

  for (const phrase of buildTokenPhrases(queryTokens)) {
    if (searchText.includes(phrase)) {
      score += 2;
    }
  }

  const preferredTopicOverlapCount = input.preferredTopicTokens.filter((token) =>
    tokenSet.has(token),
  ).length;

  score += preferredTopicOverlapCount * 1.5;

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
  },
) {
  const rankedExcerpts = matches
    .slice(0, 3)
    .map((match) => ({
      sentence: normalizeSummaryExcerpt(match.excerpt),
      score: scoreSummaryExcerpt(match.excerpt, queryTokens),
      sequence: match.sequence,
      index: 0,
    }))
    .filter(
      (entry): entry is {
        sentence: string;
        score: number;
        sequence: number;
        index: number;
      } => Boolean(entry.sentence),
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
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

  for (const entry of candidateSentences) {
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

    if (selectedSentences.length >= (options?.incremental ? 1 : 2)) {
      break;
    }
  }

  return selectedSentences
    .join(' ')
    .slice(0, options?.incremental ? 220 : 320)
    .trim();
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

function tokenizeQuery(value: string, locale?: string | null) {
  return tokenizeConversationSignalText(value, {
    locale,
    minimumTokenLength: 3,
    stopWordSet: 'retrieval',
  });
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
    shouldPreferCurrentTopicOverPrevious({
      currentTopic: input.currentTopic,
      previousTopic: input.previousTopic,
      explicitSubjectTopic: input.explicitSubjectTopic,
      locale: input.locale,
    })
  ) {
    return input.explicitSubjectTopic?.trim() || input.currentTopic;
  }

  return input.previousTopic;
}

function shouldPreferCurrentTopicOverPrevious(input: {
  currentTopic: string;
  previousTopic: string;
  explicitSubjectTopic: string | null;
  locale?: string | null;
}) {
  const preferredCurrentTopic =
    input.explicitSubjectTopic?.trim() ||
    extractSubjectRefreshCandidate(input.currentTopic, input.locale);

  if (!preferredCurrentTopic) {
    return false;
  }

  const currentTokens = tokenizeConversationSignalText(preferredCurrentTopic, {
    locale: input.locale,
    minimumTokenLength: 2,
    stopWordSet: 'informative',
  });
  const previousTokens = new Set(
    tokenizeConversationSignalText(input.previousTopic, {
      locale: input.locale,
      minimumTokenLength: 2,
      stopWordSet: 'informative',
    }),
  );

  if (currentTokens.length < 2 || previousTokens.size === 0) {
    return false;
  }

  const overlapCount = currentTokens.filter((token) => previousTokens.has(token)).length;
  const novelTokenCount = currentTokens.length - overlapCount;

  return overlapCount > 0 && novelTokenCount > 0 && overlapCount < currentTokens.length;
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

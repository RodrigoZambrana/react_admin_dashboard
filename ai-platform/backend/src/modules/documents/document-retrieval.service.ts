import { Injectable } from '@nestjs/common';

import type {
  ContinuityAwareInterpretation,
  ConversationStateSnapshot,
} from '../continuity/continuity.types';
import { ConversationSignalResolverService } from '../conversation-signals/conversation-signal-resolver.service';
import type { ConversationRoutingSignals } from '../conversation-signals/conversation-signal.types';
import type { DecisionResult } from '../decision/decision.types';
import { DocumentChunkRepository } from '../persistence/repositories/document-chunk.repository';
import {
  DocumentRetrievalAttempt,
  DocumentRetrievalResult,
} from './document.types';

const stopWords = new Set([
  'a',
  'al',
  'and',
  'con',
  'cortina',
  'cortinas',
  'de',
  'del',
  'documento',
  'el',
  'en',
  'for',
  'if',
  'la',
  'las',
  'los',
  'me',
  'para',
  'por',
  'producto',
  'productos',
  'que',
  'si',
  'the',
  'una',
  'un',
  'y',
  'yo',
]);

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
    const reason = this.resolveReason(signals);

    if (reason === 'not_requested') {
      return {
        attempted: false,
        reason,
        result: null,
      };
    }

    const query = this.resolveQuery(input, reason, signals);
    const queryTokens = tokenize(query);

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
      .map((chunk) => ({
        chunk,
        score: scoreChunk(query, queryTokens, chunk.searchText),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);
    const minimumScore = resolveMinimumScore(queryTokens.length);
    const matched = scored.filter((entry) => entry.score >= minimumScore).slice(0, 4);

    if (matched.length === 0) {
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

    const matches = matched.map((entry) => ({
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
        groundedSummary: buildGroundedSummary(matches),
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
    if (signals.document.explicitRequest) {
      return 'document_query' as const;
    }

    if (signals.document.continuationEligible) {
      return 'active_document_continuation' as const;
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
  ) {
    const currentTopic = signals.topicText || input.message.trim();
    const previousTopic =
      this.resolveConversationTopic(input.conversationState) ?? null;

    if (
      reason === 'document_query' &&
      typeof signals.document.focusText === 'string' &&
      signals.document.focusText.trim().length > 0
    ) {
      return signals.document.focusText.trim();
    }

    if (reason === 'active_document_continuation' && previousTopic) {
      if (!currentTopic || currentTopic === previousTopic) {
        return previousTopic;
      }

      return `${previousTopic}. ${currentTopic}`.trim();
    }

    return currentTopic || previousTopic || input.message.trim();
  }

  private resolveConversationTopic(state: ConversationStateSnapshot | null | undefined) {
    if (!state || state.lane !== 'document_exploration') {
      return null;
    }

    const facts =
      state.approvedFacts && typeof state.approvedFacts === 'object'
        ? state.approvedFacts
        : {};

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
    if (!state || state.lane !== 'document_exploration') {
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
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function scoreChunk(query: string, queryTokens: string[], searchText: string) {
  const tokenSet = new Set(searchText.split(/\s+/));
  let score = 0;

  for (const token of queryTokens) {
    if (tokenSet.has(token)) {
      score += 1;
    }
  }

  const normalizedQuery = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalizedQuery.length > 0 && searchText.includes(normalizedQuery)) {
    score += 4;
  }

  for (const phrase of buildTokenPhrases(queryTokens)) {
    if (searchText.includes(phrase)) {
      score += 2;
    }
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
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  const matchedSentence =
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
      })[0]?.sentence ??
    sentences[0] ??
    content;

  return matchedSentence.slice(0, 260).trim();
}

function buildGroundedSummary(matches: DocumentRetrievalResult['matches']) {
  return matches
    .slice(0, 2)
    .map((match) => match.excerpt)
    .join(' ')
    .slice(0, 420)
    .trim();
}

function resolveMinimumScore(queryTokenCount: number) {
  if (queryTokenCount <= 2) {
    return 1;
  }

  return 2;
}

function scoreExcerptSentence(sentence: string, queryTokens: string[]) {
  const normalized = sentence
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

import { Injectable } from '@nestjs/common';

import type {
  ContinuityAwareInterpretation,
  ConversationStateSnapshot,
} from '../continuity/continuity.types';
import type { DecisionResult } from '../decision/decision.types';
import { DocumentChunkRepository } from '../persistence/repositories/document-chunk.repository';
import {
  DocumentRetrievalAttempt,
  DocumentRetrievalResult,
} from './document.types';

const documentCuePatterns = [
  /\bdocumento\b/i,
  /\bdocument\b/i,
  /\bcat[aá]logo\b/i,
  /\bcatalog\b/i,
  /\bseg[uú]n\b/i,
  /\bmanual\b/i,
  /\bcubre[n]?\b/i,
  /\bcobertura\b/i,
  /\bpolicy\b/i,
  /\bcovered\b/i,
] as const;

const stopWords = new Set([
  'a',
  'al',
  'and',
  'con',
  'de',
  'del',
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
  ) {}

  async retrieveForConversation(input: {
    message: string;
    interpretation: ContinuityAwareInterpretation;
    conversationState?: ConversationStateSnapshot | null;
  }): Promise<DocumentRetrievalAttempt> {
    const reason = this.resolveReason(input);

    if (reason === 'not_requested') {
      return {
        attempted: false,
        reason,
        result: null,
      };
    }

    const query = this.resolveQuery(input, reason);
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
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);

    if (scored.length === 0) {
      return {
        attempted: true,
        reason,
        result: null,
      };
    }

    const matches = scored.map((entry) => ({
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

  private resolveReason(input: {
    message: string;
    interpretation: ContinuityAwareInterpretation;
    conversationState?: ConversationStateSnapshot | null;
  }) {
    const rawMessage =
      typeof input.interpretation.entities.rawMessage === 'string'
        ? input.interpretation.entities.rawMessage
        : input.message;

    if (this.hasDocumentCue(rawMessage, input.interpretation)) {
      return 'document_query' as const;
    }

    if (this.isActiveDocumentContinuation(input.conversationState, input.interpretation)) {
      return 'active_document_continuation' as const;
    }

    return 'not_requested' as const;
  }

  private hasDocumentCue(
    rawMessage: string,
    interpretation: ContinuityAwareInterpretation,
  ) {
    const candidates = [
      rawMessage,
      typeof interpretation.entities.requestSummary === 'string'
        ? interpretation.entities.requestSummary
        : '',
      typeof interpretation.entities.productQuery === 'string'
        ? interpretation.entities.productQuery
        : '',
    ];

    return candidates.some((value) =>
      documentCuePatterns.some((pattern) => pattern.test(value)),
    );
  }

  private isActiveDocumentContinuation(
    state: ConversationStateSnapshot | null | undefined,
    interpretation: ContinuityAwareInterpretation,
  ) {
    if (state?.lane !== 'document_exploration') {
      return false;
    }

    return (
      interpretation.intent === 'GENERAL_CONVERSATION' ||
      interpretation.intent === 'CLARIFICATION' ||
      interpretation.intent === 'GET_PRODUCT'
    );
  }

  private resolveQuery(
    input: {
      message: string;
      interpretation: ContinuityAwareInterpretation;
      conversationState?: ConversationStateSnapshot | null;
    },
    reason: DocumentRetrievalAttempt['reason'],
  ) {
    const currentTopic =
      this.resolvePrimaryTopic(input.interpretation) ?? input.message.trim();
    const previousTopic =
      this.resolveConversationTopic(input.conversationState) ?? null;

    if (reason === 'active_document_continuation' && previousTopic) {
      if (!currentTopic || currentTopic === previousTopic) {
        return previousTopic;
      }

      return `${previousTopic}. ${currentTopic}`.trim();
    }

    return currentTopic || previousTopic || input.message.trim();
  }

  private resolvePrimaryTopic(interpretation: ContinuityAwareInterpretation) {
    if (
      typeof interpretation.entities.requestSummary === 'string' &&
      interpretation.entities.requestSummary.trim().length > 0
    ) {
      return interpretation.entities.requestSummary.trim();
    }

    if (
      typeof interpretation.entities.productQuery === 'string' &&
      interpretation.entities.productQuery.trim().length > 0
    ) {
      return interpretation.entities.productQuery.trim();
    }

    if (
      typeof interpretation.entities.rawMessage === 'string' &&
      interpretation.entities.rawMessage.trim().length > 0
    ) {
      return interpretation.entities.rawMessage.trim();
    }

    return null;
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
    sentences.find((sentence) => {
      const normalized = sentence
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');

      return queryTokens.some((token) => normalized.includes(token));
    }) ?? sentences[0] ?? content;

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

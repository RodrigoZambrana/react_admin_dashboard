import { Injectable } from '@nestjs/common';

import { DecisionResult } from '../decision/decision.types';
import { ParsedInterpretation } from '../parsing/parsing.service';
import { DocumentChunkRepository } from '../persistence/repositories/document-chunk.repository';
import { DocumentRetrievalAttempt, DocumentRetrievalResult } from './document.types';

const documentCuePatterns = [
  /\bdocumento\b/i,
  /\bseg[uú]n\b/i,
  /\bcubre[n]?\b/i,
  /\bcobertura\b/i,
  /\bpolicy\b/i,
  /\bmanual\b/i,
  /\bdocument\b/i,
  /\baccording to\b/i,
  /\bcovered\b/i,
];

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
    interpretation: ParsedInterpretation;
    decision: DecisionResult;
  }): Promise<DocumentRetrievalAttempt> {
    const reason = this.resolveReason(input);

    if (reason === 'not_requested') {
      return {
        attempted: false,
        reason,
        result: null,
      };
    }

    const query = this.resolveQuery(input);
    const queryTokens = tokenize(query);

    if (queryTokens.length === 0) {
      return {
        attempted: true,
        reason,
        result: null,
      };
    }

    const chunks = await this.documentChunkRepository.listActiveReadyChunks(600);
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

  private resolveReason(input: {
    message: string;
    interpretation: ParsedInterpretation;
    decision: DecisionResult;
  }) {
    const rawMessage =
      typeof input.interpretation.entities.rawMessage === 'string'
        ? input.interpretation.entities.rawMessage
        : input.message;
    const hasDocumentCue = documentCuePatterns.some((pattern) =>
      pattern.test(rawMessage),
    );

    if (!hasDocumentCue) {
      return 'not_requested' as const;
    }

    if (
      input.decision.action === 'invoke_tool' &&
      input.decision.toolName === 'create_booking'
    ) {
      return 'combined_booking_document_query' as const;
    }

    return 'document_query' as const;
  }

  private resolveQuery(input: {
    message: string;
    interpretation: ParsedInterpretation;
  }) {
    if (
      typeof input.interpretation.entities.requestSummary === 'string' &&
      input.interpretation.entities.requestSummary.trim().length > 0
    ) {
      return input.interpretation.entities.requestSummary.trim();
    }

    if (
      typeof input.interpretation.entities.productQuery === 'string' &&
      input.interpretation.entities.productQuery.trim().length > 0
    ) {
      return input.interpretation.entities.productQuery.trim();
    }

    if (
      typeof input.interpretation.entities.rawMessage === 'string' &&
      input.interpretation.entities.rawMessage.trim().length > 0
    ) {
      return input.interpretation.entities.rawMessage.trim();
    }

    return input.message.trim();
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
    score += 3;
  }

  return score;
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

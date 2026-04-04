import { Injectable } from '@nestjs/common';

import type { CanonicalIntent } from '../interpretation/interpretation.schemas';
import { resolveConversationSignalCatalog } from './conversation-signal.catalogs';
import type {
  ConversationRoutingSignals,
  ConversationSignalInput,
  ConversationSignalNamespaceCatalog,
  ConversationSignalNamespaceMatch,
} from './conversation-signal.types';

@Injectable()
export class ConversationSignalResolverService {
  resolve(input: ConversationSignalInput): ConversationRoutingSignals {
    const locale = this.normalizeLocale(input.interpretation.language);
    const topicText = this.resolveTopicText(input);
    const candidateTexts = this.resolveCandidateTexts(input);
    const catalog = resolveConversationSignalCatalog(locale);
    const normalizedTexts = candidateTexts.map((value) => normalizeText(value));
    const document = this.matchNamespace(catalog.document, normalizedTexts);
    const advisory = this.matchNamespace(catalog.advisory, normalizedTexts);
    const closure = this.matchNamespace(catalog.closure, normalizedTexts);
    const documentFocusText =
      document.lexicalScore > 0
        ? this.resolveFocusText(catalog.document, candidateTexts)
        : null;
    const primaryText = topicText || candidateTexts[0] || '';
    const questionLike = /[?¿]/u.test(primaryText);
    const descriptive = tokenize(primaryText).length >= 6 || primaryText.length >= 28;

    return {
      locale,
      topicText,
      candidateTexts,
      document: {
        ...document,
        focusText: documentFocusText,
        explicitRequest: document.lexicalScore > 0,
        continuationEligible:
          input.conversationState?.lane === 'document_exploration' &&
          this.isExplorationFollowUpIntent(input.interpretation.intent),
      },
      advisory: {
        ...advisory,
        questionLike,
        descriptive,
        supported: advisory.lexicalScore > 0 || (questionLike && descriptive),
        continuationEligible:
          input.conversationState?.lane === 'advisory_exploration' &&
          this.isExplorationFollowUpIntent(input.interpretation.intent),
      },
      closure: {
        ...closure,
        gratitude: closure.matchedCategories.includes('gratitude'),
        decline: closure.matchedCategories.includes('decline'),
        farewell: closure.matchedCategories.includes('farewell'),
        supported: closure.lexicalScore > 0,
      },
    };
  }

  resolveTopicText(input: Pick<ConversationSignalInput, 'message' | 'interpretation'>) {
    const entities = input.interpretation.entities;

    if (
      typeof entities.requestSummary === 'string' &&
      entities.requestSummary.trim().length > 0
    ) {
      return entities.requestSummary.trim();
    }

    if (
      typeof entities.productQuery === 'string' &&
      entities.productQuery.trim().length > 0
    ) {
      return entities.productQuery.trim();
    }

    if (
      typeof entities.rawMessage === 'string' &&
      entities.rawMessage.trim().length > 0
    ) {
      return entities.rawMessage.trim();
    }

    return input.message.trim();
  }

  private resolveCandidateTexts(input: ConversationSignalInput) {
    const entities = input.interpretation.entities;

    return dedupe([
      typeof entities.rawMessage === 'string' ? entities.rawMessage : '',
      typeof entities.requestSummary === 'string' ? entities.requestSummary : '',
      typeof entities.productQuery === 'string' ? entities.productQuery : '',
      input.message,
    ]);
  }

  private resolveFocusText(
    namespace: ConversationSignalNamespaceCatalog,
    candidateTexts: string[],
  ) {
    const segmentCandidates = buildSegmentCandidates(candidateTexts);
    let best: { segment: string; focusScore: number } | null = null;

    for (const segment of segmentCandidates) {
      const match = this.matchNamespace(namespace, [normalizeText(segment)]);
      const focusScore =
        match.lexicalScore +
        countInformativeTokens(segment, match.matchedTerms) * 2;

      if (focusScore <= 0) {
        continue;
      }

      if (
        !best ||
        focusScore > best.focusScore ||
        (focusScore === best.focusScore &&
          segment.length < best.segment.length)
      ) {
        best = {
          segment,
          focusScore,
        };
      }
    }

    return best?.segment ?? null;
  }

  private matchNamespace(
    namespace: ConversationSignalNamespaceCatalog,
    normalizedTexts: string[],
  ): ConversationSignalNamespaceMatch {
    const matchedCategories = new Set<string>();
    const matchedTerms = new Set<string>();
    const matchedPhrases = new Set<string>();
    let lexicalScore = 0;

    for (const [category, lexicon] of Object.entries(namespace)) {
      const normalizedTerms = (lexicon.terms ?? []).map((value) => normalizeText(value));
      const normalizedPhrases = (lexicon.phrases ?? []).map((value) =>
        normalizeText(value),
      );
      let categoryScore = 0;

      for (const text of normalizedTexts) {
        const tokenSet = new Set(tokenize(text));

        for (const term of normalizedTerms) {
          if (!term || matchedTerms.has(term)) {
            continue;
          }

          if (tokenSet.has(term)) {
            matchedTerms.add(term);
            categoryScore += 1;
          }
        }

        for (const phrase of normalizedPhrases) {
          if (!phrase || matchedPhrases.has(phrase)) {
            continue;
          }

          if (text.includes(phrase)) {
            matchedPhrases.add(phrase);
            categoryScore += 2;
          }
        }
      }

      if (categoryScore > 0) {
        matchedCategories.add(category);
        lexicalScore += categoryScore;
      }
    }

    return {
      lexicalScore,
      matchedCategories: Array.from(matchedCategories.values()),
      matchedTerms: Array.from(matchedTerms.values()),
      matchedPhrases: Array.from(matchedPhrases.values()),
    };
  }

  private normalizeLocale(value?: string | null) {
    const locale = String(value ?? '').trim().toLowerCase();
    return locale.length > 0 ? locale : 'default';
  }

  private isExplorationFollowUpIntent(intent: CanonicalIntent) {
    return (
      intent === 'GENERAL_CONVERSATION' ||
      intent === 'CLARIFICATION' ||
      intent === 'GET_PRODUCT'
    );
  }
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function dedupe(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function buildSegmentCandidates(values: string[]) {
  return dedupe(
    values.flatMap((value) =>
      value
        .split(/[.!?;,\n]+/u)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0),
    ),
  );
}

function countInformativeTokens(value: string, matchedTerms: string[]) {
  const matched = new Set(matchedTerms.map((term) => normalizeText(term)));

  return tokenize(value).filter(
    (token) => token.length > 2 && !signalStopWords.has(token) && !matched.has(token),
  ).length;
}

const signalStopWords = new Set([
  'a',
  'al',
  'de',
  'del',
  'el',
  'en',
  'la',
  'las',
  'los',
  'para',
  'por',
  'que',
  'segun',
  'si',
  'the',
  'what',
  'y',
]);

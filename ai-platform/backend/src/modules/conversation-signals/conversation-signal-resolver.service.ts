import { Injectable } from '@nestjs/common';

import type { CanonicalIntent } from '../interpretation/interpretation.schemas';
import {
  normalizeConversationSignalText,
  resolveConversationSignalCatalog,
  tokenizeConversationSignalText,
} from './conversation-signal.catalogs';
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
    const normalizedTexts = candidateTexts.map((value) =>
      normalizeConversationSignalText(value),
    );
    const document = this.matchNamespace(catalog.document, normalizedTexts);
    const advisory = this.matchNamespace(catalog.advisory, normalizedTexts);
    const closure = this.matchNamespace(catalog.closure, normalizedTexts);
    const threading = this.matchNamespace(catalog.threading, normalizedTexts);
    const noise = this.matchNamespace(catalog.noise, normalizedTexts);
    const documentFocusText =
      document.lexicalScore > 0
        ? this.resolveFocusText(catalog.document, candidateTexts, locale)
        : null;
    const primaryText = topicText || candidateTexts[0] || '';
    const primaryTokens = tokenizeConversationSignalText(primaryText, {
      locale,
      minimumTokenLength: 2,
      stopWordSet: null,
    });
    const questionLike = /[?¿]/u.test(primaryText);
    const descriptive = primaryTokens.length >= 6 || primaryText.length >= 28;
    const shortFollowUp =
      threading.matchedCategories.includes('short_follow_up') ||
      (primaryTokens.length > 0 &&
        primaryTokens.length <= 4 &&
        primaryText.length <= 40 &&
        !questionLike);
    const resume = threading.matchedCategories.includes('resume');
    const switchSuggested =
      threading.matchedCategories.includes('switch') &&
      (primaryTokens.length >= 3 || primaryText.length >= 24);
    const channelInterference = noise.matchedCategories.includes('auto_reply');
    const activeContinuation =
      Boolean(input.conversationState) &&
      this.isExplorationFollowUpIntent(input.interpretation.intent) &&
      !switchSuggested &&
      !channelInterference &&
      (shortFollowUp || resume);

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
          this.isExplorationFollowUpIntent(input.interpretation.intent) &&
          !switchSuggested &&
          !channelInterference,
      },
      advisory: {
        ...advisory,
        questionLike,
        descriptive,
        supported: advisory.lexicalScore > 0 || (questionLike && descriptive),
        continuationEligible:
          input.conversationState?.lane === 'advisory_exploration' &&
          this.isExplorationFollowUpIntent(input.interpretation.intent) &&
          !switchSuggested &&
          !channelInterference,
      },
      closure: {
        ...closure,
        gratitude: closure.matchedCategories.includes('gratitude'),
        decline: closure.matchedCategories.includes('decline'),
        farewell: closure.matchedCategories.includes('farewell'),
        supported: closure.lexicalScore > 0,
      },
      threading: {
        ...threading,
        shortFollowUp,
        resume,
        switchSuggested,
        activeContinuation,
      },
      noise: {
        ...noise,
        channelInterference,
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
    locale: string,
  ) {
    const segmentCandidates = buildSegmentCandidates(candidateTexts);
    let best: { segment: string; focusScore: number } | null = null;

    for (const segment of segmentCandidates) {
      const match = this.matchNamespace(namespace, [
        normalizeConversationSignalText(segment),
      ]);
      const focusScore =
        match.lexicalScore +
        countInformativeTokens(segment, match.matchedTerms, locale) * 2;

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
      const normalizedTerms = (lexicon.terms ?? []).map((value) =>
        normalizeConversationSignalText(value),
      );
      const normalizedPhrases = (lexicon.phrases ?? []).map((value) =>
        normalizeConversationSignalText(value),
      );
      let categoryScore = 0;

      for (const text of normalizedTexts) {
        const tokenSet = new Set(
          tokenizeConversationSignalText(text, {
            minimumTokenLength: 2,
            stopWordSet: null,
          }),
        );

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

function countInformativeTokens(
  value: string,
  matchedTerms: string[],
  locale: string,
) {
  const matched = new Set(
    matchedTerms.map((term) => normalizeConversationSignalText(term)),
  );

  return tokenizeConversationSignalText(value, {
    locale,
    minimumTokenLength: 3,
    stopWordSet: 'informative',
  }).filter((token) => !matched.has(token)).length;
}

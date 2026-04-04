import type {
  ContinuityAwareInterpretation,
  ConversationStateSnapshot,
} from '../continuity/continuity.types';

export type ConversationSignalLexiconEntry = {
  terms?: string[];
  phrases?: string[];
};

export type ConversationSignalNamespaceCatalog = Record<
  string,
  ConversationSignalLexiconEntry
>;

export type ConversationSignalCatalog = {
  document: ConversationSignalNamespaceCatalog;
  advisory: ConversationSignalNamespaceCatalog;
};

export type ConversationSignalInput = {
  message: string;
  interpretation: Pick<
    ContinuityAwareInterpretation,
    'intent' | 'language' | 'entities'
  >;
  conversationState?: ConversationStateSnapshot | null;
};

export type ConversationSignalNamespaceMatch = {
  lexicalScore: number;
  matchedCategories: string[];
  matchedTerms: string[];
  matchedPhrases: string[];
};

export type ConversationRoutingSignals = {
  locale: string;
  topicText: string;
  candidateTexts: string[];
  document: ConversationSignalNamespaceMatch & {
    focusText: string | null;
    explicitRequest: boolean;
    continuationEligible: boolean;
  };
  advisory: ConversationSignalNamespaceMatch & {
    questionLike: boolean;
    descriptive: boolean;
    supported: boolean;
    continuationEligible: boolean;
  };
};

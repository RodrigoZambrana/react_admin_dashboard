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
  closure: ConversationSignalNamespaceCatalog;
  threading: ConversationSignalNamespaceCatalog;
  noise: ConversationSignalNamespaceCatalog;
  textSupport: {
    informativeStopWords: string[];
    retrievalStopWords: string[];
  };
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
    implicitEligible: boolean;
    continuationEligible: boolean;
  };
  advisory: ConversationSignalNamespaceMatch & {
    questionLike: boolean;
    descriptive: boolean;
    supported: boolean;
    continuationEligible: boolean;
  };
  closure: ConversationSignalNamespaceMatch & {
    gratitude: boolean;
    decline: boolean;
    farewell: boolean;
    supported: boolean;
  };
  threading: ConversationSignalNamespaceMatch & {
    shortFollowUp: boolean;
    resume: boolean;
    switchSuggested: boolean;
    activeContinuation: boolean;
  };
  noise: ConversationSignalNamespaceMatch & {
    channelInterference: boolean;
  };
};

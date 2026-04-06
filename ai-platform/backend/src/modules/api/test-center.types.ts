export type TestCenterScenarioSourceKind = 'curated' | 'derived';

export type TestCenterScenarioCategory =
  | 'supported_information'
  | 'unsupported_information'
  | 'edge_case';

export type TestCenterTurnExpectation = {
  topicTerms?: string[];
  mustMentionAll?: string[];
  mustMentionAtLeast?: Array<{
    terms: string[];
    count: number;
    label?: string;
  }>;
  shouldNotMention?: string[];
  shouldAvoidStructuralSummary?: boolean;
  expectedClose?: boolean;
  allowPrudentUnknown?: boolean;
  preferredResponseMode?: 'answer' | 'prudent' | 'close';
};

export type TestCenterScenarioTurn = {
  message: string;
  locale?: string;
  expectation?: TestCenterTurnExpectation;
};

export type TestCenterScenario = {
  id: string;
  label: string;
  description: string;
  locale: string;
  sourceKind: TestCenterScenarioSourceKind;
  category: TestCenterScenarioCategory;
  tags: string[];
  documentTitle?: string | null;
  documentId?: string | null;
  turns: TestCenterScenarioTurn[];
};

export type TestCenterReplayTurnResult = {
  input: string;
  locale?: string | null;
  traceId: string;
  response: string;
  intent: string;
  metadata: {
    conversationId: string;
    traceId: string;
  };
};

export type TestCenterTurnMetricStatus = 'pass' | 'warn' | 'fail';

export type TestCenterTurnEvaluation = {
  turnIndex: number;
  traceId?: string | null;
  userMessage: string;
  assistantMessage: string;
  overallScore: number;
  correctnessScore: number;
  coherenceScore: number;
  fluencyScore: number;
  writingQualityScore: number;
  status: TestCenterTurnMetricStatus;
  issues: string[];
  matchedSignals: string[];
};

export type TestCenterConversationEvaluation = {
  scenarioId?: string | null;
  scenarioLabel: string;
  scenarioSourceKind: TestCenterScenarioSourceKind;
  locale?: string | null;
  overallScore: number;
  correctnessScore: number;
  coherenceScore: number;
  fluencyScore: number;
  writingQualityScore: number;
  status: TestCenterTurnMetricStatus;
  summaryLines: string[];
  turns: TestCenterTurnEvaluation[];
};

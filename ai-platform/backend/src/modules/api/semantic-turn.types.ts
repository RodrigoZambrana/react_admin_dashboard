import type { Prisma } from '@prisma/client';

import type {
  ContinuityMetadata,
  ConversationStateSnapshot,
} from '../continuity/continuity.types';
import type { DecisionResult } from '../decision/decision.types';
import type { InterpretationAttempt } from '../interpretation/interpretation.schemas';
import type { ParsedInterpretation } from '../parsing/parsing.service';
import type { GeneratedChatResponse } from '../response/response.types';
import type { ToolExecutionAttempt } from '../tools/tool.types';

export type SemanticTurnExecutionResult = {
  response: string;
  intent: string;
  entities: Record<string, unknown>;
  metadata: {
    conversationId: string;
    traceId: string;
  };
  incomingMessageId: string;
  outgoingMessageId: string | null;
  interpretationResult: InterpretationAttempt;
  parsedInterpretation: ParsedInterpretation;
  decision: DecisionResult;
  execution: ToolExecutionAttempt | null;
  continuity: ContinuityMetadata;
  conversationState: ConversationStateSnapshot | null;
  approvedResponse: GeneratedChatResponse;
  assistantMessageMetadata: Prisma.InputJsonValue;
  approvedResponseDraft: string;
};

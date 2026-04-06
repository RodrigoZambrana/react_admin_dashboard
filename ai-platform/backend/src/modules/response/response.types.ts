import { z } from 'zod';

import type { ContinuityMetadata, ConversationStateSnapshot } from '../continuity/continuity.types';
import type { DecisionResult } from '../decision/decision.types';
import type { DocumentRetrievalResult } from '../documents/document.types';
import type { DocumentKnowledgeAxisSummary } from '../documents/document.types';
import type { DocumentKnowledgeMetadataSummary } from '../documents/document.types';
import type { CanonicalIntent } from '../interpretation/interpretation.schemas';
import type { ParsedInterpretation } from '../parsing/parsing.service';
import type { ToolExecutionAttempt } from '../tools/tool.types';

export const approvedResponseOutcomeSchema = z.enum([
  'respond',
  'clarify',
  'execution_succeeded',
  'execution_failed',
  'close_turn',
]);

export const approvedExecutionStatusSchema = z.enum([
  'not_applicable',
  'succeeded',
  'failed',
]);

export const aiGeneratedResponseSchema = z.object({
  message: z.string().min(1).max(500),
  assertedOutcome: approvedResponseOutcomeSchema,
  assertedExecutionStatus: approvedExecutionStatusSchema,
  mentionedMissingFields: z.array(z.string()).default([]),
  mentionedApprovedFactKeys: z.array(z.string()).default([]),
  mentionedApprovedResultKeys: z.array(z.string()).default([]),
  mentionedDocumentIds: z.array(z.string()).default([]),
});

export type ApprovedResponseOutcome = z.infer<
  typeof approvedResponseOutcomeSchema
>;
export type ApprovedExecutionStatus = z.infer<
  typeof approvedExecutionStatusSchema
>;
export type AiGeneratedResponse = z.infer<typeof aiGeneratedResponseSchema>;

export type ResponseGuardrailCode =
  | 'outcome_mismatch'
  | 'execution_status_mismatch'
  | 'unsupported_missing_fields'
  | 'unsupported_fact_keys'
  | 'unsupported_result_keys'
  | 'unsupported_document_ids'
  | 'unsupported_document_detail'
  | 'missing_required_detail_axis'
  | 'wrong_unspecified_detail_axis'
  | 'partial_document_detail_overclaim'
  | 'document_context_overreach'
  | 'close_turn_reopen'
  | 'duplicate_opening_greeting'
  | 'unexpected_followup_greeting';

export const responseGroundingDetailTypeSchema = z.enum([
  'coverage_support',
  'pricing',
  'payment_terms',
  'purchase_channel',
  'availability',
  'warranty',
  'materials',
  'color_options',
  'specific_variants',
]);

export type ResponseGroundingDetailType = z.infer<
  typeof responseGroundingDetailTypeSchema
>;

export type ResponseGuardrailResult = {
  accepted: boolean;
  reasons: ResponseGuardrailCode[];
};

export type ApprovedResponseContext = {
  locale: string;
  userMessage: string;
  intent: CanonicalIntent;
  decision: DecisionResult;
  outcome: ApprovedResponseOutcome;
  interpretation: {
    language: string;
    confidence: number;
    entities: Record<string, unknown>;
    normalizedEntities: ParsedInterpretation['normalizedEntities'];
  };
  execution: {
    status: ApprovedExecutionStatus;
    toolName: string | null;
    validatedInputSummary: Record<string, unknown> | null;
    resultSummary: Record<string, unknown> | null;
    failure: {
      code: string;
      message: string;
      details: Record<string, unknown> | null;
    } | null;
  };
  continuity?: {
    activeLane: ContinuityMetadata['activeLane'];
    applied: boolean;
    carriedFactKeys: string[];
    invalidatedFactKeys: string[];
    missingFields: string[];
    nextUsefulField?: string;
    previousStateSummary: ContinuityMetadata['previousStateSummary'];
  };
  conversationState?: {
    lane: ConversationStateSnapshot['lane'];
    missingFields: string[];
    nextUsefulField?: string;
    lastApprovedAction?: ConversationStateSnapshot['lastApprovedAction'];
    lastApprovedToolName?: ConversationStateSnapshot['lastApprovedToolName'];
    approvedFacts?: Record<string, unknown>;
    lastApprovedResult?: Record<string, unknown>;
  };
  missingFields?: string[];
  nextUsefulField?: string;
  approvedFactKeys: string[];
  approvedResultKeys: string[];
  documentContext?: {
    source: 'document_origin';
    query: string;
    groundedSummary: string;
    responseMode: 'document_exploration' | 'combined_execution';
    grounding: {
      supportLevel: 'explicit' | 'partial' | 'unavailable';
      exactnessRequested: boolean;
      requestedDetailTypes: ResponseGroundingDetailType[];
      supportedDetailTypes: ResponseGroundingDetailType[];
      partialDetailTypes: ResponseGroundingDetailType[];
      unsupportedDetailTypes: ResponseGroundingDetailType[];
      requiredUnspecifiedDetailTypes?: ResponseGroundingDetailType[];
    };
    matches: Array<{
      documentId: string;
      title: string;
      sequence: number;
      score: number;
      excerpt?: string;
      supportSummary?: {
        topic?: string;
        supportedAxes: string[];
        unspecifiedAxes: string[];
        axisSummaries?: DocumentKnowledgeAxisSummary[];
        metadataNotes?: DocumentKnowledgeMetadataSummary[];
      };
    }>;
  };
  responseStyle?: {
    preferBrief: boolean;
    incrementalFollowUp: boolean;
    groundedKnowledgeOnly: boolean;
    includeInitialGreeting: boolean;
    preferMultiline: boolean;
    hasPriorConversation: boolean;
  };
  approvedDocumentIds: string[];
};

export type ApprovedResponseContextInput = {
  message: string;
  interpretation: ParsedInterpretation;
  decision: DecisionResult;
  execution: ToolExecutionAttempt | null;
  continuity: ContinuityMetadata;
  conversationState: ConversationStateSnapshot | null;
  documentContext: DocumentRetrievalResult | null;
  hasPriorMessages?: boolean;
};

export type GeneratedChatResponse = {
  response: string;
  approvedContext: ApprovedResponseContext;
  approvedDraft: string;
  usedFallback: boolean;
  fallbackReason:
    | 'generation_failed'
    | 'guardrail_rejected'
    | 'policy_locked'
    | null;
  generation: {
    provider: string;
    model: string | null;
    promptId: string | null;
    promptVersion: number | null;
    rawAiResponse: string | null;
    parsedJson: AiGeneratedResponse | null;
    error: string | null;
    guardrails: ResponseGuardrailResult;
  };
};

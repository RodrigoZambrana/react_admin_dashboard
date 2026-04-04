import { CanonicalIntent } from '../interpretation/interpretation.schemas';
import { ParsedInterpretation } from '../parsing/parsing.service';
import { NormalizedDate } from '../parsing/date.parser';
import { NormalizedDimension } from '../parsing/dimension.parser';
import { NormalizedMeasurement } from '../parsing/measurement.parser';
import { DecisionAction, ToolName } from '../decision/decision.types';

export const conversationLaneValues = [
  'booking',
  'quote',
  'product_lookup',
  'document_exploration',
  'advisory_exploration',
  'core_knowledge',
  'handoff',
] as const;

export type ConversationLane = (typeof conversationLaneValues)[number];

export type ContinuityApprovedAction =
  | DecisionAction
  | 'retrieve_core_knowledge'
  | 'handoff'
  | 'close_turn';

export type ContinuityFacts = Record<string, unknown>;

export type ConversationStateSnapshot = {
  conversationId: string;
  lane: ConversationLane;
  lastIntent?: CanonicalIntent;
  lastApprovedAction?: ContinuityApprovedAction;
  lastApprovedToolName?: ToolName;
  approvedFacts?: ContinuityFacts;
  pendingFacts?: ContinuityFacts;
  missingFields: string[];
  nextUsefulField?: string;
  lastApprovedResult?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  updatedAt?: string;
};

export type ContinuityMetadata = {
  applied: boolean;
  activeLane: ConversationLane | null;
  carriedFactKeys: string[];
  invalidatedFactKeys: string[];
  missingFields: string[];
  nextUsefulField?: string;
  previousStateSummary: {
    lane: ConversationLane;
    missingFields: string[];
    nextUsefulField?: string;
    lastApprovedAction?: ContinuityApprovedAction;
  } | null;
};

export type ContinuityAwareInterpretation = ParsedInterpretation & {
  continuity?: ContinuityMetadata;
};

export type PreparedContinuityTurn = {
  previousState: ConversationStateSnapshot | null;
  activeState: ConversationStateSnapshot | null;
  effectiveInterpretation: ContinuityAwareInterpretation;
  continuity: ContinuityMetadata;
};

export type BookingFacts = {
  requestedDate?: NormalizedDate;
  attendees?: number;
  requestSummary?: string;
};

export type QuoteFacts = {
  requestSummary?: string;
  attendees?: number;
  measurements?: NormalizedMeasurement[];
  dimensions?: NormalizedDimension[];
};

export type ProductFacts = {
  query?: string;
  sku?: string;
};

export type DocumentExplorationFacts = {
  topicSummary?: string;
  activeDocumentIds?: string[];
  lastDocumentQuery?: string;
  lastGroundedSummary?: string;
  lastDocumentTitles?: string[];
};

export type AdvisoryExplorationFacts = {
  topicSummary?: string;
  criteriaSignals?: string[];
};

export const laneByIntent: Partial<Record<CanonicalIntent, ConversationLane>> = {
  CREATE_BOOKING: 'booking',
  CREATE_QUOTE: 'quote',
  GET_PRODUCT: 'product_lookup',
};

export const intentByLane: Record<ConversationLane, CanonicalIntent> = {
  booking: 'CREATE_BOOKING',
  quote: 'CREATE_QUOTE',
  product_lookup: 'GET_PRODUCT',
  document_exploration: 'GENERAL_CONVERSATION',
  advisory_exploration: 'GENERAL_CONVERSATION',
  core_knowledge: 'GENERAL_CONVERSATION',
  handoff: 'GENERAL_CONVERSATION',
};

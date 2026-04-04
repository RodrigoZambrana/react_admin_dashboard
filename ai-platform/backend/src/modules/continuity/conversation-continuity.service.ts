import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DecisionResult } from '../decision/decision.types';
import { DocumentRetrievalAttempt } from '../documents/document.types';
import { CanonicalIntent } from '../interpretation/interpretation.schemas';
import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { ParsedInterpretation } from '../parsing/parsing.service';
import { ConversationStateRepository } from '../persistence/repositories/conversation-state.repository';
import { ToolExecutionAttempt } from '../tools/tool.types';
import {
  BookingFacts,
  ContinuityAwareInterpretation,
  ContinuityFacts,
  ContinuityMetadata,
  ConversationLane,
  ConversationStateSnapshot,
  DocumentExplorationFacts,
  AdvisoryExplorationFacts,
  ProductFacts,
  PreparedContinuityTurn,
  QuoteFacts,
  intentByLane,
  laneByIntent,
} from './continuity.types';

const FUTURE_COMPATIBLE_ACTIONS = [
  'retrieve_core_knowledge',
  'handoff',
  'close_turn',
] as const;

@Injectable()
export class ConversationContinuityService {
  constructor(
    private readonly stateRepository: ConversationStateRepository,
    private readonly logger: PipelineLoggerService,
  ) {}

  async prepareTurn(input: {
    conversationId: string;
    interpretation: ParsedInterpretation;
  }): Promise<PreparedContinuityTurn> {
    const previousState = await this.getState(input.conversationId);
    const explicitLane = this.resolveExplicitLane(input.interpretation.intent);
    const suppressExplicitInvalidation = Boolean(
      previousState &&
        explicitLane &&
        previousState.lane !== explicitLane &&
        this.shouldPreserveExplorationLane(previousState, explicitLane),
    );
    const invalidatedFactKeys =
      previousState &&
      explicitLane &&
      previousState.lane !== explicitLane &&
      !suppressExplicitInvalidation
        ? this.collectStateFactKeys(previousState)
        : [];
    const activeState =
      invalidatedFactKeys.length > 0 ? null : previousState ?? null;
    const carryLane = this.resolveCarryLane(activeState, input.interpretation);
    const currentFacts = carryLane
      ? this.extractLaneFacts(carryLane, input.interpretation)
      : null;
    const carryableFacts = carryLane
      ? this.getCarryableFacts(activeState, carryLane)
      : null;
    const mergedFacts =
      carryLane && carryableFacts
        ? this.mergeLaneFacts(carryLane, carryableFacts, currentFacts ?? {})
        : null;
    const carriedFactKeys =
      carryLane && carryableFacts && mergedFacts
        ? Object.keys(carryableFacts).filter(
            (key) =>
              !this.hasMeaningfulValue((currentFacts ?? {})[key]) &&
              this.hasMeaningfulValue(mergedFacts[key]),
          )
        : [];
    const shouldPromoteLane =
      Boolean(carryLane) &&
      !explicitLane &&
      this.isImplicitContinuationCandidate(input.interpretation) &&
      carriedFactKeys.length + Object.keys(currentFacts ?? {}).length > 0;
    const effectiveInterpretation = mergedFacts
      ? this.applyLaneFacts(input.interpretation, carryLane!, mergedFacts, {
          promoteLane: shouldPromoteLane,
          invalidatedFactKeys,
          activeState,
          carriedFactKeys,
        })
      : this.attachContinuityMetadata(input.interpretation, {
          applied: false,
          activeLane: activeState?.lane ?? null,
          carriedFactKeys: [],
          invalidatedFactKeys,
          missingFields: activeState?.missingFields ?? [],
          nextUsefulField: activeState?.nextUsefulField,
          previousStateSummary: this.buildStateSummary(activeState),
        });

    this.logger.log(
      JSON.stringify({
        stage: 'continuity',
        output: {
          conversationId: input.conversationId,
          activeLane: effectiveInterpretation.continuity?.activeLane ?? null,
          applied: effectiveInterpretation.continuity?.applied ?? false,
          carriedFactKeys:
            effectiveInterpretation.continuity?.carriedFactKeys ?? [],
          invalidatedFactKeys,
        },
      }),
    );

    return {
      previousState,
      activeState,
      effectiveInterpretation,
      continuity: effectiveInterpretation.continuity ?? {
        applied: false,
        activeLane: activeState?.lane ?? null,
        carriedFactKeys: [],
        invalidatedFactKeys,
        missingFields: activeState?.missingFields ?? [],
        nextUsefulField: activeState?.nextUsefulField,
        previousStateSummary: this.buildStateSummary(activeState),
      },
    };
  }

  async persistTurnState(input: {
    conversationId: string;
    preparedTurn: PreparedContinuityTurn;
    decision: DecisionResult;
    execution: ToolExecutionAttempt | null;
    documentRetrieval: DocumentRetrievalAttempt;
  }): Promise<ConversationStateSnapshot | null> {
    const nextState = this.buildNextState(input);

    if (!nextState) {
      await this.stateRepository.deleteByConversationId(input.conversationId);
      return null;
    }

    const saved = await this.stateRepository.save({
      conversationId: input.conversationId,
      lane: nextState.lane,
      lastIntent: nextState.lastIntent ?? null,
      lastApprovedAction: nextState.lastApprovedAction ?? null,
      lastApprovedToolName: nextState.lastApprovedToolName ?? null,
      approvedFacts: (nextState.approvedFacts ?? null) as Prisma.InputJsonValue | null,
      pendingFacts: (nextState.pendingFacts ?? null) as Prisma.InputJsonValue | null,
      missingFields: nextState.missingFields,
      nextUsefulField: nextState.nextUsefulField ?? null,
      lastApprovedResult:
        (nextState.lastApprovedResult ?? null) as Prisma.InputJsonValue | null,
      metadata: (nextState.metadata ?? null) as Prisma.InputJsonValue | null,
    });

    return this.mapRecordToState(saved);
  }

  async getState(
    conversationId: string,
  ): Promise<ConversationStateSnapshot | null> {
    const record = await this.stateRepository.findByConversationId(conversationId);
    return this.mapRecordToState(record);
  }

  private buildNextState(input: {
    conversationId: string;
    preparedTurn: PreparedContinuityTurn;
    decision: DecisionResult;
    execution: ToolExecutionAttempt | null;
    documentRetrieval: DocumentRetrievalAttempt;
  }): ConversationStateSnapshot | null {
    const lane = this.resolveNextStateLane(input);

    if (!lane) {
      return null;
    }

    const effectiveFacts = this.extractLaneFacts(
      lane,
      input.preparedTurn.effectiveInterpretation,
    );
    const previousApprovedFacts = this.getCarryableFacts(
      input.preparedTurn.activeState,
      lane,
    );
    const mergedFacts = this.mergeLaneFacts(lane, previousApprovedFacts, effectiveFacts);
    const explorationFacts = this.enrichExplorationFacts({
      lane,
      facts: mergedFacts,
      documentRetrieval: input.documentRetrieval,
      interpretation: input.preparedTurn.effectiveInterpretation,
    });
    const preservedApprovedFacts = this.cleanFacts(
      input.decision.action === 'invoke_tool' && input.execution?.ok
        ? this.enrichFactsWithExecution(lane, explorationFacts, input.execution.payload)
        : explorationFacts,
    );
    const filteredMissingFields = this.filterResolvedFields(
      input.decision.missingFields,
      preservedApprovedFacts,
    );
    const nextUsefulField = filteredMissingFields[0];
    const lastApprovedAction =
      input.execution?.ok && input.decision.action === 'invoke_tool'
        ? input.decision.action
        : input.preparedTurn.activeState?.lastApprovedAction;
    const lastApprovedToolName =
      input.execution?.ok && input.decision.toolName
        ? input.decision.toolName
        : input.preparedTurn.activeState?.lastApprovedToolName;
    const lastApprovedResult =
      input.execution?.ok
        ? this.cleanFacts(this.cloneJson(input.execution.payload))
        : input.preparedTurn.activeState?.lastApprovedResult;

    return {
      conversationId: input.conversationId,
      lane,
      lastIntent: input.preparedTurn.effectiveInterpretation.intent,
      lastApprovedAction,
      lastApprovedToolName,
      approvedFacts: preservedApprovedFacts ?? undefined,
      pendingFacts:
        input.decision.action === 'clarify'
          ? preservedApprovedFacts ?? undefined
          : undefined,
      missingFields: filteredMissingFields,
      nextUsefulField,
      lastApprovedResult: lastApprovedResult ?? undefined,
      metadata: this.cleanFacts({
        invalidatedFactKeys: input.preparedTurn.continuity.invalidatedFactKeys,
        continuityApplied: input.preparedTurn.continuity.applied,
        futureCompatibleActions: [...FUTURE_COMPATIBLE_ACTIONS],
      }) ?? undefined,
    };
  }

  private resolveNextStateLane(input: {
    preparedTurn: PreparedContinuityTurn;
    decision: DecisionResult;
    documentRetrieval: DocumentRetrievalAttempt;
  }): ConversationLane | null {
    if (input.decision.action === 'invoke_tool') {
      return (
        input.preparedTurn.continuity.activeLane ??
        this.resolveExplicitLane(input.preparedTurn.effectiveInterpretation.intent) ??
        null
      );
    }

    if (input.documentRetrieval.result) {
      return 'document_exploration';
    }

    if (this.shouldPersistAdvisoryLane(input)) {
      return 'advisory_exploration';
    }

    if (input.preparedTurn.continuity.activeLane) {
      return input.preparedTurn.continuity.activeLane;
    }

    return (
      this.resolveExplicitLane(input.preparedTurn.effectiveInterpretation.intent) ??
      null
    );
  }

  private resolveCarryLane(
    state: ConversationStateSnapshot | null,
    interpretation: ParsedInterpretation,
  ): ConversationLane | null {
    if (!state) {
      return this.resolveExplicitLane(interpretation.intent) ?? null;
    }

    const explicitLane = this.resolveExplicitLane(interpretation.intent);

    if (explicitLane === state.lane) {
      return state.lane;
    }

    if (this.shouldContinueExplorationLane(state, interpretation)) {
      return state.lane;
    }

    if (!this.isImplicitContinuationCandidate(interpretation)) {
      return explicitLane ?? null;
    }

    const factContribution = this.extractLaneFacts(state.lane, interpretation);

    if (Object.keys(factContribution).length > 0) {
      return state.lane;
    }

    if (state.missingFields.length > 0 || state.nextUsefulField) {
      return state.lane;
    }

    return null;
  }

  private applyLaneFacts(
    interpretation: ParsedInterpretation,
    lane: ConversationLane,
    mergedFacts: ContinuityFacts,
    input: {
      promoteLane: boolean;
      invalidatedFactKeys: string[];
      activeState: ConversationStateSnapshot | null;
      carriedFactKeys: string[];
    },
  ): ContinuityAwareInterpretation {
    const entities = {
      ...interpretation.entities,
    } as Record<string, unknown>;
    const normalizedEntities = {
      dates: [...interpretation.normalizedEntities.dates],
      measurements: [...interpretation.normalizedEntities.measurements],
      dimensions: [...interpretation.normalizedEntities.dimensions],
    };

    if (lane === 'booking') {
      const facts = mergedFacts as BookingFacts;

      if (
        typeof facts.attendees === 'number' &&
        typeof entities.attendees !== 'number'
      ) {
        entities.attendees = facts.attendees;
      }

      if (
        facts.requestedDate &&
        normalizedEntities.dates.length === 0
      ) {
        normalizedEntities.dates = [this.cloneJson(facts.requestedDate)];
      }

      if (
        typeof facts.requestSummary === 'string' &&
        facts.requestSummary.trim().length > 0 &&
        typeof entities.requestSummary !== 'string'
      ) {
        entities.requestSummary = facts.requestSummary;
      }
    }

    if (lane === 'quote') {
      const facts = mergedFacts as QuoteFacts;

      if (
        typeof facts.attendees === 'number' &&
        typeof entities.attendees !== 'number'
      ) {
        entities.attendees = facts.attendees;
      }

      if (
        typeof facts.requestSummary === 'string' &&
        facts.requestSummary.trim().length > 0 &&
        typeof entities.requestSummary !== 'string'
      ) {
        entities.requestSummary = facts.requestSummary;
      }

      if (
        Array.isArray(facts.measurements) &&
        normalizedEntities.measurements.length === 0
      ) {
        normalizedEntities.measurements = this.cloneJson(facts.measurements);
      }

      if (
        Array.isArray(facts.dimensions) &&
        normalizedEntities.dimensions.length === 0
      ) {
        normalizedEntities.dimensions = this.cloneJson(facts.dimensions);
      }
    }

    if (lane === 'product_lookup') {
      const facts = mergedFacts as ProductFacts;

      if (
        typeof facts.sku === 'string' &&
        facts.sku.trim().length > 0 &&
        typeof entities.sku !== 'string'
      ) {
        entities.sku = facts.sku;
      }

      if (
        typeof facts.query === 'string' &&
        facts.query.trim().length > 0 &&
        typeof entities.productQuery !== 'string'
      ) {
        entities.productQuery = facts.query;
      }

      if (
        typeof facts.price === 'string' &&
        facts.price.trim().length > 0 &&
        typeof entities.price !== 'string'
      ) {
        entities.price = facts.price;
      }

      if (
        typeof facts.location === 'string' &&
        facts.location.trim().length > 0 &&
        typeof entities.location !== 'string'
      ) {
        entities.location = facts.location;
      }
    }

    if (
      lane === 'document_exploration' ||
      lane === 'advisory_exploration'
    ) {
      const facts =
        lane === 'document_exploration'
          ? (mergedFacts as DocumentExplorationFacts)
          : (mergedFacts as AdvisoryExplorationFacts);

      if (
        typeof facts.topicSummary === 'string' &&
        facts.topicSummary.trim().length > 0 &&
        typeof entities.requestSummary !== 'string'
      ) {
        entities.requestSummary = facts.topicSummary;
      }
    }

    return this.attachContinuityMetadata(
      {
        ...interpretation,
        intent:
          input.promoteLane && intentByLane[lane]
            ? intentByLane[lane]
            : interpretation.intent,
        entities,
        normalizedEntities,
      },
      {
        applied: input.carriedFactKeys.length > 0 || input.promoteLane,
        activeLane: lane,
        carriedFactKeys: input.carriedFactKeys,
        invalidatedFactKeys: input.invalidatedFactKeys,
        missingFields: input.activeState?.missingFields ?? [],
        nextUsefulField: input.activeState?.nextUsefulField,
        previousStateSummary: this.buildStateSummary(input.activeState),
      },
    );
  }

  private attachContinuityMetadata(
    interpretation: ParsedInterpretation,
    continuity: ContinuityMetadata,
  ): ContinuityAwareInterpretation {
    return {
      ...interpretation,
      continuity,
    };
  }

  private buildStateSummary(state: ConversationStateSnapshot | null) {
    if (!state) {
      return null;
    }

    return {
      lane: state.lane,
      missingFields: state.missingFields,
      nextUsefulField: state.nextUsefulField,
      lastApprovedAction: state.lastApprovedAction,
    };
  }

  private resolveExplicitLane(
    intent: CanonicalIntent,
  ): ConversationLane | undefined {
    return laneByIntent[intent];
  }

  private shouldPreserveExplorationLane(
    previousState: ConversationStateSnapshot,
    explicitLane: ConversationLane,
  ) {
    return (
      (previousState.lane === 'document_exploration' ||
        previousState.lane === 'advisory_exploration') &&
      explicitLane === 'product_lookup'
    );
  }

  private shouldContinueExplorationLane(
    state: ConversationStateSnapshot,
    interpretation: ParsedInterpretation,
  ) {
    if (
      state.lane !== 'document_exploration' &&
      state.lane !== 'advisory_exploration'
    ) {
      return false;
    }

    return (
      interpretation.intent === 'GENERAL_CONVERSATION' ||
      interpretation.intent === 'CLARIFICATION' ||
      interpretation.intent === 'GET_PRODUCT'
    );
  }

  private shouldPersistAdvisoryLane(input: {
    preparedTurn: PreparedContinuityTurn;
    decision: DecisionResult;
  }) {
    if (input.decision.action !== 'respond') {
      return false;
    }

    if (input.preparedTurn.continuity.activeLane === 'advisory_exploration') {
      return true;
    }

    return this.hasAdvisorySignals(input.preparedTurn.effectiveInterpretation);
  }

  private isImplicitContinuationCandidate(
    interpretation: ParsedInterpretation,
  ): boolean {
    return (
      interpretation.intent === 'GENERAL_CONVERSATION' ||
      interpretation.intent === 'CLARIFICATION' ||
      interpretation.confidence < 0.6
    );
  }

  private hasAdvisorySignals(
    interpretation: ParsedInterpretation,
  ) {
    const topicSummary =
      typeof interpretation.entities.requestSummary === 'string'
        ? interpretation.entities.requestSummary
        : typeof interpretation.entities.productQuery === 'string'
          ? interpretation.entities.productQuery
          : typeof interpretation.entities.rawMessage === 'string'
            ? interpretation.entities.rawMessage
            : '';

    return topicSummary.trim().length >= 12;
  }

  private getCarryableFacts(
    state: ConversationStateSnapshot | null,
    lane: ConversationLane,
  ): ContinuityFacts {
    if (!state || state.lane !== lane) {
      return {};
    }

    return this.cleanFacts({
      ...(state.approvedFacts ?? {}),
      ...(state.pendingFacts ?? {}),
    }) ?? {};
  }

  private extractLaneFacts(
    lane: ConversationLane,
    interpretation: ParsedInterpretation,
  ): ContinuityFacts {
    if (lane === 'booking') {
      return this.cleanFacts({
        requestedDate: interpretation.normalizedEntities.dates[0]
          ? this.cloneJson(interpretation.normalizedEntities.dates[0])
          : undefined,
        attendees:
          typeof interpretation.entities.attendees === 'number'
            ? interpretation.entities.attendees
            : undefined,
        requestSummary:
          typeof interpretation.entities.requestSummary === 'string'
            ? interpretation.entities.requestSummary
            : typeof interpretation.entities.rawMessage === 'string'
              ? interpretation.entities.rawMessage
              : undefined,
      }) ?? {};
    }

    if (lane === 'quote') {
      return this.cleanFacts({
        requestSummary:
          typeof interpretation.entities.requestSummary === 'string'
            ? interpretation.entities.requestSummary
            : typeof interpretation.entities.rawMessage === 'string'
              ? interpretation.entities.rawMessage
              : undefined,
        attendees:
          typeof interpretation.entities.attendees === 'number'
            ? interpretation.entities.attendees
            : undefined,
        measurements:
          interpretation.normalizedEntities.measurements.length > 0
            ? this.cloneJson(interpretation.normalizedEntities.measurements)
            : undefined,
        dimensions:
          interpretation.normalizedEntities.dimensions.length > 0
            ? this.cloneJson(interpretation.normalizedEntities.dimensions)
            : undefined,
      }) ?? {};
    }

    if (lane === 'product_lookup') {
      return this.cleanFacts({
        query:
          typeof interpretation.entities.productQuery === 'string'
            ? interpretation.entities.productQuery
            : typeof interpretation.entities.rawMessage === 'string'
              ? interpretation.entities.rawMessage
              : undefined,
        sku:
          typeof interpretation.entities.sku === 'string'
            ? interpretation.entities.sku
            : undefined,
        price:
          typeof interpretation.entities.price === 'string'
            ? interpretation.entities.price
            : undefined,
        location:
          typeof interpretation.entities.location === 'string'
            ? interpretation.entities.location
            : undefined,
      }) ?? {};
    }

    if (lane === 'document_exploration') {
      return this.cleanFacts({
        topicSummary:
          typeof interpretation.entities.requestSummary === 'string'
            ? interpretation.entities.requestSummary
            : typeof interpretation.entities.productQuery === 'string'
              ? interpretation.entities.productQuery
              : typeof interpretation.entities.rawMessage === 'string'
                ? interpretation.entities.rawMessage
                : undefined,
      }) ?? {};
    }

    if (lane === 'advisory_exploration') {
      const topicSummary =
        typeof interpretation.entities.requestSummary === 'string'
          ? interpretation.entities.requestSummary
          : typeof interpretation.entities.productQuery === 'string'
            ? interpretation.entities.productQuery
            : typeof interpretation.entities.rawMessage === 'string'
              ? interpretation.entities.rawMessage
              : undefined;

      return this.cleanFacts({
        topicSummary,
        criteriaSignals: topicSummary
          ? [topicSummary.trim()]
          : undefined,
      }) ?? {};
    }

    return {};
  }

  private mergeLaneFacts(
    lane: ConversationLane,
    baseFacts: ContinuityFacts,
    currentFacts: ContinuityFacts,
  ): ContinuityFacts {
    if (lane === 'booking') {
      const base = baseFacts as BookingFacts;
      const current = currentFacts as BookingFacts;

      return this.cleanFacts({
        requestedDate: current.requestedDate ?? base.requestedDate,
        attendees:
          typeof current.attendees === 'number'
            ? current.attendees
            : base.attendees,
        requestSummary: this.preferMoreSpecificSummary(
          base.requestSummary,
          current.requestSummary,
        ),
      }) ?? {};
    }

    if (lane === 'quote') {
      const base = baseFacts as QuoteFacts;
      const current = currentFacts as QuoteFacts;

      return this.cleanFacts({
        requestSummary:
          typeof current.requestSummary === 'string' &&
          current.requestSummary.trim().length > 0
            ? current.requestSummary
            : base.requestSummary,
        attendees:
          typeof current.attendees === 'number'
            ? current.attendees
            : base.attendees,
        measurements:
          Array.isArray(current.measurements) && current.measurements.length > 0
            ? current.measurements
            : base.measurements,
        dimensions:
          Array.isArray(current.dimensions) && current.dimensions.length > 0
            ? current.dimensions
            : base.dimensions,
      }) ?? {};
    }

    if (lane === 'product_lookup') {
      const base = baseFacts as ProductFacts;
      const current = currentFacts as ProductFacts;

      return this.cleanFacts({
        query:
          typeof current.query === 'string' && current.query.trim().length > 0
            ? current.query
            : base.query,
        sku:
          typeof current.sku === 'string' && current.sku.trim().length > 0
            ? current.sku
            : base.sku,
        price:
          typeof current.price === 'string' && current.price.trim().length > 0
            ? current.price
            : base.price,
        location:
          typeof current.location === 'string' &&
          current.location.trim().length > 0
            ? current.location
            : base.location,
      }) ?? {};
    }

    if (lane === 'document_exploration') {
      const base = baseFacts as DocumentExplorationFacts;
      const current = currentFacts as DocumentExplorationFacts;

      return this.cleanFacts({
        topicSummary: this.preferMoreSpecificSummary(
          base.topicSummary,
          current.topicSummary,
        ),
        activeDocumentIds:
          Array.isArray(current.activeDocumentIds) &&
          current.activeDocumentIds.length > 0
            ? current.activeDocumentIds
            : base.activeDocumentIds,
        lastDocumentQuery:
          typeof current.lastDocumentQuery === 'string' &&
          current.lastDocumentQuery.trim().length > 0
            ? current.lastDocumentQuery
            : base.lastDocumentQuery,
        lastGroundedSummary: this.preferMoreSpecificSummary(
          base.lastGroundedSummary,
          current.lastGroundedSummary,
        ),
        lastDocumentTitles:
          Array.isArray(current.lastDocumentTitles) &&
          current.lastDocumentTitles.length > 0
            ? current.lastDocumentTitles
            : base.lastDocumentTitles,
      }) ?? {};
    }

    if (lane === 'advisory_exploration') {
      const base = baseFacts as AdvisoryExplorationFacts;
      const current = currentFacts as AdvisoryExplorationFacts;

      return this.cleanFacts({
        topicSummary: this.preferMoreSpecificSummary(
          base.topicSummary,
          current.topicSummary,
        ),
        criteriaSignals: this.mergeSignals(
          base.criteriaSignals,
          current.criteriaSignals,
        ),
      }) ?? {};
    }

    return {};
  }

  private enrichFactsWithExecution(
    lane: ConversationLane,
    facts: ContinuityFacts,
    payload: Record<string, unknown>,
  ): ContinuityFacts {
    if (lane === 'booking') {
      return this.cleanFacts({
        ...facts,
        requestedDate:
          typeof payload.scheduledFor === 'string'
            ? {
                source: 'execution',
                iso: payload.scheduledFor,
                precision: 'date',
              }
            : facts.requestedDate,
        attendees:
          typeof payload.attendees === 'number'
            ? payload.attendees
            : facts.attendees,
        requestSummary:
          typeof payload.notes === 'string' && payload.notes.trim().length > 0
            ? payload.notes
            : facts.requestSummary,
      }) ?? {};
    }

    if (lane === 'quote') {
      return this.cleanFacts({
        ...facts,
        requestSummary:
          typeof payload.requestSummary === 'string'
            ? payload.requestSummary
            : facts.requestSummary,
      }) ?? {};
    }

    if (lane === 'product_lookup') {
      return this.cleanFacts({
        ...facts,
        sku:
          typeof payload.sku === 'string' ? payload.sku : facts.sku,
        query:
          typeof payload.name === 'string'
            ? payload.name
            : facts.query,
      }) ?? {};
    }

    if (lane === 'document_exploration') {
      return this.cleanFacts({
        ...facts,
        topicSummary:
          typeof payload.name === 'string'
            ? payload.name
            : (facts as DocumentExplorationFacts).topicSummary,
      }) ?? {};
    }

    return facts;
  }

  private enrichExplorationFacts(input: {
    lane: ConversationLane;
    facts: ContinuityFacts;
    documentRetrieval: DocumentRetrievalAttempt;
    interpretation: ParsedInterpretation;
  }) {
    if (input.lane !== 'document_exploration') {
      return input.facts;
    }

    const currentFacts = input.facts as DocumentExplorationFacts;
    const retrieval = input.documentRetrieval.result;
    const topicSummary =
      typeof input.interpretation.entities.requestSummary === 'string'
        ? input.interpretation.entities.requestSummary
        : typeof input.interpretation.entities.productQuery === 'string'
          ? input.interpretation.entities.productQuery
          : typeof input.interpretation.entities.rawMessage === 'string'
            ? input.interpretation.entities.rawMessage
            : currentFacts.topicSummary;

    return this.cleanFacts({
      ...currentFacts,
      topicSummary: this.preferMoreSpecificSummary(
        currentFacts.topicSummary,
        topicSummary,
      ),
      activeDocumentIds:
        retrieval?.matches.map((match) => match.documentId) ??
        currentFacts.activeDocumentIds,
      lastDocumentQuery: retrieval?.query ?? currentFacts.lastDocumentQuery,
      lastGroundedSummary:
        retrieval?.groundedSummary ?? currentFacts.lastGroundedSummary,
      lastDocumentTitles:
        retrieval?.matches.map((match) => match.title) ??
        currentFacts.lastDocumentTitles,
    }) ?? {};
  }

  private filterResolvedFields(
    fields: string[],
    facts: ContinuityFacts | null,
  ): string[] {
    return fields.filter((field) => !this.isFieldResolved(field, facts));
  }

  private isFieldResolved(
    field: string,
    facts: ContinuityFacts | null,
  ): boolean {
    if (!facts) {
      return false;
    }

    if (field === 'requested_date') {
      return this.hasMeaningfulValue(facts.requestedDate);
    }

    if (field === 'attendees') {
      return typeof facts.attendees === 'number';
    }

    if (field === 'sku') {
      return typeof facts.sku === 'string' && facts.sku.trim().length > 0;
    }

    if (field === 'measurements') {
      return Array.isArray(facts.measurements) && facts.measurements.length > 0;
    }

    if (field === 'user_goal') {
      return false;
    }

    return this.hasMeaningfulValue(facts[field]);
  }

  private collectStateFactKeys(state: ConversationStateSnapshot): string[] {
    return Array.from(
      new Set([
        ...Object.keys(state.approvedFacts ?? {}),
        ...Object.keys(state.pendingFacts ?? {}),
        ...state.missingFields,
      ]),
    );
  }

  private cleanFacts(
    input: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (!input) {
      return null;
    }

    const nextEntries = Object.entries(input).filter(([, value]) =>
      this.hasMeaningfulValue(value),
    );

    if (nextEntries.length === 0) {
      return null;
    }

    return Object.fromEntries(nextEntries);
  }

  private preferMoreSpecificSummary(
    base: string | undefined,
    current: string | undefined,
  ) {
    const normalizedBase = this.normalizeOptionalString(base);
    const normalizedCurrent = this.normalizeOptionalString(current);

    if (!normalizedCurrent) {
      return normalizedBase;
    }

    if (!normalizedBase) {
      return normalizedCurrent;
    }

    return normalizedCurrent.length > normalizedBase.length
      ? normalizedCurrent
      : normalizedBase;
  }

  private mergeSignals(
    base: string[] | undefined,
    current: string[] | undefined,
  ) {
    const merged = [...(base ?? []), ...(current ?? [])]
      .map((value) => this.normalizeOptionalString(value))
      .filter((value): value is string => Boolean(value));

    if (merged.length === 0) {
      return undefined;
    }

    return Array.from(new Set(merged)).slice(-6);
  }

  private hasMeaningfulValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value);
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }

    return value === true;
  }

  private normalizeOptionalString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined;
  }

  private mapRecordToState(
    record:
      | ({
          updatedAt: Date;
          approvedFacts: Prisma.JsonValue | null;
          pendingFacts: Prisma.JsonValue | null;
          lastApprovedResult: Prisma.JsonValue | null;
          metadata: Prisma.JsonValue | null;
          lane: string;
          lastIntent: string | null;
          lastApprovedAction: string | null;
          lastApprovedToolName: string | null;
          conversationId: string;
          missingFields: string[];
          nextUsefulField: string | null;
        })
      | null,
  ): ConversationStateSnapshot | null {
    if (!record || !this.isConversationLane(record.lane)) {
      return null;
    }

    return {
      conversationId: record.conversationId,
      lane: record.lane,
      lastIntent: this.isCanonicalIntent(record.lastIntent)
        ? record.lastIntent
        : undefined,
      lastApprovedAction: record.lastApprovedAction
        ? (record.lastApprovedAction as ConversationStateSnapshot['lastApprovedAction'])
        : undefined,
      lastApprovedToolName: record.lastApprovedToolName
        ? (record.lastApprovedToolName as ConversationStateSnapshot['lastApprovedToolName'])
        : undefined,
      approvedFacts: this.asRecord(record.approvedFacts) ?? undefined,
      pendingFacts: this.asRecord(record.pendingFacts) ?? undefined,
      missingFields: record.missingFields,
      nextUsefulField: record.nextUsefulField ?? undefined,
      lastApprovedResult: this.asRecord(record.lastApprovedResult) ?? undefined,
      metadata: this.asRecord(record.metadata) ?? undefined,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private asRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (this.cloneJson(value) as Record<string, unknown>)
      : null;
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private isCanonicalIntent(value: unknown): value is CanonicalIntent {
    return (
      value === 'GENERAL_CONVERSATION' ||
      value === 'CLARIFICATION' ||
      value === 'GET_PRODUCT' ||
      value === 'CREATE_BOOKING' ||
      value === 'CREATE_QUOTE'
    );
  }

  private isConversationLane(value: unknown): value is ConversationLane {
    return (
      value === 'booking' ||
      value === 'quote' ||
      value === 'product_lookup' ||
      value === 'document_exploration' ||
      value === 'advisory_exploration' ||
      value === 'core_knowledge' ||
      value === 'handoff'
    );
  }
}

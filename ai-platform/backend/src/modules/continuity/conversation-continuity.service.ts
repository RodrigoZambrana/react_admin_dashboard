import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DecisionResult } from '../decision/decision.types';
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
    const invalidatedFactKeys =
      previousState && explicitLane && previousState.lane !== explicitLane
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
  }): ConversationStateSnapshot | null {
    const lane = this.resolveNextStateLane(input);

    if (!lane || input.decision.action === 'respond') {
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
    const preservedApprovedFacts = this.cleanFacts(
      input.decision.action === 'invoke_tool' && input.execution?.ok
        ? this.enrichFactsWithExecution(lane, mergedFacts, input.execution.payload)
        : mergedFacts,
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
  }): ConversationLane | null {
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

  private isImplicitContinuationCandidate(
    interpretation: ParsedInterpretation,
  ): boolean {
    return (
      interpretation.intent === 'GENERAL_CONVERSATION' ||
      interpretation.intent === 'CLARIFICATION' ||
      interpretation.confidence < 0.6
    );
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

    return facts;
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
      value === 'core_knowledge' ||
      value === 'handoff'
    );
  }
}

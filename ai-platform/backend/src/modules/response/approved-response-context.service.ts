import { Injectable } from '@nestjs/common';

import {
  ApprovedResponseContext,
  ApprovedResponseContextInput,
} from './response.types';
import { ResponseGroundingService } from './response-grounding.service';

@Injectable()
export class ApprovedResponseContextService {
  constructor(
    private readonly responseGroundingService: ResponseGroundingService,
  ) {}

  build(input: ApprovedResponseContextInput): ApprovedResponseContext {
    const outcome = this.resolveOutcome(input);
    const stateMissingFields = input.conversationState?.missingFields ?? [];
    const missingFields =
      stateMissingFields.length > 0 ? stateMissingFields : input.decision.missingFields;
    const approvedFacts = this.asRecord(input.conversationState?.approvedFacts);
    const lastApprovedResult = this.asRecord(
      input.execution?.ok
        ? input.execution.payload
        : input.conversationState?.lastApprovedResult,
    );

    return this.pruneUndefined({
      locale: input.interpretation.language,
      userMessage: input.message,
      intent: input.interpretation.intent,
      decision: input.decision,
      outcome,
      interpretation: {
        language: input.interpretation.language,
        confidence: input.interpretation.confidence,
        entities: this.cloneJson(input.interpretation.entities) ?? {},
        normalizedEntities:
          this.cloneJson(input.interpretation.normalizedEntities) ?? {
            dates: [],
            measurements: [],
            dimensions: [],
          },
      },
      execution: input.execution?.ok
        ? {
            status: 'succeeded',
            toolName: input.execution.toolName,
            validatedInputSummary:
              this.asRecord(input.execution.validatedInput) ?? null,
            resultSummary: this.asRecord(input.execution.payload) ?? null,
            failure: null,
          }
        : input.execution
          ? {
              status: 'failed',
              toolName: input.execution.toolName,
              validatedInputSummary:
                this.asRecord(input.execution.validatedInput) ?? null,
              resultSummary: null,
              failure: {
                code: input.execution.errorCode,
                message: input.execution.errorMessage,
                details: this.asRecord(input.execution.errorDetails) ?? null,
              },
            }
          : {
              status: 'not_applicable',
              toolName: input.decision.toolName ?? null,
              validatedInputSummary: null,
              resultSummary: null,
              failure: null,
            },
      continuity: this.hasContinuityState(input)
        ? this.pruneUndefined({
            activeLane: input.continuity.activeLane,
            applied: input.continuity.applied,
            carriedFactKeys: input.continuity.carriedFactKeys,
            invalidatedFactKeys: input.continuity.invalidatedFactKeys,
            missingFields: input.continuity.missingFields,
            nextUsefulField: input.continuity.nextUsefulField,
            previousStateSummary: input.continuity.previousStateSummary,
          })
        : undefined,
      conversationState: input.conversationState
        ? this.pruneUndefined({
            lane: input.conversationState.lane,
            missingFields: input.conversationState.missingFields,
            nextUsefulField: input.conversationState.nextUsefulField,
            lastApprovedAction: input.conversationState.lastApprovedAction,
            lastApprovedToolName: input.conversationState.lastApprovedToolName,
            approvedFacts,
            lastApprovedResult,
          })
        : undefined,
      missingFields: missingFields.length > 0 ? missingFields : undefined,
      nextUsefulField:
        input.conversationState?.nextUsefulField ?? input.continuity.nextUsefulField,
      approvedFactKeys: Object.keys(approvedFacts ?? {}),
      approvedResultKeys: Object.keys(lastApprovedResult ?? {}),
      documentContext: this.buildApprovedDocumentContext(input),
      approvedDocumentIds: input.documentContext?.matches.map(
        (match) => match.documentId,
      ) ?? [],
    });
  }

  private resolveOutcome(input: ApprovedResponseContextInput) {
    if (input.decision.action === 'close_turn') {
      return 'close_turn' as const;
    }

    if (input.decision.action === 'clarify') {
      return 'clarify' as const;
    }

    if (input.decision.action === 'invoke_tool') {
      return input.execution?.ok ? 'execution_succeeded' : 'execution_failed';
    }

    return 'respond' as const;
  }

  private hasContinuityState(input: ApprovedResponseContextInput) {
    return Boolean(
      input.continuity.activeLane ||
        input.continuity.applied ||
        input.continuity.carriedFactKeys.length > 0 ||
        input.continuity.invalidatedFactKeys.length > 0 ||
        input.continuity.missingFields.length > 0 ||
        input.continuity.nextUsefulField ||
        input.continuity.previousStateSummary,
    );
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return this.cloneJson(value) as Record<string, unknown>;
  }

  private cloneJson<T>(value: T): T | undefined {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value)) as T;
  }

  private pruneUndefined<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, current]) => current !== undefined),
    ) as T;
  }

  private buildApprovedDocumentContext(input: ApprovedResponseContextInput) {
    if (!input.documentContext) {
      return undefined;
    }

    const responseMode =
      input.decision.action === 'invoke_tool'
        ? 'combined_execution'
        : 'document_exploration';
    const grounding = this.responseGroundingService.assessDocumentContext({
      locale: input.interpretation.language,
      userMessage: input.message,
      documentContext: input.documentContext,
    });

    return {
      source: input.documentContext.source,
      query: input.documentContext.query,
      groundedSummary: this.buildResponseSafeGroundedSummary(
        input.documentContext.groundedSummary,
        responseMode,
      ),
      responseMode: responseMode as 'document_exploration' | 'combined_execution',
      grounding,
      matches: input.documentContext.matches.map((match) =>
        this.pruneUndefined({
          documentId: match.documentId,
          title: match.title,
          sequence: match.sequence,
          score: match.score,
          excerpt:
            responseMode === 'combined_execution'
              ? undefined
              : this.truncateExcerpt(match.excerpt),
        }),
      ),
    };
  }

  private truncateExcerpt(value: string) {
    const normalized = value.trim().replace(/\s+/g, ' ');

    if (normalized.length <= 220) {
      return normalized;
    }

    return `${normalized.slice(0, 217).trimEnd()}...`;
  }

  private buildResponseSafeGroundedSummary(
    value: string,
    responseMode: 'document_exploration' | 'combined_execution',
  ) {
    const normalized = value.trim().replace(/\s+/g, ' ');

    if (!normalized) {
      return '';
    }

    if (responseMode === 'combined_execution') {
      const firstSentence = normalized.match(/^.*?[.!?](?:\s|$)/u)?.[0]?.trim();
      if (firstSentence && firstSentence.length <= 220) {
        return firstSentence;
      }
    }

    return this.truncateExcerpt(normalized);
  }
}

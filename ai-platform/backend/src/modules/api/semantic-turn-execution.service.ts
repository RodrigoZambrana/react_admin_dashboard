import { Injectable } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';

import { ConversationContinuityService } from '../continuity/conversation-continuity.service';
import {
  ContinuityMetadata,
  ConversationStateSnapshot,
} from '../continuity/continuity.types';
import { DecisionService } from '../decision/decision.service';
import { DocumentRetrievalAttempt } from '../documents/document.types';
import { DocumentRetrievalService } from '../documents/document-retrieval.service';
import { InterpretationService } from '../interpretation/interpretation.service';
import { MemoryService } from '../memory/memory.service';
import { ParsedInterpretation, ParsingService } from '../parsing/parsing.service';
import { ConversationRepository } from '../persistence/repositories/conversation.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { ChatResponseService } from '../response/chat-response.service';
import { throwIfAborted } from '../shared/abort.utils';
import { ToolExecutionService } from '../tools/tool-execution.service';
import { ToolExecutionAttempt } from '../tools/tool.types';
import { TraceLogService } from './trace-log.service';
import { SemanticTurnExecutionResult } from './semantic-turn.types';

@Injectable()
export class SemanticTurnExecutionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly conversationRepository: ConversationRepository,
    private readonly interpretationService: InterpretationService,
    private readonly parsingService: ParsingService,
    private readonly continuityService: ConversationContinuityService,
    private readonly decisionService: DecisionService,
    private readonly toolExecutionService: ToolExecutionService,
    private readonly documentRetrievalService: DocumentRetrievalService,
    private readonly chatResponseService: ChatResponseService,
    private readonly memoryService: MemoryService,
    private readonly traceLogService: TraceLogService,
  ) {}

  async executeClosedTurn(
    input: {
      conversationId: string;
      message: string;
      locale?: string;
    },
    options?: {
      projectReplyImmediately?: boolean;
      abortSignal?: AbortSignal;
    },
  ): Promise<SemanticTurnExecutionResult> {
    const projectReplyImmediately = options?.projectReplyImmediately ?? true;
    const previousMessages = await this.memoryService.getRecent(
      input.conversationId,
      10,
    );
    const metadata = {
      conversationId: input.conversationId,
      traceId: this.tenantContext.getTraceId(),
    };

    await this.traceLogService.recordStage({
      conversationId: input.conversationId,
      stage: 'input',
      status: 'received',
      payload: {
        message: input.message,
      },
    });

    const incomingMessage = await this.conversationRepository.appendMessage(
      input.conversationId,
      MessageRole.USER,
      input.message,
    );
    await this.memoryService.append(input.conversationId, 'user', input.message);
    throwIfAborted(options?.abortSignal);

    const interpretationResult = await this.interpretationService.interpret(
      input.message,
      input.locale,
      previousMessages,
      {
        abortSignal: options?.abortSignal,
      },
    );
    throwIfAborted(options?.abortSignal);
    const parsedInterpretation = await this.parsingService.normalize(
      interpretationResult.interpretation,
    );
    const preparedTurn = await this.continuityService.prepareTurn({
      conversationId: input.conversationId,
      interpretation: parsedInterpretation,
    });
    const documentRetrievalPreview =
      await this.documentRetrievalService.retrieveForConversation({
        message: input.message,
        interpretation: preparedTurn.effectiveInterpretation,
        conversationState: preparedTurn.activeState,
      });
    const decision = this.decisionService.decide({
      interpretation: preparedTurn.effectiveInterpretation,
      conversationState: preparedTurn.activeState,
      documentRetrieval: documentRetrievalPreview,
    });
    const execution = await this.toolExecutionService.executeApprovedAction({
      decision,
      interpretation: preparedTurn.effectiveInterpretation,
      abortSignal: options?.abortSignal,
    });
    const documentRetrieval = this.documentRetrievalService.withDecisionContext(
      documentRetrievalPreview,
      decision,
    );
    throwIfAborted(options?.abortSignal);
    const conversationState = await this.continuityService.persistTurnState({
      conversationId: input.conversationId,
      preparedTurn,
      decision,
      execution,
      documentRetrieval,
    });

    await this.traceInterpretationStage(
      input.conversationId,
      interpretationResult,
    );
    await this.traceParsingStage(
      input.conversationId,
      preparedTurn.effectiveInterpretation,
    );
    await this.traceDecisionStage(
      input.conversationId,
      decision,
      preparedTurn.continuity,
    );

    if (execution) {
      await this.traceLogService.recordStage({
        conversationId: input.conversationId,
        stage: 'execution',
        status: execution.ok ? 'completed' : 'failed',
        payload: this.buildExecutionTracePayload(execution),
      });
    }

    if (documentRetrieval.attempted) {
      await this.traceLogService.recordStage({
        conversationId: input.conversationId,
        stage: 'retrieval',
        status: documentRetrieval.result ? 'completed' : 'missed',
        payload: {
          source: 'document_origin',
          reason: documentRetrieval.reason,
          query: documentRetrieval.result?.query ?? null,
          groundedSummary: documentRetrieval.result?.groundedSummary ?? null,
          matches: documentRetrieval.result?.matches ?? [],
        } as Prisma.InputJsonValue,
      });
    }

    const approvedResponse = await this.chatResponseService.generate({
      message: input.message,
      interpretation: preparedTurn.effectiveInterpretation,
      decision,
      execution,
      documentContext: documentRetrieval.result,
      continuity: preparedTurn.continuity,
      conversationState,
      abortSignal: options?.abortSignal,
    });
    throwIfAborted(options?.abortSignal);

    await this.traceLogService.recordStage({
      conversationId: input.conversationId,
      stage: 'response',
      status: approvedResponse.usedFallback ? 'fallback' : 'completed',
      payload: {
        response: approvedResponse.response,
        intent: preparedTurn.effectiveInterpretation.intent,
        entities: preparedTurn.effectiveInterpretation.entities,
        normalizedEntities:
          preparedTurn.effectiveInterpretation.normalizedEntities,
        language: preparedTurn.effectiveInterpretation.language,
        confidence: preparedTurn.effectiveInterpretation.confidence,
        decision,
        execution,
        documentRetrieval,
        continuity: preparedTurn.continuity,
        conversationState: this.buildConversationStateSummary(conversationState),
        approvedResponseContext: approvedResponse.approvedContext,
        approvedResponseDraft: approvedResponse.approvedDraft,
        responseGeneration: approvedResponse.generation,
        responseFallbackReason: approvedResponse.fallbackReason,
      } as Prisma.InputJsonValue,
    });

    const assistantMessageMetadata = this.buildAssistantMessageMetadata({
      interpretation: preparedTurn.effectiveInterpretation,
      decision,
      execution,
      documentRetrieval,
      continuity: preparedTurn.continuity,
      conversationState,
      approvedResponse,
    });

    const outgoingMessage = projectReplyImmediately
      ? await this.projectAssistantReply({
          conversationId: input.conversationId,
          response: approvedResponse.response,
          assistantMessageMetadata,
        })
      : null;
    throwIfAborted(options?.abortSignal);

    await this.traceLogService.recordStage({
      conversationId: input.conversationId,
      stage: 'logging',
      status: 'completed',
      payload: {
        incomingMessageId: incomingMessage.id,
        outgoingMessageId: outgoingMessage?.id ?? null,
        metadata,
        conversationState: this.buildConversationStateSummary(conversationState),
        replyProjectionStatus: projectReplyImmediately ? 'projected' : 'deferred',
      },
    });

    return {
      response: approvedResponse.response,
      intent: preparedTurn.effectiveInterpretation.intent,
      entities: preparedTurn.effectiveInterpretation.entities,
      metadata,
      incomingMessageId: incomingMessage.id,
      outgoingMessageId: outgoingMessage?.id ?? null,
      interpretationResult,
      parsedInterpretation,
      decision,
      execution,
      continuity: preparedTurn.continuity,
      conversationState,
      approvedResponse,
      assistantMessageMetadata,
      approvedResponseDraft: approvedResponse.approvedDraft,
    };
  }

  async projectAssistantReply(input: {
    conversationId: string;
    response: string;
    assistantMessageMetadata: Prisma.InputJsonValue;
  }) {
    const outgoingMessage = await this.conversationRepository.appendMessage(
      input.conversationId,
      MessageRole.ASSISTANT,
      input.response,
      input.assistantMessageMetadata,
    );
    await this.memoryService.append(input.conversationId, 'assistant', input.response);
    return outgoingMessage;
  }

  private async traceInterpretationStage(
    conversationId: string,
    interpretationResult: SemanticTurnExecutionResult['interpretationResult'],
  ) {
    await this.traceLogService.recordStage({
      conversationId,
      stage: 'interpretation',
      status: interpretationResult.usedFallback ? 'fallback' : 'completed',
      payload: {
        rawAiResponse: interpretationResult.rawAiResponse,
        parsedJson: interpretationResult.parsedJson,
        error: interpretationResult.error,
        provider: interpretationResult.provider,
        model: interpretationResult.model,
        usedFallback: interpretationResult.usedFallback,
      } as Prisma.InputJsonValue,
    });
  }

  private async traceParsingStage(
    conversationId: string,
    interpretation: ParsedInterpretation,
  ) {
    await this.traceLogService.recordStage({
      conversationId,
      stage: 'parsing',
      status: 'completed',
      payload: {
        intent: interpretation.intent,
        language: interpretation.language,
        confidence: interpretation.confidence,
        normalizedEntities: interpretation.normalizedEntities,
      } as Prisma.InputJsonValue,
    });
  }

  private async traceDecisionStage(
    conversationId: string,
    decision: SemanticTurnExecutionResult['decision'],
    continuity: ContinuityMetadata,
  ) {
    await this.traceLogService.recordStage({
      conversationId,
      stage: 'decision',
      status: 'completed',
      payload: {
        domain: decision.domain,
        action: decision.action,
        toolName: decision.toolName ?? null,
        reasonCode: decision.reasonCode,
        missingFields: decision.missingFields,
        continuity,
      } as Prisma.InputJsonValue,
    });
  }

  private buildAssistantMessageMetadata(input: {
    interpretation: ParsedInterpretation & {
      continuity?: ContinuityMetadata;
    };
    decision: SemanticTurnExecutionResult['decision'];
    execution: ToolExecutionAttempt | null;
    documentRetrieval: DocumentRetrievalAttempt;
    continuity: ContinuityMetadata;
    conversationState: ConversationStateSnapshot | null;
    approvedResponse: SemanticTurnExecutionResult['approvedResponse'];
  }) {
    return {
      intent: input.interpretation.intent,
      entities: input.interpretation.entities,
      normalizedEntities: input.interpretation.normalizedEntities,
      language: input.interpretation.language,
      confidence: input.interpretation.confidence,
      decision: input.decision,
      execution: input.execution,
      documentRetrieval: input.documentRetrieval,
      continuity: input.continuity,
      conversationState: this.buildConversationStateSummary(input.conversationState),
      responseGeneration: input.approvedResponse.generation,
      responseFallbackReason: input.approvedResponse.fallbackReason,
    } as Prisma.InputJsonValue;
  }

  private buildExecutionTracePayload(execution: ToolExecutionAttempt) {
    if (execution.ok) {
      return {
        toolName: execution.toolName,
        validatedInputSummary: execution.validatedInput,
        executionResultSummary: execution.payload,
        failure: null,
      } as Prisma.InputJsonValue;
    }

    return {
      toolName: execution.toolName,
      validatedInputSummary: execution.validatedInput,
      executionResultSummary: null,
      failure: {
        code: execution.errorCode,
        message: execution.errorMessage,
        details: execution.errorDetails ?? null,
      },
    } as Prisma.InputJsonValue;
  }

  private buildConversationStateSummary(
    state: ConversationStateSnapshot | null,
  ) {
    if (!state) {
      return null;
    }

    return {
      lane: state.lane,
      missingFields: state.missingFields,
      nextUsefulField: state.nextUsefulField ?? null,
      lastApprovedAction: state.lastApprovedAction ?? null,
      lastApprovedToolName: state.lastApprovedToolName ?? null,
    };
  }
}

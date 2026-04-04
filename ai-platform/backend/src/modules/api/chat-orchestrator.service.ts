import { Injectable } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';

import { ConversationContinuityService } from '../continuity/conversation-continuity.service';
import { ConversationStateSnapshot } from '../continuity/continuity.types';
import { DecisionService } from '../decision/decision.service';
import { InterpretationService } from '../interpretation/interpretation.service';
import { MemoryService } from '../memory/memory.service';
import { ParsingService } from '../parsing/parsing.service';
import { ConversationRepository } from '../persistence/repositories/conversation.repository';
import { MessageRepository } from '../persistence/repositories/message.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { ChatResponseService } from '../response/chat-response.service';
import { ToolExecutionService } from '../tools/tool-execution.service';
import { ToolExecutionAttempt } from '../tools/tool.types';
import { TraceLogService } from './trace-log.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@Injectable()
export class ChatOrchestratorService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly interpretationService: InterpretationService,
    private readonly parsingService: ParsingService,
    private readonly continuityService: ConversationContinuityService,
    private readonly decisionService: DecisionService,
    private readonly toolExecutionService: ToolExecutionService,
    private readonly chatResponseService: ChatResponseService,
    private readonly memoryService: MemoryService,
    private readonly traceLogService: TraceLogService,
  ) {}

  async handleMessage(input: ChatMessageDto) {
    const conversation = await this.resolveConversation(input);
    const conversationId = conversation.id;
    const previousMessages = await this.memoryService.getRecent(conversationId, 10);
    const metadata = {
      conversationId,
      traceId: this.tenantContext.getTraceId(),
    };

    await this.traceLogService.recordStage({
      conversationId,
      stage: 'input',
      status: 'received',
      payload: {
        message: input.message,
      },
    });

    const incomingMessage = await this.conversationRepository.appendMessage(
      conversationId,
      MessageRole.USER,
      input.message,
    );
    await this.memoryService.append(conversationId, 'user', input.message);

    const interpretation = await this.interpretationService.interpret(
      input.message,
      input.locale,
      previousMessages,
    );
    const parsedInterpretation = await this.parsingService.normalize(
      interpretation.interpretation,
    );
    const preparedTurn = await this.continuityService.prepareTurn({
      conversationId,
      interpretation: parsedInterpretation,
    });
    const decision = this.decisionService.decide(
      preparedTurn.effectiveInterpretation,
    );
    const execution = await this.toolExecutionService.executeApprovedAction({
      decision,
      interpretation: preparedTurn.effectiveInterpretation,
    });
    const conversationState = await this.continuityService.persistTurnState({
      conversationId,
      preparedTurn,
      decision,
      execution,
    });

    await this.traceLogService.recordStage({
      conversationId,
      stage: 'interpretation',
      status: interpretation.usedFallback ? 'fallback' : 'completed',
      payload: {
        rawAiResponse: interpretation.rawAiResponse,
        parsedJson: interpretation.parsedJson,
        error: interpretation.error,
        provider: interpretation.provider,
        model: interpretation.model,
        usedFallback: interpretation.usedFallback,
      } as Prisma.InputJsonValue,
    });

    await this.traceLogService.recordStage({
      conversationId,
      stage: 'parsing',
      status: 'completed',
      payload: {
        intent: preparedTurn.effectiveInterpretation.intent,
        language: preparedTurn.effectiveInterpretation.language,
        confidence: preparedTurn.effectiveInterpretation.confidence,
        normalizedEntities: preparedTurn.effectiveInterpretation.normalizedEntities,
      } as Prisma.InputJsonValue,
    });

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
        continuity: preparedTurn.continuity,
      } as Prisma.InputJsonValue,
    });

    if (execution) {
      await this.traceLogService.recordStage({
        conversationId,
        stage: 'execution',
        status: execution.ok ? 'completed' : 'failed',
        payload: this.buildExecutionTracePayload(execution),
      });
    }

    const resolvedResponse = await this.chatResponseService.generate({
      message: input.message,
      interpretation: preparedTurn.effectiveInterpretation,
      decision,
      execution,
      continuity: preparedTurn.continuity,
      conversationState,
    });
    const response = resolvedResponse.response;

    await this.traceLogService.recordStage({
      conversationId,
      stage: 'response',
      status: resolvedResponse.usedFallback ? 'fallback' : 'completed',
      payload: {
        response,
        intent: preparedTurn.effectiveInterpretation.intent,
        entities: preparedTurn.effectiveInterpretation.entities,
        normalizedEntities:
          preparedTurn.effectiveInterpretation.normalizedEntities,
        language: preparedTurn.effectiveInterpretation.language,
        confidence: preparedTurn.effectiveInterpretation.confidence,
        decision,
        execution,
        continuity: preparedTurn.continuity,
        conversationState: this.buildConversationStateSummary(conversationState),
        approvedResponseContext: resolvedResponse.approvedContext,
        approvedResponseDraft: resolvedResponse.approvedDraft,
        responseGeneration: resolvedResponse.generation,
      } as Prisma.InputJsonValue,
    });

    const outgoingMessage = await this.conversationRepository.appendMessage(
      conversationId,
      MessageRole.ASSISTANT,
      response,
      {
        intent: preparedTurn.effectiveInterpretation.intent,
        entities: preparedTurn.effectiveInterpretation.entities,
        normalizedEntities:
          preparedTurn.effectiveInterpretation.normalizedEntities,
        language: preparedTurn.effectiveInterpretation.language,
        confidence: preparedTurn.effectiveInterpretation.confidence,
        decision,
        execution,
        continuity: preparedTurn.continuity,
        conversationState: this.buildConversationStateSummary(conversationState),
        responseGeneration: resolvedResponse.generation,
      } as Prisma.InputJsonValue,
    );
    await this.memoryService.append(conversationId, 'assistant', response);

    await this.traceLogService.recordStage({
      conversationId,
      stage: 'logging',
      status: 'completed',
      payload: {
        incomingMessageId: incomingMessage.id,
        outgoingMessageId: outgoingMessage.id,
        metadata,
        conversationState: this.buildConversationStateSummary(conversationState),
      },
    });

    return {
      response,
      intent: preparedTurn.effectiveInterpretation.intent,
      entities: preparedTurn.effectiveInterpretation.entities,
      metadata,
    };
  }

  async listConversations(limit = 20) {
    return this.conversationRepository.listRecent(limit);
  }

  async listMessages(conversationId: string) {
    return this.messageRepository.listByConversation(conversationId);
  }

  private async resolveConversation(input: ChatMessageDto) {
    if (input.conversationId) {
      const existing = await this.conversationRepository.findById(
        input.conversationId,
      );

      if (existing) {
        return existing;
      }
    }

    return this.conversationRepository.createConversation(input.locale);
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

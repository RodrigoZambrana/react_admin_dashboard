import { Injectable } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';

import { DecisionService } from '../decision/decision.service';
import { InterpretationService } from '../interpretation/interpretation.service';
import { MemoryService } from '../memory/memory.service';
import { ParsingService } from '../parsing/parsing.service';
import { ConversationRepository } from '../persistence/repositories/conversation.repository';
import { MessageRepository } from '../persistence/repositories/message.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { ToolExecutionService } from '../tools/tool-execution.service';
import { ToolExecutionAttempt } from '../tools/tool.types';
import { ChatResponsePolicyService } from './chat-response-policy.service';
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
    private readonly decisionService: DecisionService,
    private readonly toolExecutionService: ToolExecutionService,
    private readonly responsePolicyService: ChatResponsePolicyService,
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
    const decision = this.decisionService.decide(parsedInterpretation);
    const execution = await this.toolExecutionService.executeApprovedAction({
      decision,
      interpretation: parsedInterpretation,
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
        intent: parsedInterpretation.intent,
        language: parsedInterpretation.language,
        confidence: parsedInterpretation.confidence,
        normalizedEntities: parsedInterpretation.normalizedEntities,
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

    const response = this.responsePolicyService.resolve({
      decision,
      execution,
      message: input.message,
      locale: parsedInterpretation.language,
    });

    await this.traceLogService.recordStage({
      conversationId,
      stage: 'response',
      status: 'completed',
      payload: {
        response,
        intent: parsedInterpretation.intent,
        entities: parsedInterpretation.entities,
        normalizedEntities: parsedInterpretation.normalizedEntities,
        language: parsedInterpretation.language,
        confidence: parsedInterpretation.confidence,
        decision,
        execution,
      } as Prisma.InputJsonValue,
    });

    const outgoingMessage = await this.conversationRepository.appendMessage(
      conversationId,
      MessageRole.ASSISTANT,
      response,
      {
        intent: parsedInterpretation.intent,
        entities: parsedInterpretation.entities,
        normalizedEntities: parsedInterpretation.normalizedEntities,
        language: parsedInterpretation.language,
        confidence: parsedInterpretation.confidence,
        decision,
        execution,
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
      },
    });

    return {
      response,
      intent: parsedInterpretation.intent,
      entities: parsedInterpretation.entities,
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
}

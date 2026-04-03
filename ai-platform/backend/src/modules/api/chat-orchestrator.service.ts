import { Injectable } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';

import { InterpretationService } from '../interpretation/interpretation.service';
import { MemoryService } from '../memory/memory.service';
import { ParsingService } from '../parsing/parsing.service';
import { ConversationRepository } from '../persistence/repositories/conversation.repository';
import { MessageRepository } from '../persistence/repositories/message.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { TraceLogService } from './trace-log.service';
import { ChatMessageDto } from './dto/chat-message.dto';

const BASIC_RESPONSE = 'Hello, how can I help you?';
const BASIC_INTENT = 'GENERAL_CONVERSATION';

@Injectable()
export class ChatOrchestratorService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly interpretationService: InterpretationService,
    private readonly parsingService: ParsingService,
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
    const parsedInterpretation = this.parsingService.normalize(
      interpretation.interpretation,
    );

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

    const response = this.buildBasicResponse(
      input.message,
      parsedInterpretation.language,
    );

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

  private buildBasicResponse(message: string, locale?: string) {
    const normalized = `${locale ?? ''} ${message}`.toLowerCase();

    if (normalized.includes('hola')) {
      return 'Hello, how can I help you?';
    }

    if (normalized.includes('hello')) {
      return 'Hello, how can I help you?';
    }

    return BASIC_RESPONSE;
  }
}

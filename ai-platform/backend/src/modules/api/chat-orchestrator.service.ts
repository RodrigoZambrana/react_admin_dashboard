import { Injectable } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';

import { DecisionService } from '../decision/decision.service';
import { DecisionResult } from '../decision/decision.types';
import { InterpretationService } from '../interpretation/interpretation.service';
import { MemoryService } from '../memory/memory.service';
import { ParsingService } from '../parsing/parsing.service';
import { ConversationRepository } from '../persistence/repositories/conversation.repository';
import { MessageRepository } from '../persistence/repositories/message.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { TraceLogService } from './trace-log.service';
import { ChatMessageDto } from './dto/chat-message.dto';

const BASIC_RESPONSE = 'Hello, how can I help you?';

@Injectable()
export class ChatOrchestratorService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly interpretationService: InterpretationService,
    private readonly parsingService: ParsingService,
    private readonly decisionService: DecisionService,
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
    const decision = this.decisionService.decide(parsedInterpretation);

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

    const response = this.buildResponse(
      decision,
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
        decision,
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

  private buildResponse(
    decision: DecisionResult,
    message: string,
    locale?: string,
  ) {
    if (decision.action === 'clarify') {
      return this.buildClarificationResponse(decision.missingFields, locale);
    }

    if (decision.action === 'invoke_tool') {
      return this.buildPendingExecutionResponse(decision.toolName, locale);
    }

    return this.buildBasicResponse(message, locale);
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

  private buildClarificationResponse(missingFields: string[], locale?: string) {
    const isSpanish = this.isSpanish(locale);

    if (missingFields.includes('requested_date')) {
      return isSpanish
        ? 'Necesito la fecha deseada para continuar.'
        : 'I need the requested date to continue.';
    }

    return isSpanish
      ? 'Necesito un poco más de contexto para continuar.'
      : 'I need a bit more context to continue.';
  }

  private buildPendingExecutionResponse(
    toolName: DecisionResult['toolName'],
    locale?: string,
  ) {
    const isSpanish = this.isSpanish(locale);

    if (toolName === 'create_booking') {
      return isSpanish
        ? 'Entendido. Identifique tu solicitud de reserva y la deje lista para el siguiente paso.'
        : 'Understood. I identified your booking request and left it ready for the next step.';
    }

    if (toolName === 'create_quote') {
      return isSpanish
        ? 'Entendido. Identifique tu solicitud de cotizacion y la deje lista para el siguiente paso.'
        : 'Understood. I identified your quote request and left it ready for the next step.';
    }

    if (toolName === 'get_product') {
      return isSpanish
        ? 'Entendido. Identifique tu consulta de producto y la deje lista para el siguiente paso.'
        : 'Understood. I identified your product request and left it ready for the next step.';
    }

    return isSpanish
      ? 'Entendido. Identifique tu solicitud y la deje lista para el siguiente paso.'
      : 'Understood. I identified your request and left it ready for the next step.';
  }

  private isSpanish(locale?: string) {
    return (locale ?? '').toLowerCase().startsWith('es');
  }
}

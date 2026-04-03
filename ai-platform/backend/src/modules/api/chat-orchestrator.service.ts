import { Injectable } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';

import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { DecisionService } from '../decision/decision.service';
import { InterpretationService } from '../interpretation/interpretation.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { MemoryService } from '../memory/memory.service';
import { ConversationRepository } from '../persistence/repositories/conversation.repository';
import { MessageRepository } from '../persistence/repositories/message.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { PromptService } from '../prompt/prompt.service';
import { ParsingService } from '../parsing/parsing.service';
import { ToolEngineService } from '../tools/tool-engine.service';
import { TraceLogService } from './trace-log.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@Injectable()
export class ChatOrchestratorService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly promptService: PromptService,
    private readonly interpretationService: InterpretationService,
    private readonly parsingService: ParsingService,
    private readonly decisionService: DecisionService,
    private readonly toolEngineService: ToolEngineService,
    private readonly aiGatewayService: AiGatewayService,
    private readonly memoryService: MemoryService,
    private readonly traceLogService: TraceLogService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  async handleMessage(input: ChatMessageDto) {
    const conversation = await this.resolveConversation(input);
    const conversationId = conversation.id;

    await this.conversationRepository.appendMessage(
      conversationId,
      MessageRole.USER,
      input.message,
    );
    await this.memoryService.append(conversationId, 'user', input.message);

    await this.traceLogService.recordStage({
      conversationId,
      stage: 'input',
      status: 'received',
      payload: {
        message: input.message,
        locale: input.locale ?? null,
      },
    });

    const memoryEntries = await this.memoryService.getRecent(conversationId);
    await this.traceLogService.recordStage({
      conversationId,
      stage: 'memory',
      status: 'resolved',
      payload: {
        entries: memoryEntries,
      } as Prisma.InputJsonValue,
    });

    const interpretationPrompt =
      await this.promptService.getActivePrompt('interpretation');
    const interpretationStartedAt = Date.now();
    const interpretation = await this.interpretationService.interpret(
      input.message,
      input.locale,
      interpretationPrompt?.template,
    );
    await this.traceLogService.recordStage({
      conversationId,
      stage: 'interpretation',
      status: 'completed',
      latencyMs: Date.now() - interpretationStartedAt,
      payload: {
        promptVersion: interpretationPrompt?.version ?? null,
        output: interpretation,
      } as Prisma.InputJsonValue,
    });

    const parsed = this.parsingService.normalize(interpretation);
    await this.traceLogService.recordStage({
      conversationId,
      stage: 'parsing',
      status: 'completed',
      payload: {
        normalizedEntities: parsed.normalizedEntities,
      } as Prisma.InputJsonValue,
    });

    const decision = this.decisionService.decide(parsed);
    await this.traceLogService.recordStage({
      conversationId,
      stage: 'decision',
      status: 'completed',
      payload: {
        output: decision,
      } as Prisma.InputJsonValue,
    });

    let toolResult: Record<string, unknown> | null = null;

    if (decision.action === 'invoke_tool' && decision.toolName) {
      const executionResult = await this.toolEngineService.execute(
        decision.toolName,
        {
          interpretation: parsed,
        },
      );
      toolResult = executionResult.payload;

      const executionLog = await this.traceLogService.recordStage({
        conversationId,
        stage: 'execution',
        status: 'completed',
        payload: {
          toolName: executionResult.toolName,
          output: executionResult.payload,
        } as Prisma.InputJsonValue,
      });

      this.knowledgeService.enqueueExtraction({
        stage: executionLog.stage,
        payload: executionLog.payload as Record<string, unknown>,
        sourceLogId: executionLog.id,
      });
      await this.traceLogService.recordStage({
        conversationId,
        stage: 'learning',
        status: 'queued',
        payload: {
          sourceLogId: executionLog.id,
          sourceStage: executionLog.stage,
        },
      });
    } else {
      await this.traceLogService.recordStage({
        conversationId,
        stage: 'execution',
        status: 'skipped',
        payload: {
          reason: decision.action,
        },
      });
    }

    const responsePrompt = await this.promptService.getActivePrompt('response');
    const responseStartedAt = Date.now();
    const responseMessage = await this.aiGatewayService.generateResponse({
      message: input.message,
      intent: parsed.intent,
      language: parsed.language,
      toolResult,
      promptTemplate: responsePrompt?.template,
      responseTemplateKey: decision.responseTemplateKey,
      missingFields: decision.missingFields,
    });

    const responseLog = await this.traceLogService.recordStage({
      conversationId,
      stage: 'response',
      status: 'completed',
      latencyMs: Date.now() - responseStartedAt,
      payload: {
        promptVersion: responsePrompt?.version ?? null,
        message: responseMessage,
      },
    });

    this.knowledgeService.enqueueExtraction({
      stage: responseLog.stage,
      payload: responseLog.payload as Record<string, unknown>,
      sourceLogId: responseLog.id,
    });
    await this.traceLogService.recordStage({
      conversationId,
      stage: 'learning',
      status: 'queued',
      payload: {
        sourceLogId: responseLog.id,
        sourceStage: responseLog.stage,
      },
    });

    await this.conversationRepository.appendMessage(
      conversationId,
      MessageRole.ASSISTANT,
      responseMessage,
      {
        decision,
        toolResult,
      } as Prisma.InputJsonValue,
    );
    await this.memoryService.append(conversationId, 'assistant', responseMessage);

    await this.traceLogService.recordStage({
      conversationId,
      stage: 'logging',
      status: 'completed',
      payload: {
        conversationId,
      },
    });

    return {
      conversationId,
      traceId: this.tenantContext.getTraceId(),
      message: responseMessage,
      debug: {
        interpretation,
        normalizedEntities: parsed.normalizedEntities,
        decision,
        toolResult,
        memoryEntries,
      },
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
}

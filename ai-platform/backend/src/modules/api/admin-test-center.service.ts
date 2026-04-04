import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatLog } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { KnowledgeMetadataService } from '../knowledge-metadata/knowledge-metadata.service';
import { PromptService } from '../prompt/prompt.service';
import { ResponseFallbackService } from '../response-fallback/response-fallback.service';
import { TemporalLocaleService } from '../temporal/temporal-locale.service';
import { ChatLogRepository } from '../persistence/repositories/chat-log.repository';
import { ConversationRepository } from '../persistence/repositories/conversation.repository';
import { ConversationStateRepository } from '../persistence/repositories/conversation-state.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { ChatOrchestratorService } from './chat-orchestrator.service';

const TEST_CENTER_CHANNEL = 'admin_test_center';

type ReplayTurnInput = {
  message: string;
  locale?: string;
};

@Injectable()
export class AdminTestCenterService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly chatOrchestratorService: ChatOrchestratorService,
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationStateRepository: ConversationStateRepository,
    private readonly chatLogRepository: ChatLogRepository,
    private readonly promptService: PromptService,
    private readonly temporalLocaleService: TemporalLocaleService,
    private readonly responseFallbackService: ResponseFallbackService,
    private readonly knowledgeMetadataService: KnowledgeMetadataService,
  ) {}

  async listTestRuns(limit = 20) {
    const conversations = await this.conversationRepository.listRecentByChannel(
      TEST_CENTER_CHANNEL,
      normalizeLimit(limit, 20),
    );

    return Promise.all(
      conversations.map(async (conversation) => {
        const traceLogs = await this.chatLogRepository.listByConversationId(
          conversation.id,
        );

        return {
          id: conversation.id,
          language: conversation.language,
          channel: conversation.channel,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          latestMessage: conversation.messages[0]?.content ?? null,
          latestRole: conversation.messages[0]?.role ?? null,
          traceCount: this.collectTraceIds(traceLogs).length,
        };
      }),
    );
  }

  async getTestRun(conversationId: string) {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation || conversation.channel !== TEST_CENTER_CHANNEL) {
      throw new NotFoundException(
        `Test-center conversation ${conversationId} was not found`,
      );
    }

    const state = await this.conversationStateRepository.findByConversationId(
      conversationId,
    );
    const traceLogs = await this.chatLogRepository.listByConversationId(conversationId);
    const traceIds = this.collectTraceIds(traceLogs);

    return {
      conversation: {
        id: conversation.id,
        language: conversation.language,
        channel: conversation.channel,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: conversation.messages,
      state,
      traces: traceIds.map((traceId) =>
        this.buildTraceSummary(traceLogs.filter((log) => log.traceId === traceId)),
      ),
      logs: traceLogs,
    };
  }

  async listRecentTraceSummaries(limit = 20) {
    const normalizedLimit = normalizeLimit(limit, 20);
    const logs = await this.chatLogRepository.listRecent(normalizedLimit * 12);
    const grouped = new Map<string, ChatLog[]>();

    for (const log of logs) {
      const trace = grouped.get(log.traceId) ?? [];
      trace.push(log);
      grouped.set(log.traceId, trace);
    }

    return Array.from(grouped.values())
      .map((traceLogs) => this.buildTraceSummary(traceLogs))
      .sort((left, right) => {
        return (
          new Date(right.lastStageAt).getTime() -
          new Date(left.lastStageAt).getTime()
        );
      })
      .slice(0, normalizedLimit);
  }

  async getTraceDetail(traceId: string) {
    const logs = await this.chatLogRepository.getTrace(traceId);

    if (logs.length === 0) {
      throw new NotFoundException(`Trace ${traceId} was not found`);
    }

    return {
      summary: this.buildTraceSummary(logs),
      logs,
    };
  }

  async compareTraces(leftTraceId: string, rightTraceId: string) {
    const [leftLogs, rightLogs] = await Promise.all([
      this.chatLogRepository.getTrace(leftTraceId),
      this.chatLogRepository.getTrace(rightTraceId),
    ]);

    if (leftLogs.length === 0) {
      throw new NotFoundException(`Trace ${leftTraceId} was not found`);
    }

    if (rightLogs.length === 0) {
      throw new NotFoundException(`Trace ${rightTraceId} was not found`);
    }

    const left = this.buildTraceSummary(leftLogs);
    const right = this.buildTraceSummary(rightLogs);
    const leftStages = left.stages.map((stage) => stage.stage);
    const rightStages = right.stages.map((stage) => stage.stage);
    const stageUnion = Array.from(new Set([...leftStages, ...rightStages]));

    return {
      left,
      right,
      comparison: {
        sameStageSequence:
          JSON.stringify(leftStages) === JSON.stringify(rightStages),
        sameIntent:
          left.interpretation?.intent === right.interpretation?.intent,
        sameDecisionAction:
          left.decision?.action === right.decision?.action,
        sameToolName:
          (left.execution?.toolName ?? null) === (right.execution?.toolName ?? null),
        sameExecutionOutcome:
          (left.execution?.ok ?? null) === (right.execution?.ok ?? null),
        sameResponse:
          (left.response?.text ?? null) === (right.response?.text ?? null),
        differingStages: stageUnion.filter((stage) => {
          const leftStage = left.stages.find((entry) => entry.stage === stage);
          const rightStage = right.stages.find((entry) => entry.stage === stage);

          return JSON.stringify(leftStage ?? null) !== JSON.stringify(rightStage ?? null);
        }),
      },
    };
  }

  async replayConversation(input: { locale?: string; turns: ReplayTurnInput[] }) {
    const tenantId = this.tenantContext.getTenantId();
    let conversationId: string | undefined;
    const turns = [];

    for (const turn of input.turns) {
      const traceId = randomUUID();
      const result = await this.tenantContext.run({ tenantId, traceId }, () =>
        this.chatOrchestratorService.handleMessage({
          message: turn.message,
          locale: turn.locale ?? input.locale,
          conversationId,
          channel: TEST_CENTER_CHANNEL,
        }),
      );

      conversationId = result.metadata.conversationId;
      turns.push({
        input: turn.message,
        locale: turn.locale ?? input.locale ?? null,
        traceId,
        response: result.response,
        intent: result.intent,
        metadata: result.metadata,
      });
    }

    if (!conversationId) {
      throw new NotFoundException('Replay did not produce a conversation');
    }

    const detail = await this.getTestRun(conversationId);

    return {
      conversationId,
      turns,
      detail,
    };
  }

  async getInvestigationResources() {
    const [prompts, locales, fallbacks, knowledgeMetadata] = await Promise.all([
      this.promptService.listActivePrompts(),
      this.temporalLocaleService.listActiveLocales(),
      this.responseFallbackService.listActiveCatalogs(),
      this.knowledgeMetadataService.listActiveResources(),
    ]);

    return {
      prompts,
      dateTimeLocaleResources: locales,
      responseFallbackCatalogs: fallbacks,
      knowledgeMetadata,
    };
  }

  private collectTraceIds(logs: ChatLog[]) {
    return Array.from(new Set(logs.map((log) => log.traceId)));
  }

  private buildTraceSummary(logs: ChatLog[]) {
    const sortedLogs = [...logs].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
    const firstLog = sortedLogs[0];
    const lastLog = sortedLogs[sortedLogs.length - 1];
    const interpretationLog = sortedLogs.find((log) => log.stage === 'interpretation');
    const decisionLog = sortedLogs.find((log) => log.stage === 'decision');
    const executionLog = sortedLogs.find((log) => log.stage === 'execution');
    const responseLog = sortedLogs.find((log) => log.stage === 'response');

    return {
      traceId: firstLog.traceId,
      conversationId: firstLog.conversationId,
      firstStageAt: firstLog.createdAt,
      lastStageAt: lastLog.createdAt,
      stages: sortedLogs.map((log) => ({
        stage: log.stage,
        status: log.status,
        createdAt: log.createdAt,
      })),
      interpretation: interpretationLog
        ? {
            intent: (interpretationLog.payload as Record<string, unknown>)
              .parsedJson
              ? ((interpretationLog.payload as any).parsedJson.intent ?? null)
              : null,
            usedFallback:
              ((interpretationLog.payload as any).usedFallback as boolean | null) ??
              null,
          }
        : null,
      decision: decisionLog
        ? {
            domain: (decisionLog.payload as any).domain ?? null,
            action: (decisionLog.payload as any).action ?? null,
            toolName: (decisionLog.payload as any).toolName ?? null,
            missingFields: (decisionLog.payload as any).missingFields ?? [],
          }
        : null,
      execution: executionLog
        ? {
            ok: executionLog.status === 'completed',
            toolName: (executionLog.payload as any).toolName ?? null,
            failure: (executionLog.payload as any).failure ?? null,
          }
        : null,
      response: responseLog
        ? {
            text: (responseLog.payload as any).response ?? null,
            fallbackReason:
              (responseLog.payload as any).responseFallbackReason ?? null,
          }
        : null,
    };
  }
}

function normalizeLimit(value: number, fallback: number) {
  if (!Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.min(Math.floor(value), 100);
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CriticalConfigService } from '../critical-config/critical-config.service';
import { KnowledgeMetadataService } from '../knowledge-metadata/knowledge-metadata.service';
import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { ChatLogRepository } from '../persistence/repositories/chat-log.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { extractKnowledgeCandidate } from './knowledge.extractor';
import { KnowledgeService } from './knowledge.service';

type LearningJob = {
  logId: string;
  tenantId: string;
  traceId: string;
};

@Injectable()
export class LearningService {
  private readonly queue: LearningJob[] = [];
  private isProcessing = false;

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly chatLogRepository: ChatLogRepository,
    private readonly criticalConfigService: CriticalConfigService,
    private readonly knowledgeMetadataService: KnowledgeMetadataService,
    private readonly knowledgeService: KnowledgeService,
    private readonly logger: PipelineLoggerService,
  ) {}

  enqueueLog(input: LearningJob) {
    this.queue.push(input);

    if (!this.isProcessing) {
      this.isProcessing = true;
      setImmediate(() => {
        void this.drainQueue();
      });
    }
  }

  private async drainQueue() {
    while (this.queue.length > 0) {
      const job = this.queue.shift();

      if (!job) {
        continue;
      }

      await this.tenantContext.run(
        { tenantId: job.tenantId, traceId: job.traceId },
        async () => {
          await this.processStoredLog(job.logId);
        },
      );
    }

    this.isProcessing = false;
  }

  private async processStoredLog(logId: string) {
    const learningConfigResource = await this.criticalConfigService.getActiveConfig(
      'learning',
    );
    const learningConfig = learningConfigResource?.value;

    if (!learningConfig?.enabled) {
      return;
    }

    const sourceLog = await this.chatLogRepository.findById(logId);

    if (!sourceLog || sourceLog.stage === 'learning') {
      return;
    }

    if (!learningConfig.observedStages.includes(sourceLog.stage)) {
      return;
    }

    const knowledgeMetadataResource =
      await this.knowledgeMetadataService.getActiveResource('default');
    const knowledgeMetadataPolicy = knowledgeMetadataResource?.value;

    if (!knowledgeMetadataPolicy?.enabledStages.includes(sourceLog.stage)) {
      await this.recordLearningLog({
        conversationId: sourceLog.conversationId ?? undefined,
        traceId: sourceLog.traceId,
        status: 'skipped',
        sourceLogId: sourceLog.id,
        payload: {
          reason: 'stage_not_enabled',
          sourceStage: sourceLog.stage,
          knowledgeMetadataVersion: knowledgeMetadataResource?.version ?? null,
          learningConfigVersion: learningConfigResource?.version ?? null,
        },
      });
      return;
    }

    const payload = this.asRecord(sourceLog.payload);
    const candidate = extractKnowledgeCandidate({
      stage: sourceLog.stage,
      payload,
    });

    if (!candidate) {
      await this.recordLearningLog({
        conversationId: sourceLog.conversationId ?? undefined,
        traceId: sourceLog.traceId,
        status: 'skipped',
        sourceLogId: sourceLog.id,
        payload: {
          reason: 'no_candidate',
          sourceStage: sourceLog.stage,
          knowledgeMetadataVersion: knowledgeMetadataResource?.version ?? null,
          learningConfigVersion: learningConfigResource?.version ?? null,
        },
      });
      return;
    }

    const stagePolicy = knowledgeMetadataPolicy.stagePolicies[sourceLog.stage];
    const effectiveMinConfidence = Math.max(
      learningConfig.minConfidence,
      stagePolicy?.minConfidence ?? 0,
    );

    if (candidate.confidence < effectiveMinConfidence) {
      await this.recordLearningLog({
        conversationId: sourceLog.conversationId ?? undefined,
        traceId: sourceLog.traceId,
        status: 'skipped',
        sourceLogId: sourceLog.id,
        payload: {
          reason: 'below_min_confidence',
          sourceStage: sourceLog.stage,
          candidateConfidence: candidate.confidence,
          effectiveMinConfidence,
          knowledgeMetadataVersion: knowledgeMetadataResource?.version ?? null,
          learningConfigVersion: learningConfigResource?.version ?? null,
        },
      });
      return;
    }

    try {
      const stored = await this.knowledgeService.storeCandidate({
        sourceLogId: sourceLog.id,
        tenantId: this.tenantContext.getTenantId(),
        category: candidate.category,
        title: candidate.title,
        body: candidate.body.slice(0, learningConfig.maxBodyLength),
        summary: candidate.summary.slice(0, learningConfig.maxSummaryLength),
        tags: Array.from(
          new Set([...candidate.tags, ...(stagePolicy?.defaultTags ?? [])]),
        ),
        confidence: candidate.confidence,
        metadata: this.buildGovernedMetadata({
          metadataAllowList: knowledgeMetadataPolicy.metadataAllowList,
          candidateMetadata: candidate.metadata,
          sourceStage: sourceLog.stage,
          sourceStatus: sourceLog.status,
          policyVersion: knowledgeMetadataResource?.version ?? null,
          learningConfigVersion: learningConfigResource?.version ?? null,
        }),
        persistEmbedding: learningConfig.persistEmbeddings,
      });

      await this.recordLearningLog({
        conversationId: sourceLog.conversationId ?? undefined,
        traceId: sourceLog.traceId,
        status: 'completed',
        sourceLogId: sourceLog.id,
        payload: {
          sourceStage: sourceLog.stage,
          knowledgeId: stored.id,
          category: stored.category,
          embeddingId: stored.embeddingId ?? null,
          knowledgeMetadataVersion: knowledgeMetadataResource?.version ?? null,
          learningConfigVersion: learningConfigResource?.version ?? null,
        },
      });
    } catch (error) {
      await this.recordLearningLog({
        conversationId: sourceLog.conversationId ?? undefined,
        traceId: sourceLog.traceId,
        status: 'failed',
        sourceLogId: sourceLog.id,
        payload: {
          sourceStage: sourceLog.stage,
          error: error instanceof Error ? error.message : String(error),
          knowledgeMetadataVersion: knowledgeMetadataResource?.version ?? null,
          learningConfigVersion: learningConfigResource?.version ?? null,
        },
      });

      this.logger.error(
        JSON.stringify({
          stage: 'learning',
          sourceLogId: sourceLog.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  private async recordLearningLog(input: {
    conversationId?: string;
    traceId: string;
    status: string;
    sourceLogId: string;
    payload: Record<string, unknown>;
  }) {
    await this.chatLogRepository.createLog({
      conversationId: input.conversationId,
      traceId: input.traceId,
      stage: 'learning',
      status: input.status,
      payload: {
        sourceLogId: input.sourceLogId,
        ...input.payload,
      } as Prisma.InputJsonValue,
    });
  }

  private buildGovernedMetadata(input: {
    metadataAllowList: string[];
    candidateMetadata?: Record<string, unknown>;
    sourceStage: string;
    sourceStatus: string;
    policyVersion: number | null;
    learningConfigVersion: number | null;
  }) {
    const candidateMetadata = input.candidateMetadata ?? {};
    const filteredMetadata = Object.fromEntries(
      Object.entries(candidateMetadata).filter(([key]) =>
        input.metadataAllowList.includes(key),
      ),
    );

    return {
      ...filteredMetadata,
      sourceStage: input.sourceStage,
      sourceStatus: input.sourceStatus,
      governance: {
        knowledgeMetadataVersion: input.policyVersion,
        learningConfigVersion: input.learningConfigVersion,
      },
    };
  }

  private asRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { KnowledgeRepository } from '../persistence/repositories/knowledge.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { extractKnowledgeCandidate } from './knowledge.extractor';
import { QdrantStoreService } from './qdrant-store.service';

type KnowledgeExtractionJob = {
  tenantId: string;
  traceId: string;
  stage: string;
  payload: Record<string, unknown>;
  sourceLogId?: string;
};

@Injectable()
export class KnowledgeService {
  private readonly queue: KnowledgeExtractionJob[] = [];
  private isProcessing = false;

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly knowledgeRepository: KnowledgeRepository,
    private readonly qdrantStore: QdrantStoreService,
    private readonly logger: PipelineLoggerService,
  ) {}

  enqueueExtraction(input: {
    stage: string;
    payload: Record<string, unknown>;
    sourceLogId?: string;
  }) {
    this.queue.push({
      tenantId: this.tenantContext.getTenantId(),
      traceId: this.tenantContext.getTraceId(),
      stage: input.stage,
      payload: input.payload,
      sourceLogId: input.sourceLogId,
    });

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
          const candidate = extractKnowledgeCandidate({
            stage: job.stage,
            payload: job.payload,
          });

          if (!candidate) {
            return;
          }

          const stored = await this.knowledgeRepository.createKnowledge({
            sourceLogId: job.sourceLogId,
            category: candidate.category,
            title: candidate.title,
            body: candidate.body,
            summary: candidate.summary,
            tags: candidate.tags,
            confidence: candidate.confidence,
            metadata: candidate.metadata as Prisma.InputJsonValue | undefined,
          });

          await this.qdrantStore.upsert({
            id: stored.id,
            tenantId: job.tenantId,
            summary: candidate.summary,
            category: candidate.category,
          });

          this.logger.log(
            JSON.stringify({
              stage: 'learning',
              knowledgeId: stored.id,
              category: candidate.category,
            }),
          );
        },
      );
    }

    this.isProcessing = false;
  }
}

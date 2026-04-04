import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { KnowledgeRepository } from '../persistence/repositories/knowledge.repository';
import { QdrantStoreService } from './qdrant-store.service';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly knowledgeRepository: KnowledgeRepository,
    private readonly qdrantStore: QdrantStoreService,
    private readonly logger: PipelineLoggerService,
  ) {}

  async storeCandidate(input: {
    sourceLogId?: string;
    tenantId: string;
    category: string;
    title: string;
    body: string;
    summary: string;
    tags: string[];
    confidence: number;
    metadata?: Record<string, unknown>;
    persistEmbedding?: boolean;
  }) {
    const stored = await this.knowledgeRepository.createKnowledge({
      sourceLogId: input.sourceLogId,
      category: input.category as any,
      title: input.title,
      body: input.body,
      summary: input.summary,
      tags: input.tags,
      confidence: input.confidence,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    });

    const embeddingId = input.persistEmbedding
      ? await this.qdrantStore.upsert({
          id: stored.id,
          tenantId: input.tenantId,
          summary: input.summary,
          category: input.category,
        })
      : null;

    if (embeddingId) {
      await this.knowledgeRepository.updateEmbeddingId(stored.id, embeddingId);
    }

    this.logger.log(
      JSON.stringify({
        stage: 'learning',
        knowledgeId: stored.id,
        category: input.category,
        persistedEmbedding: Boolean(embeddingId),
      }),
    );

    return {
      ...stored,
      embeddingId,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { KnowledgeCategory, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type CreateKnowledgeInput = {
  sourceLogId?: string;
  category: KnowledgeCategory;
  title: string;
  body: string;
  summary: string;
  tags: string[];
  confidence: number;
  embeddingId?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class KnowledgeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  createKnowledge(input: CreateKnowledgeInput) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.knowledge.create({
      data: {
        tenantId,
        sourceLogId: input.sourceLogId,
        category: input.category,
        title: input.title,
        body: input.body,
        summary: input.summary,
        tags: input.tags,
        confidence: input.confidence,
        embeddingId: input.embeddingId,
        metadata: input.metadata,
      },
    });
  }

  listRecent(limit = 100) {
    return this.prisma.knowledge.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  listByCategory(category: KnowledgeCategory, limit = 50) {
    return this.prisma.knowledge.findMany({
      where: { category },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

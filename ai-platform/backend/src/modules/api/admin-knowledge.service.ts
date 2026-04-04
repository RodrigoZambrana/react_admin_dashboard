import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';

import { KnowledgeService } from '../knowledge/knowledge.service';

const knowledgeCategorySchema = z.enum([
  'GENERAL',
  'FAQ',
  'PRODUCT',
  'BOOKING',
  'QUOTE',
  'POLICY',
]);

@Injectable()
export class AdminKnowledgeService {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  async listKnowledge(input: { limit: number; category?: string }) {
    const category = input.category
      ? this.parseCategory(input.category)
      : undefined;

    return this.knowledgeService.listKnowledge({
      limit: normalizeLimit(input.limit, 50),
      category,
    });
  }

  async getKnowledge(knowledgeId: string) {
    const knowledge = await this.knowledgeService.getKnowledgeById(knowledgeId);

    if (!knowledge) {
      throw new NotFoundException(`Knowledge ${knowledgeId} was not found`);
    }

    return knowledge;
  }

  private parseCategory(category: string) {
    const parsed = knowledgeCategorySchema.safeParse(category);

    if (!parsed.success) {
      throw new BadRequestException(`Unsupported knowledge category "${category}"`);
    }

    return parsed.data;
  }
}

function normalizeLimit(value: number, fallback: number) {
  if (!Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.min(Math.floor(value), 100);
}

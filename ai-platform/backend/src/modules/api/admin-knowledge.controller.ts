import { Controller, Get, Param, Query } from '@nestjs/common';

import { AdminKnowledgeService } from './admin-knowledge.service';

@Controller('admin/knowledge')
export class AdminKnowledgeController {
  constructor(private readonly adminKnowledgeService: AdminKnowledgeService) {}

  @Get()
  listKnowledge(
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    return this.adminKnowledgeService.listKnowledge({
      limit: Number(limit ?? 50),
      category,
    });
  }

  @Get(':knowledgeId')
  getKnowledge(@Param('knowledgeId') knowledgeId: string) {
    return this.adminKnowledgeService.getKnowledge(knowledgeId);
  }
}

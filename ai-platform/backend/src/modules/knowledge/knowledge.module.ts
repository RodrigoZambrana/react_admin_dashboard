import { Module } from '@nestjs/common';

import { KnowledgeService } from './knowledge.service';
import { QdrantStoreService } from './qdrant-store.service';

@Module({
  providers: [KnowledgeService, QdrantStoreService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}

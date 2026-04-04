import { Module } from '@nestjs/common';

import { CriticalConfigModule } from '../critical-config/critical-config.module';
import { KnowledgeMetadataModule } from '../knowledge-metadata/knowledge-metadata.module';
import { LearningService } from './learning.service';
import { KnowledgeService } from './knowledge.service';
import { QdrantStoreService } from './qdrant-store.service';

@Module({
  imports: [CriticalConfigModule, KnowledgeMetadataModule],
  providers: [KnowledgeService, LearningService, QdrantStoreService],
  exports: [KnowledgeService, LearningService, QdrantStoreService],
})
export class KnowledgeModule {}

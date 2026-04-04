import { Module } from '@nestjs/common';

import { KnowledgeMetadataVersionRepository } from '../persistence/repositories/knowledge-metadata-version.repository';
import { FileSystemKnowledgeMetadataSeedSource } from './filesystem-knowledge-metadata.seed-source';
import { KnowledgeMetadataProvider } from './knowledge-metadata.provider';
import { KnowledgeMetadataService } from './knowledge-metadata.service';
import { ManagedKnowledgeMetadataProvider } from './managed-knowledge-metadata.provider';

@Module({
  providers: [
    FileSystemKnowledgeMetadataSeedSource,
    ManagedKnowledgeMetadataProvider,
    KnowledgeMetadataVersionRepository,
    KnowledgeMetadataService,
    {
      provide: KnowledgeMetadataProvider,
      useExisting: ManagedKnowledgeMetadataProvider,
    },
  ],
  exports: [KnowledgeMetadataProvider, KnowledgeMetadataService],
})
export class KnowledgeMetadataModule {}

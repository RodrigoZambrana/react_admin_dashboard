import { Module } from '@nestjs/common';

import { ConversationSignalsModule } from '../conversation-signals/conversation-signals.module';
import { LoggingModule } from '../logging/logging.module';
import { TenantResourcesModule } from '../tenant-resources/tenant-resources.module';
import { DocumentContentExtractorService } from './document-content-extractor.service';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentKnowledgeExtractionService } from './document-knowledge-extraction.service';
import { DocumentRetrievalService } from './document-retrieval.service';
import { DocumentService } from './document.service';

@Module({
  imports: [ConversationSignalsModule, LoggingModule, TenantResourcesModule],
  providers: [
    DocumentContentExtractorService,
    DocumentIngestionService,
    DocumentKnowledgeExtractionService,
    DocumentRetrievalService,
    DocumentService,
  ],
  exports: [
    DocumentContentExtractorService,
    DocumentIngestionService,
    DocumentKnowledgeExtractionService,
    DocumentRetrievalService,
    DocumentService,
  ],
})
export class DocumentsModule {}

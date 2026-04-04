import { Module } from '@nestjs/common';

import { LoggingModule } from '../logging/logging.module';
import { DocumentContentExtractorService } from './document-content-extractor.service';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentRetrievalService } from './document-retrieval.service';
import { DocumentService } from './document.service';

@Module({
  imports: [LoggingModule],
  providers: [
    DocumentContentExtractorService,
    DocumentIngestionService,
    DocumentRetrievalService,
    DocumentService,
  ],
  exports: [
    DocumentContentExtractorService,
    DocumentIngestionService,
    DocumentRetrievalService,
    DocumentService,
  ],
})
export class DocumentsModule {}

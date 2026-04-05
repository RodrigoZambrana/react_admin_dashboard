import { Module } from '@nestjs/common';

import { ConversationSignalsModule } from '../conversation-signals/conversation-signals.module';
import { LoggingModule } from '../logging/logging.module';
import { TenantCapabilitiesModule } from '../tenant-capabilities/tenant-capabilities.module';
import { TenantResourcesModule } from '../tenant-resources/tenant-resources.module';
import { DocumentContentExtractorService } from './document-content-extractor.service';
import { DocumentExtractionProfileConfigService } from './document-extraction-profile-config.service';
import { DocumentExtractionProfileRegistryService } from './document-extraction-profile-registry.service';
import { DocumentExtractionProfileResolverService } from './document-extraction-profile-resolver.service';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentKnowledgeExtractionOrchestrator } from './document-knowledge-extraction.orchestrator';
import { DocumentKnowledgeExtractionService } from './document-knowledge-extraction.service';
import { DocumentKnowledgeViewService } from './document-knowledge-view.service';
import { DocumentProfileBootstrapService } from './document-profile-bootstrap.service';
import { DocumentRetrievalService } from './document-retrieval.service';
import { DocumentService } from './document.service';
import { ProductCatalogDocumentProfile } from './profiles/product-catalog-document.profile';

@Module({
  imports: [
    ConversationSignalsModule,
    LoggingModule,
    TenantCapabilitiesModule,
    TenantResourcesModule,
  ],
  providers: [
    DocumentContentExtractorService,
    DocumentExtractionProfileConfigService,
    ProductCatalogDocumentProfile,
    DocumentExtractionProfileRegistryService,
    DocumentExtractionProfileResolverService,
    DocumentKnowledgeExtractionOrchestrator,
    DocumentProfileBootstrapService,
    DocumentKnowledgeViewService,
    DocumentIngestionService,
    DocumentKnowledgeExtractionService,
    DocumentRetrievalService,
    DocumentService,
  ],
  exports: [
    DocumentContentExtractorService,
    DocumentExtractionProfileConfigService,
    DocumentExtractionProfileRegistryService,
    DocumentExtractionProfileResolverService,
    DocumentKnowledgeExtractionOrchestrator,
    DocumentProfileBootstrapService,
    DocumentKnowledgeViewService,
    DocumentIngestionService,
    DocumentKnowledgeExtractionService,
    DocumentRetrievalService,
    DocumentService,
  ],
})
export class DocumentsModule {}

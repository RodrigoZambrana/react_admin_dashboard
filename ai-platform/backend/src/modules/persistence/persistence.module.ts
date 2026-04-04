import { Global, Module } from '@nestjs/common';

import { LoggingModule } from '../logging/logging.module';
import { AsyncConversationTurnInputRepository } from './repositories/async-conversation-turn-input.repository';
import { AsyncConversationTurnRepository } from './repositories/async-conversation-turn.repository';
import { CatalogItemRepository } from './repositories/catalog-item.repository';
import { CatalogSourceRepository } from './repositories/catalog-source.repository';
import { ChatLogRepository } from './repositories/chat-log.repository';
import { ConversationRepository } from './repositories/conversation.repository';
import { ConversationStateRepository } from './repositories/conversation-state.repository';
import { CriticalConfigVersionRepository } from './repositories/critical-config-version.repository';
import { DocumentChunkRepository } from './repositories/document-chunk.repository';
import { DocumentRepository } from './repositories/document.repository';
import { InfrastructureRepository } from './repositories/infrastructure.repository';
import { KnowledgeRepository } from './repositories/knowledge.repository';
import { KnowledgeMetadataVersionRepository } from './repositories/knowledge-metadata-version.repository';
import { MessageRepository } from './repositories/message.repository';
import { PromptVersionRepository } from './repositories/prompt-version.repository';
import { TemporalLocaleVersionRepository } from './repositories/temporal-locale-version.repository';
import { PrismaService } from './prisma/prisma.service';
import { TenantContextService } from './tenant/tenant-context.service';
import { TenantMiddleware } from './tenant/tenant.middleware';

@Global()
@Module({
  imports: [LoggingModule],
  providers: [
    TenantContextService,
    TenantMiddleware,
    PrismaService,
    AsyncConversationTurnRepository,
    AsyncConversationTurnInputRepository,
    CatalogSourceRepository,
    CatalogItemRepository,
    InfrastructureRepository,
    ConversationRepository,
    ConversationStateRepository,
    CriticalConfigVersionRepository,
    DocumentRepository,
    DocumentChunkRepository,
    MessageRepository,
    ChatLogRepository,
    PromptVersionRepository,
    TemporalLocaleVersionRepository,
    KnowledgeRepository,
    KnowledgeMetadataVersionRepository,
  ],
  exports: [
    TenantContextService,
    PrismaService,
    AsyncConversationTurnRepository,
    AsyncConversationTurnInputRepository,
    CatalogSourceRepository,
    CatalogItemRepository,
    InfrastructureRepository,
    ConversationRepository,
    ConversationStateRepository,
    CriticalConfigVersionRepository,
    DocumentRepository,
    DocumentChunkRepository,
    MessageRepository,
    ChatLogRepository,
    PromptVersionRepository,
    TemporalLocaleVersionRepository,
    KnowledgeRepository,
    KnowledgeMetadataVersionRepository,
  ],
})
export class PersistenceModule {}

import { Global, Module } from '@nestjs/common';

import { LoggingModule } from '../logging/logging.module';
import { ChatLogRepository } from './repositories/chat-log.repository';
import { ConversationRepository } from './repositories/conversation.repository';
import { ConversationStateRepository } from './repositories/conversation-state.repository';
import { CriticalConfigVersionRepository } from './repositories/critical-config-version.repository';
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
    InfrastructureRepository,
    ConversationRepository,
    ConversationStateRepository,
    CriticalConfigVersionRepository,
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
    InfrastructureRepository,
    ConversationRepository,
    ConversationStateRepository,
    CriticalConfigVersionRepository,
    MessageRepository,
    ChatLogRepository,
    PromptVersionRepository,
    TemporalLocaleVersionRepository,
    KnowledgeRepository,
    KnowledgeMetadataVersionRepository,
  ],
})
export class PersistenceModule {}

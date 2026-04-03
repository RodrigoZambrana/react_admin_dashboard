import { Global, Module } from '@nestjs/common';

import { ChatLogRepository } from './repositories/chat-log.repository';
import { ConversationRepository } from './repositories/conversation.repository';
import { KnowledgeRepository } from './repositories/knowledge.repository';
import { MessageRepository } from './repositories/message.repository';
import { PromptVersionRepository } from './repositories/prompt-version.repository';
import { PrismaService } from './prisma/prisma.service';
import { TenantContextService } from './tenant/tenant-context.service';
import { TenantMiddleware } from './tenant/tenant.middleware';

@Global()
@Module({
  providers: [
    TenantContextService,
    TenantMiddleware,
    PrismaService,
    ConversationRepository,
    MessageRepository,
    ChatLogRepository,
    PromptVersionRepository,
    KnowledgeRepository,
  ],
  exports: [
    TenantContextService,
    PrismaService,
    ConversationRepository,
    MessageRepository,
    ChatLogRepository,
    PromptVersionRepository,
    KnowledgeRepository,
  ],
})
export class PersistenceModule {}

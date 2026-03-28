import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma/prisma.module'
import { InboxModule } from '../inbox/inbox.module'
import { KnowledgeModule } from '../knowledge/knowledge.module'
import { ConversationsController } from './conversations.controller'
import { ConversationsService } from './conversations.service'

@Module({
  imports: [ConfigModule, PrismaModule, InboxModule, KnowledgeModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}

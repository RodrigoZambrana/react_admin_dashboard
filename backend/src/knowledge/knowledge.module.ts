import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma/prisma.module'
import { OpenAiClientModule } from '../common/openai/openai-client.module'
import { KnowledgeController } from './knowledge.controller'
import { KnowledgeEmbeddingsService } from './knowledge-embeddings.service'
import { KnowledgeService } from './knowledge.service'

@Module({
  imports: [ConfigModule, PrismaModule, OpenAiClientModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeEmbeddingsService],
  exports: [KnowledgeService, KnowledgeEmbeddingsService],
})
export class KnowledgeModule {}

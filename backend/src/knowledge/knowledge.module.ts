import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma/prisma.module'
import { KnowledgeController } from './knowledge.controller'
import { KnowledgeEmbeddingsService } from './knowledge-embeddings.service'
import { KnowledgeService } from './knowledge.service'

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeEmbeddingsService],
  exports: [KnowledgeService, KnowledgeEmbeddingsService],
})
export class KnowledgeModule {}

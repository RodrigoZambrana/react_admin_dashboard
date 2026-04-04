import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';

import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { ApiModule } from './modules/api/api.module';
import { CriticalConfigModule } from './modules/critical-config/critical-config.module';
import { DecisionModule } from './modules/decision/decision.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { InterpretationModule } from './modules/interpretation/interpretation.module';
import { InfrastructureModule } from './modules/infrastructure/infrastructure.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { KnowledgeMetadataModule } from './modules/knowledge-metadata/knowledge-metadata.module';
import { LoggingModule } from './modules/logging/logging.module';
import { MemoryModule } from './modules/memory/memory.module';
import { ParsingModule } from './modules/parsing/parsing.module';
import { PersistenceModule } from './modules/persistence/persistence.module';
import { PromptModule } from './modules/prompt/prompt.module';
import { RuntimeConfigModule } from './modules/runtime-config/runtime-config.module';
import { SecurityModule } from './modules/security/security.module';
import { ToolsModule } from './modules/tools/tools.module';
import { TenantMiddleware } from './modules/persistence/tenant/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '.env.local'),
        join(__dirname, '..', '.env'),
      ],
    }),
    RuntimeConfigModule,
    LoggingModule,
    SecurityModule,
    PersistenceModule,
    InfrastructureModule,
    PromptModule,
    CriticalConfigModule,
    KnowledgeMetadataModule,
    DocumentsModule,
    AiGatewayModule,
    InterpretationModule,
    ParsingModule,
    DecisionModule,
    ToolsModule,
    MemoryModule,
    KnowledgeModule,
    ApiModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { ApiModule } from './modules/api/api.module';
import { DecisionModule } from './modules/decision/decision.module';
import { InterpretationModule } from './modules/interpretation/interpretation.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { LoggingModule } from './modules/logging/logging.module';
import { MemoryModule } from './modules/memory/memory.module';
import { ParsingModule } from './modules/parsing/parsing.module';
import { PersistenceModule } from './modules/persistence/persistence.module';
import { PromptModule } from './modules/prompt/prompt.module';
import { ToolsModule } from './modules/tools/tools.module';
import { TenantMiddleware } from './modules/persistence/tenant/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    LoggingModule,
    PersistenceModule,
    PromptModule,
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

import { Module } from '@nestjs/common';

import { DecisionModule } from '../decision/decision.module';
import { InterpretationModule } from '../interpretation/interpretation.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MemoryModule } from '../memory/memory.module';
import { ParsingModule } from '../parsing/parsing.module';
import { PromptModule } from '../prompt/prompt.module';
import { TemporalModule } from '../temporal/temporal.module';
import { ChatOrchestratorService } from './chat-orchestrator.service';
import { ChatController } from './chat.controller';
import { RuntimeResourcesAdminController } from './runtime-resources-admin.controller';
import { TraceLogService } from './trace-log.service';

@Module({
  imports: [
    MemoryModule,
    KnowledgeModule,
    PromptModule,
    InterpretationModule,
    ParsingModule,
    TemporalModule,
    DecisionModule,
  ],
  controllers: [ChatController, RuntimeResourcesAdminController],
  providers: [TraceLogService, ChatOrchestratorService],
})
export class ApiModule {}

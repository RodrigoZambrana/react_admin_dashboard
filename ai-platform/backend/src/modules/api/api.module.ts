import { Module } from '@nestjs/common';

import { InterpretationModule } from '../interpretation/interpretation.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MemoryModule } from '../memory/memory.module';
import { PromptModule } from '../prompt/prompt.module';
import { ChatOrchestratorService } from './chat-orchestrator.service';
import { ChatController } from './chat.controller';
import { TraceLogService } from './trace-log.service';

@Module({
  imports: [MemoryModule, KnowledgeModule, PromptModule, InterpretationModule],
  controllers: [ChatController],
  providers: [TraceLogService, ChatOrchestratorService],
})
export class ApiModule {}

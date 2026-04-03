import { Module } from '@nestjs/common';

import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { DecisionModule } from '../decision/decision.module';
import { InterpretationModule } from '../interpretation/interpretation.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MemoryModule } from '../memory/memory.module';
import { ParsingModule } from '../parsing/parsing.module';
import { PromptModule } from '../prompt/prompt.module';
import { ToolsModule } from '../tools/tools.module';
import { ChatOrchestratorService } from './chat-orchestrator.service';
import { ChatController } from './chat.controller';
import { TraceLogService } from './trace-log.service';

@Module({
  imports: [
    AiGatewayModule,
    InterpretationModule,
    ParsingModule,
    DecisionModule,
    ToolsModule,
    PromptModule,
    MemoryModule,
    KnowledgeModule,
  ],
  controllers: [ChatController],
  providers: [TraceLogService, ChatOrchestratorService],
})
export class ApiModule {}

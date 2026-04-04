import { Module } from '@nestjs/common';

import { ContinuityModule } from '../continuity/continuity.module';
import { CriticalConfigModule } from '../critical-config/critical-config.module';
import { DecisionModule } from '../decision/decision.module';
import { InterpretationModule } from '../interpretation/interpretation.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { KnowledgeMetadataModule } from '../knowledge-metadata/knowledge-metadata.module';
import { MemoryModule } from '../memory/memory.module';
import { ParsingModule } from '../parsing/parsing.module';
import { PromptModule } from '../prompt/prompt.module';
import { ResponseModule } from '../response/response.module';
import { ResponseFallbackModule } from '../response-fallback/response-fallback.module';
import { TemporalModule } from '../temporal/temporal.module';
import { ToolsModule } from '../tools/tools.module';
import { ChatOrchestratorService } from './chat-orchestrator.service';
import { AdminKnowledgeController } from './admin-knowledge.controller';
import { AdminKnowledgeService } from './admin-knowledge.service';
import { AdminTestCenterController } from './admin-test-center.controller';
import { AdminTestCenterService } from './admin-test-center.service';
import { AsyncChatController } from './async-chat.controller';
import { AsyncTurnIntakeService } from './async-turn-intake.service';
import { AsyncTurnTimingPolicyService } from './async-turn-timing-policy.service';
import { ChatController } from './chat.controller';
import { RuntimeResourcesAdminController } from './runtime-resources-admin.controller';
import { SemanticTurnExecutionService } from './semantic-turn-execution.service';
import { TraceLogService } from './trace-log.service';

@Module({
  imports: [
    MemoryModule,
    KnowledgeModule,
    KnowledgeMetadataModule,
    PromptModule,
    CriticalConfigModule,
    InterpretationModule,
    ParsingModule,
    ContinuityModule,
    TemporalModule,
    DecisionModule,
    ResponseModule,
    ResponseFallbackModule,
    ToolsModule,
  ],
  controllers: [
    ChatController,
    AsyncChatController,
    RuntimeResourcesAdminController,
    AdminKnowledgeController,
    AdminTestCenterController,
  ],
  providers: [
    TraceLogService,
    AsyncTurnTimingPolicyService,
    SemanticTurnExecutionService,
    AsyncTurnIntakeService,
    ChatOrchestratorService,
    AdminKnowledgeService,
    AdminTestCenterService,
  ],
})
export class ApiModule {}

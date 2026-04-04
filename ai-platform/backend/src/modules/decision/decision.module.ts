import { Module } from '@nestjs/common';

import { ConversationSignalsModule } from '../conversation-signals/conversation-signals.module';
import { TenantCapabilitiesModule } from '../tenant-capabilities/tenant-capabilities.module';
import { ToolsModule } from '../tools/tools.module';
import { DecisionService } from './decision.service';

@Module({
  imports: [ConversationSignalsModule, TenantCapabilitiesModule, ToolsModule],
  providers: [DecisionService],
  exports: [DecisionService],
})
export class DecisionModule {}

import { Module } from '@nestjs/common';

import { ConversationSignalsModule } from '../conversation-signals/conversation-signals.module';
import { ConversationContinuityService } from './conversation-continuity.service';

@Module({
  imports: [ConversationSignalsModule],
  providers: [ConversationContinuityService],
  exports: [ConversationContinuityService],
})
export class ContinuityModule {}

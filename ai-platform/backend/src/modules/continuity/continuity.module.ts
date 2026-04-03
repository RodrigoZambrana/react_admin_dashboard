import { Module } from '@nestjs/common';

import { ConversationContinuityService } from './conversation-continuity.service';

@Module({
  providers: [ConversationContinuityService],
  exports: [ConversationContinuityService],
})
export class ContinuityModule {}

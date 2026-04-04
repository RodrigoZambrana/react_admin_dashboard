import { Module } from '@nestjs/common';

import { ConversationSignalResolverService } from './conversation-signal-resolver.service';

@Module({
  providers: [ConversationSignalResolverService],
  exports: [ConversationSignalResolverService],
})
export class ConversationSignalsModule {}

import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { InboxController } from './inbox.controller'
import { InboxService } from './inbox.service'
import { ChannelRegistry } from './registry/channel-registry'
import { EmailChannelAdapter } from './providers/email/email-channel.adapter'
import { InboxEventsService } from './events/inbox-events.service'

@Module({
  imports: [ConfigModule],
  controllers: [InboxController],
  providers: [InboxService, ChannelRegistry, EmailChannelAdapter, InboxEventsService],
})
export class InboxModule {}

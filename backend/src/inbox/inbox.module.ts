import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { InboxController } from './inbox.controller'
import { InboxService } from './inbox.service'
import { ChannelRegistry } from './registry/channel-registry'
import { EmailChannelAdapter } from './providers/email/email-channel.adapter'

@Module({
  imports: [ConfigModule],
  controllers: [InboxController],
  providers: [InboxService, ChannelRegistry, EmailChannelAdapter],
})
export class InboxModule {}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InboxChannelType } from '@prisma/client'
import {
  ChannelAccount,
  ChannelAdapter,
  ChannelAttachmentContent,
  ChannelListMessagesOptions,
  ChannelListMessagesResult,
  ChannelMailbox,
  ChannelMessageBody,
  ChannelMessageIdentifier,
  ChannelSendMessageInput,
  ChannelSendMessageResult,
  ChannelSetFlagsInput,
} from '../../types/channel-adapter'
import { ChannelRegistry } from '../../registry/channel-registry'
import { buildEmailChannelConfig } from './email-channel.config'
import { EmailChannelConfig } from './email-channel.types'

@Injectable()
export class EmailChannelAdapter implements ChannelAdapter, OnModuleInit {
  readonly type = InboxChannelType.EMAIL

  private readonly logger = new Logger(EmailChannelAdapter.name)
  private config: EmailChannelConfig

  constructor(
    private readonly configService: ConfigService,
    private readonly registry: ChannelRegistry,
  ) {
    this.config = buildEmailChannelConfig(this.configService, {
      logger: this.logger,
    })
  }

  onModuleInit() {
    this.registry.register(this)
    this.logger.log('Email channel adapter registered')
  }

  async listMailboxes(_account: ChannelAccount): Promise<ChannelMailbox[]> {
    this.assertConfigured()
    throw new Error('Email channel listMailboxes not implemented yet')
  }

  async listMessages(
    _account: ChannelAccount,
    _options: ChannelListMessagesOptions,
  ): Promise<ChannelListMessagesResult> {
    this.assertConfigured()
    throw new Error('Email channel listMessages not implemented yet')
  }

  async getMessage(
    _account: ChannelAccount,
    _identifier: ChannelMessageIdentifier,
  ): Promise<ChannelMessageBody> {
    this.assertConfigured()
    throw new Error('Email channel getMessage not implemented yet')
  }

  async getAttachmentContent(
    _account: ChannelAccount,
    _identifier: ChannelMessageIdentifier & { attachmentRemoteId: string },
  ): Promise<ChannelAttachmentContent> {
    this.assertConfigured()
    throw new Error('Email channel getAttachmentContent not implemented yet')
  }

  async sendMessage(
    _account: ChannelAccount,
    _payload: ChannelSendMessageInput,
  ): Promise<ChannelSendMessageResult> {
    this.assertConfigured()
    throw new Error('Email channel sendMessage not implemented yet')
  }

  async setFlags(
    _account: ChannelAccount,
    _identifier: ChannelMessageIdentifier,
    _flags: ChannelSetFlagsInput,
  ): Promise<void> {
    this.assertConfigured()
    throw new Error('Email channel setFlags not implemented yet')
  }

  async moveMessage(
    _account: ChannelAccount,
    _identifier: ChannelMessageIdentifier,
    _targetMailbox: string,
  ): Promise<void> {
    this.assertConfigured()
    throw new Error('Email channel moveMessage not implemented yet')
  }

  async markAsSpam(
    _account: ChannelAccount,
    _identifier: ChannelMessageIdentifier,
  ): Promise<void> {
    this.assertConfigured()
    throw new Error('Email channel markAsSpam not implemented yet')
  }

  refreshConfig() {
    this.config = buildEmailChannelConfig(this.configService, {
      logger: this.logger,
    })
  }

  getSanitizedConfig(): Omit<EmailChannelConfig, 'credentials'> & {
    credentials: { user: string }
  } {
    return {
      ...this.config,
      credentials: { user: this.config.credentials.user },
    }
  }

  private assertConfigured() {
    if (!this.config.credentials.user || !this.config.credentials.password) {
      throw new Error(
        'Email channel adapter credentials are not configured. Review INBOX_EMAIL_* environment variables.',
      )
    }
    if (!this.config.imap.host || !this.config.smtp.host) {
      throw new Error(
        'Email channel adapter hosts are not configured. Review INBOX_EMAIL_* environment variables.',
      )
    }
  }
}

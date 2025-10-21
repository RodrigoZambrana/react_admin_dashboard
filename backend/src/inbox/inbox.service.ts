import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  InboxAccount,
  InboxAttachment,
  InboxChannelType,
  InboxMessage,
  InboxMessageDirection,
  InboxMessageEventType,
  Prisma,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ChannelRegistry } from './registry/channel-registry'
import type {
  ChannelAccount,
  ChannelAdapter,
  ChannelListMessagesOptions,
  ChannelMessageAttachment,
  ChannelMessageBody,
  ChannelMessageIdentifier,
  ChannelMessageListItem,
  ChannelSendAttachmentInput,
  ChannelSendMessageInput,
  ChannelSendMessageResult,
  ChannelSetFlagsInput,
} from './types/channel-adapter'
import { EmailChannelAdapter } from './providers/email/email-channel.adapter'

type MessageSummaryDto = {
  id: string
  accountId: string
  remoteId: string
  threadRemoteId?: string | null
  subject?: string | null
  snippet?: string | null
  previewText?: string | null
  from?: { name?: string | null; address?: string | null } | null
  to: string[]
  cc: string[]
  bcc: string[]
  direction: InboxMessageDirection
  folder?: string | null
  isRead: boolean
  isStarred: boolean
  isSpam: boolean
  hasAttachments: boolean
  sentAt?: string | null
  receivedAt?: string | null
  metadata?: Record<string, unknown> | null
}

type MessageAttachmentDto = {
  id: string
  remoteId?: string | null
  fileName?: string | null
  contentType?: string | null
  size?: number | null
  metadata?: Record<string, unknown> | null
}

type MessageDetailDto = MessageSummaryDto & {
  bodyHtml?: string | null
  bodyText?: string | null
  attachments: MessageAttachmentDto[]
  headers?: Record<string, string>
}

type ListMessagesResultDto = {
  items: MessageSummaryDto[]
  nextCursor?: string | null
}

type SyncMailboxResultDto = {
  mailbox: string
  fetched: number
  nextCursor?: string | null
}

const toJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  value === undefined || value === null
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue)

const toJsonUpdate = (
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =>
  value === undefined ? undefined : toJsonInput(value)

@Injectable()
export class InboxService implements OnModuleInit {
  private readonly logger = new Logger(InboxService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly registry: ChannelRegistry,
    private readonly emailAdapter: EmailChannelAdapter,
  ) {}

  async onModuleInit() {
    await this.ensureConfiguredEmailAccount()
  }

  async listAccounts(options: { includeInactive?: boolean } = {}) {
    const where: Prisma.InboxAccountWhereInput | undefined = options.includeInactive
      ? undefined
      : { active: true }

    return this.prisma.inboxAccount.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })
  }

  async listMailboxes(accountId: string) {
    const account = await this.getAccountOrThrow(accountId)
    const adapter = this.resolveAdapter(account)
    const channelAccount = this.mapAccount(account)
    return adapter.listMailboxes(channelAccount)
  }

  async listMessages(
    accountId: string,
    options: ChannelListMessagesOptions,
  ): Promise<ListMessagesResultDto> {
    this.assertMailboxOption(options)
    const account = await this.getAccountOrThrow(accountId)
    const adapter = this.resolveAdapter(account)
    const channelAccount = this.mapAccount(account)
    const response = await adapter.listMessages(channelAccount, options)
    const persisted = await this.persistMessageList(
      account,
      options.mailbox,
      response.messages,
      response.nextCursor ?? null,
    )
    return {
      items: persisted.map((record) => this.serializeMessage(record)),
      nextCursor: response.nextCursor ?? null,
    }
  }

  async getMessage(
    accountId: string,
    identifier: ChannelMessageIdentifier,
  ): Promise<MessageDetailDto> {
    const account = await this.getAccountOrThrow(accountId)
    const adapter = this.resolveAdapter(account)
    const channelAccount = this.mapAccount(account)
    const body = await adapter.getMessage(channelAccount, identifier)

    const detail = await this.prisma.$transaction(async (tx) => {
      const messageRecord = await tx.inboxMessage.upsert({
        where: {
          accountId_channel_remoteId: {
            accountId: account.id,
            channel: account.channel,
            remoteId: identifier.remoteId,
          },
        },
        update: this.buildMessageUpdateFromBody(body),
        create: this.buildMessageCreateFromBody(account, body),
      })

      await tx.inboxAttachment.deleteMany({
        where: { messageId: messageRecord.id },
      })

      const attachmentRecords: InboxAttachment[] = []
      for (const attachment of body.attachments || []) {
        const created = await tx.inboxAttachment.create({
          data: {
            messageId: messageRecord.id,
            remoteId: attachment.remoteId ?? null,
            fileName: attachment.fileName ?? null,
            contentType: attachment.contentType ?? null,
            size: attachment.size ?? null,
            metadata: toJsonInput(this.buildAttachmentMetadata(attachment)),
          },
        })
        attachmentRecords.push(created)
      }

      await this.recordEvent(tx, messageRecord.id, InboxMessageEventType.FETCHED, {
        attachmentCount: attachmentRecords.length,
      })

      return this.serializeMessageDetail(messageRecord, body, attachmentRecords)
    })

    return detail
  }

  async sendMessage(accountId: string, payload: SendMessagePayloadDto) {
    const account = await this.getAccountOrThrow(accountId)
    const adapter = this.resolveAdapter(account)
    const channelAccount = this.mapAccount(account)

    const attachments = (payload.attachments || []).map((attachment) =>
      this.decodeAttachmentInput(attachment),
    )

    const messageInput: ChannelSendMessageInput = {
      subject: payload.subject,
      body: {
        html: payload.bodyHtml ?? undefined,
        text: payload.bodyText ?? undefined,
      },
      to: payload.to,
      cc: payload.cc ?? [],
      bcc: payload.bcc ?? [],
      replyTo: payload.replyTo ?? [],
      replyToRemoteId: payload.replyToRemoteId,
      attachments,
      metadata: payload.metadata ?? undefined,
    }

    const result = await adapter.sendMessage(channelAccount, messageInput)

    const summary = await this.prisma.$transaction(async (tx) => {
      const messageRecord = await tx.inboxMessage.upsert({
        where: {
          accountId_channel_remoteId: {
            accountId: account.id,
            channel: account.channel,
            remoteId: result.remoteId,
          },
        },
        update: this.buildMessageUpdateFromSend(payload, result),
        create: this.buildMessageCreateFromSend(account, payload, result),
      })

      await this.recordEvent(tx, messageRecord.id, InboxMessageEventType.SENT, {
        accepted: result.accepted,
        rejected: result.rejected,
      })

      return this.serializeMessage(messageRecord)
    })

    return summary
  }

  async setFlags(
    accountId: string,
    identifier: ChannelMessageIdentifier,
    flags: ChannelSetFlagsInput,
  ): Promise<MessageSummaryDto> {
    const account = await this.getAccountOrThrow(accountId)
    const adapter = this.resolveAdapter(account)
    const channelAccount = this.mapAccount(account)

    if (adapter.setFlags) {
      await adapter.setFlags(channelAccount, identifier, flags)
    } else {
      this.logger.warn(
        `Channel adapter ${account.channel} does not implement setFlags. Persisting flags locally only.`,
      )
    }

    const summary = await this.prisma.$transaction(async (tx) => {
      const messageRecord = await tx.inboxMessage.upsert({
        where: {
          accountId_channel_remoteId: {
            accountId: account.id,
            channel: account.channel,
            remoteId: identifier.remoteId,
          },
        },
        update: this.buildFlagUpdate(flags),
        create: this.buildMinimalMessage(account, identifier, flags),
      })

      await this.recordEvent(tx, messageRecord.id, InboxMessageEventType.FLAG_UPDATED, {
        flags,
      })

      return this.serializeMessage(messageRecord)
    })

    return summary
  }

  async moveMessage(
    accountId: string,
    identifier: ChannelMessageIdentifier,
    targetMailbox: string,
  ): Promise<MessageSummaryDto> {
    const account = await this.getAccountOrThrow(accountId)
    const adapter = this.resolveAdapter(account)
    const channelAccount = this.mapAccount(account)

    if (adapter.moveMessage) {
      await adapter.moveMessage(channelAccount, identifier, targetMailbox)
    } else {
      this.logger.warn(
        `Channel adapter ${account.channel} does not implement moveMessage. Persisting move locally only.`,
      )
    }

    const summary = await this.prisma.$transaction(async (tx) => {
      const messageRecord = await tx.inboxMessage.upsert({
        where: {
          accountId_channel_remoteId: {
            accountId: account.id,
            channel: account.channel,
            remoteId: identifier.remoteId,
          },
        },
        update: {
          folder: targetMailbox,
          isSpam: targetMailbox.toLowerCase().includes('spam') ? true : undefined,
        },
        create: this.buildMinimalMessage(account, identifier, undefined, targetMailbox),
      })

      await this.recordEvent(tx, messageRecord.id, InboxMessageEventType.MOVED, {
        targetMailbox,
      })

      return this.serializeMessage(messageRecord)
    })

    return summary
  }

  async markAsSpam(
    accountId: string,
    identifier: ChannelMessageIdentifier,
  ): Promise<MessageSummaryDto> {
    const account = await this.getAccountOrThrow(accountId)
    const adapter = this.resolveAdapter(account)
    const channelAccount = this.mapAccount(account)

    let movedFolder: string | undefined
    if (adapter.markAsSpam) {
      await adapter.markAsSpam(channelAccount, identifier)
      movedFolder = 'Spam'
    } else if (adapter.moveMessage) {
      await adapter.moveMessage(channelAccount, identifier, 'Junk')
      movedFolder = 'Junk'
    } else {
      this.logger.warn(
        `Channel adapter ${account.channel} does not implement spam handling. Persisting spam flag locally only.`,
      )
    }

    const targetFolder = movedFolder ?? 'Spam'

    const summary = await this.prisma.$transaction(async (tx) => {
      const messageRecord = await tx.inboxMessage.upsert({
        where: {
          accountId_channel_remoteId: {
            accountId: account.id,
            channel: account.channel,
            remoteId: identifier.remoteId,
          },
        },
        update: {
          isSpam: true,
          folder: targetFolder,
        },
        create: this.buildMinimalMessage(account, identifier, { spam: true }, targetFolder),
      })

      await this.recordEvent(tx, messageRecord.id, InboxMessageEventType.FLAG_UPDATED, {
        spam: true,
      })

      return this.serializeMessage(messageRecord)
    })

    return summary
  }

  async synchronizeAccount(
    accountId: string,
    options: {
      mailboxes?: string[]
      limit?: number
      cursor?: string | null
      since?: Date
    } = {},
  ) {
    const mailboxes =
      options.mailboxes && options.mailboxes.length > 0 ? options.mailboxes : ['INBOX']

    const results: SyncMailboxResultDto[] = []

    for (const mailbox of mailboxes) {
      const { items, nextCursor } = await this.listMessages(accountId, {
        mailbox,
        limit: options.limit,
        cursor: options.cursor ?? undefined,
        since: options.since,
      })
      results.push({
        mailbox,
        fetched: items.length,
        nextCursor: nextCursor ?? null,
      })
    }

    return {
      accountId,
      mailboxes: results,
    }
  }

  private assertMailboxOption(options: ChannelListMessagesOptions) {
    if (!options.mailbox || !options.mailbox.trim()) {
      throw new BadRequestException('Mailbox is required to list messages.')
    }
  }

  private resolveAdapter(account: InboxAccount): ChannelAdapter {
    return this.registry.getAdapter(account.channel)
  }

  private mapAccount(account: InboxAccount): ChannelAccount {
    return {
      id: account.id,
      address: account.address,
      displayName: account.displayName,
      metadata: account.metadata as Record<string, unknown> | null,
    }
  }

  private async getAccountOrThrow(accountId: string) {
    const account = await this.prisma.inboxAccount.findUnique({
      where: { id: accountId },
    })
    if (!account) {
      throw new NotFoundException(`Inbox account ${accountId} was not found.`)
    }
    return account
  }

  private async persistMessageList(
    account: InboxAccount,
    mailbox: string,
    messages: ChannelMessageListItem[],
    nextCursor: string | null,
  ): Promise<InboxMessage[]> {
    if (messages.length === 0) {
      await this.prisma.inboxSyncState.upsert({
        where: {
          accountId_channel_folder: {
            accountId: account.id,
            channel: account.channel,
            folder: mailbox,
          },
        },
        update: {
          lastSyncAt: new Date(),
          metadata: toJsonInput(nextCursor ? { nextCursor } : null),
        },
        create: {
          accountId: account.id,
          channel: account.channel,
          folder: mailbox,
          lastRemoteId: null,
          lastSyncAt: new Date(),
          metadata: toJsonInput(nextCursor ? { nextCursor } : null),
        },
      })
      return []
    }

    return this.prisma.$transaction(async (tx) => {
      const persisted: InboxMessage[] = []

      for (const message of messages) {
        const record = await tx.inboxMessage.upsert({
          where: {
            accountId_channel_remoteId: {
              accountId: account.id,
              channel: account.channel,
              remoteId: message.remoteId,
            },
          },
          update: this.buildMessageUpdateFromListItem(message, mailbox),
          create: this.buildMessageCreateFromListItem(account, message, mailbox),
        })
        persisted.push(record)
      }

      const lastRemoteId = messages[messages.length - 1]?.remoteId ?? null

      await tx.inboxSyncState.upsert({
        where: {
          accountId_channel_folder: {
            accountId: account.id,
            channel: account.channel,
            folder: mailbox,
          },
        },
        update: {
          lastRemoteId,
          lastSyncAt: new Date(),
          metadata: toJsonInput(nextCursor ? { nextCursor } : null),
        },
        create: {
          accountId: account.id,
          channel: account.channel,
          folder: mailbox,
          lastRemoteId,
          lastSyncAt: new Date(),
          metadata: toJsonInput(nextCursor ? { nextCursor } : null),
        },
      })

      return persisted
    })
  }

  private serializeMessage(record: InboxMessage): MessageSummaryDto {
    return {
      id: record.id,
      accountId: record.accountId,
      remoteId: record.remoteId,
      threadRemoteId: record.threadRemoteId,
      subject: record.subject,
      snippet: record.snippet,
      previewText: record.previewText,
      from:
        record.fromAddress || record.fromName
          ? { address: record.fromAddress, name: record.fromName }
          : null,
      to: record.toAddresses,
      cc: record.ccAddresses,
      bcc: record.bccAddresses,
      direction: record.direction,
      folder: record.folder,
      isRead: record.isRead,
      isStarred: record.isStarred,
      isSpam: record.isSpam,
      hasAttachments: record.hasAttachments,
      sentAt: record.sentAt ? record.sentAt.toISOString() : null,
      receivedAt: record.receivedAt ? record.receivedAt.toISOString() : null,
      metadata: (record.metadata as Record<string, unknown> | null) ?? null,
    }
  }

  private serializeMessageDetail(
    record: InboxMessage,
    body: ChannelMessageBody,
    attachments: InboxAttachment[],
  ): MessageDetailDto {
    const summary = this.serializeMessage(record)
    return {
      ...summary,
      bodyHtml: body.bodyHtml ?? null,
      bodyText: body.bodyText ?? null,
      headers: body.headers ?? undefined,
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        remoteId: attachment.remoteId,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        size: attachment.size,
        metadata: (attachment.metadata as Record<string, unknown> | null) ?? null,
      })),
    }
  }

  private buildMessageUpdateFromListItem(
    message: ChannelMessageListItem,
    mailbox: string,
  ): Prisma.InboxMessageUpdateInput {
    return {
      threadRemoteId: message.threadRemoteId ?? null,
      subject: message.subject ?? null,
      snippet: message.snippet ?? null,
      previewText: message.previewText ?? null,
      fromAddress: message.from?.address ?? null,
      fromName: message.from?.name ?? null,
      toAddresses: this.normalizeAddressArray(message.to),
      ccAddresses: this.normalizeAddressArray(message.cc),
      bccAddresses: this.normalizeAddressArray(message.bcc),
      direction: message.direction,
      folder: message.folder ?? mailbox,
      isRead: message.isRead ?? false,
      isStarred: message.isStarred ?? false,
      isSpam: message.isSpam ?? false,
      hasAttachments: message.hasAttachments ?? false,
      sentAt: message.sentAt ?? null,
      receivedAt: message.receivedAt ?? null,
      metadata: toJsonUpdate(message.metadata),
    }
  }

  private buildMessageCreateFromListItem(
    account: InboxAccount,
    message: ChannelMessageListItem,
    mailbox: string,
  ): Prisma.InboxMessageCreateInput {
    return {
      account: { connect: { id: account.id } },
      channel: account.channel,
      remoteId: message.remoteId,
      threadRemoteId: message.threadRemoteId ?? null,
      subject: message.subject ?? null,
      snippet: message.snippet ?? null,
      previewText: message.previewText ?? null,
      fromAddress: message.from?.address ?? null,
      fromName: message.from?.name ?? null,
      toAddresses: this.normalizeAddressArray(message.to),
      ccAddresses: this.normalizeAddressArray(message.cc),
      bccAddresses: this.normalizeAddressArray(message.bcc),
      replyToAddresses: [],
      direction: message.direction,
      folder: message.folder ?? mailbox,
      isRead: message.isRead ?? false,
      isStarred: message.isStarred ?? false,
      isSpam: message.isSpam ?? false,
      hasAttachments: message.hasAttachments ?? false,
      sentAt: message.sentAt ?? null,
      receivedAt: message.receivedAt ?? null,
      metadata: toJsonInput(message.metadata ?? null),
    }
  }

  private buildMessageUpdateFromBody(
    body: ChannelMessageBody,
  ): Prisma.InboxMessageUpdateInput {
    return {
      threadRemoteId: body.threadRemoteId ?? null,
      subject: body.subject ?? null,
      hasAttachments: (body.attachments?.length ?? 0) > 0,
      snippet: this.extractSnippet(body) ?? null,
      previewText: this.extractSnippet(body) ?? null,
      metadata: toJsonUpdate(body.metadata),
    }
  }

  private buildMessageCreateFromBody(
    account: InboxAccount,
    body: ChannelMessageBody,
  ): Prisma.InboxMessageCreateInput {
    return {
      account: { connect: { id: account.id } },
      channel: account.channel,
      remoteId: body.remoteId,
      threadRemoteId: body.threadRemoteId ?? null,
      subject: body.subject ?? null,
      snippet: this.extractSnippet(body) ?? null,
      previewText: this.extractSnippet(body) ?? null,
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      replyToAddresses: [],
      direction: InboxMessageDirection.INBOUND,
      folder: null,
      isRead: false,
      isStarred: false,
      isSpam: false,
      hasAttachments: (body.attachments?.length ?? 0) > 0,
      metadata: toJsonInput(body.metadata ?? null),
    }
  }

  private buildMessageUpdateFromSend(
    payload: SendMessagePayloadDto,
    result: ChannelSendMessageResult,
  ): Prisma.InboxMessageUpdateInput {
    return {
      threadRemoteId: result.threadRemoteId ?? null,
      subject: payload.subject ?? null,
      snippet: this.buildOutgoingSnippet(payload) ?? null,
      previewText: this.buildOutgoingSnippet(payload) ?? null,
      fromAddress: payload.fromAddress ?? null,
      fromName: payload.fromName ?? null,
      toAddresses: payload.to,
      ccAddresses: payload.cc ?? [],
      bccAddresses: payload.bcc ?? [],
      replyToAddresses: payload.replyTo ?? [],
      direction: InboxMessageDirection.OUTBOUND,
      folder: 'Sent',
      isRead: true,
      isStarred: false,
      isSpam: false,
      hasAttachments: (payload.attachments?.length ?? 0) > 0,
      sentAt: new Date(),
      metadata: toJsonUpdate(result.metadata),
    }
  }

  private buildMessageCreateFromSend(
    account: InboxAccount,
    payload: SendMessagePayloadDto,
    result: ChannelSendMessageResult,
  ): Prisma.InboxMessageCreateInput {
    return {
      account: { connect: { id: account.id } },
      channel: account.channel,
      remoteId: result.remoteId,
      threadRemoteId: result.threadRemoteId ?? null,
      subject: payload.subject ?? null,
      snippet: this.buildOutgoingSnippet(payload) ?? null,
      previewText: this.buildOutgoingSnippet(payload) ?? null,
      toAddresses: payload.to,
      ccAddresses: payload.cc ?? [],
      bccAddresses: payload.bcc ?? [],
      replyToAddresses: payload.replyTo ?? [],
      direction: InboxMessageDirection.OUTBOUND,
      folder: 'Sent',
      isRead: true,
      isStarred: false,
      isSpam: false,
      hasAttachments: (payload.attachments?.length ?? 0) > 0,
      sentAt: new Date(),
      metadata: toJsonInput(result.metadata ?? null),
      fromAddress: payload.fromAddress ?? null,
      fromName: payload.fromName ?? null,
    }
  }

  private buildFlagUpdate(
    flags: ChannelSetFlagsInput,
  ): Prisma.InboxMessageUpdateInput {
    return {
      isRead: flags.seen ?? undefined,
      isStarred: flags.starred ?? undefined,
      isSpam: flags.spam ?? undefined,
    }
  }

  private buildMinimalMessage(
    account: InboxAccount,
    identifier: ChannelMessageIdentifier,
    flags?: ChannelSetFlagsInput,
    folder?: string,
  ): Prisma.InboxMessageCreateInput {
    return {
      account: { connect: { id: account.id } },
      channel: account.channel,
      remoteId: identifier.remoteId,
      threadRemoteId: identifier.threadRemoteId ?? null,
      subject: null,
      snippet: null,
      previewText: null,
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      replyToAddresses: [],
      direction: InboxMessageDirection.INBOUND,
      folder: folder ?? null,
      isRead: flags?.seen ?? false,
      isStarred: flags?.starred ?? false,
      isSpam: flags?.spam ?? false,
      hasAttachments: false,
      metadata: toJsonInput(null),
    }
  }

  private normalizeAddressArray(
    addresses?: { address?: string | null }[] | null,
  ): string[] {
    if (!Array.isArray(addresses)) {
      return []
    }
    return addresses
      .map((entry) => (entry?.address || '').trim())
      .filter((value) => value.length > 0)
  }

  private extractSnippet(body: ChannelMessageBody): string | undefined {
    const textCandidate = body.bodyText || (body.bodyHtml ? this.stripHtml(body.bodyHtml) : '')
    const normalized = textCandidate?.trim() ?? ''
    if (!normalized) {
      return undefined
    }
    return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized
  }

  private buildOutgoingSnippet(payload: SendMessagePayloadDto): string | undefined {
    const textCandidate =
      payload.bodyText ||
      (payload.bodyHtml ? this.stripHtml(payload.bodyHtml) : '')
    const normalized = textCandidate.trim()
    if (!normalized) {
      return undefined
    }
    return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized
  }

  private stripHtml(content: string): string {
    return content.replace(/<\/?[^>]+(>|$)/g, ' ')
  }

  private buildAttachmentMetadata(attachment: ChannelMessageAttachment) {
    const metadata: Record<string, unknown> = {}
    if (attachment.inline !== undefined) {
      metadata.inline = attachment.inline
    }
    if (attachment.contentId) {
      metadata.contentId = attachment.contentId
    }
    return Object.keys(metadata).length > 0 ? metadata : null
  }

  private decodeAttachmentInput(
    attachment: SendMessageAttachmentPayload,
  ): ChannelSendAttachmentInput {
    const content = attachment.content?.trim()
    if (!content) {
      throw new BadRequestException('Attachment content is required when provided.')
    }

    const normalized = this.normalizeAttachmentContent(content)
    return {
      fileName: attachment.fileName,
      contentType: attachment.contentType ?? normalized.contentType,
      content: Buffer.from(normalized.data, normalized.encoding),
      encoding: normalized.encoding,
    }
  }

  private normalizeAttachmentContent(content: string) {
    if (content.startsWith('data:')) {
      const [, meta, payload] = content.match(/^data:(.*?);base64,(.*)$/) || []
      if (payload) {
        return {
          data: payload,
          encoding: 'base64' as const,
          contentType: meta?.split(';')[0],
        }
      }
    }
    return { data: content, encoding: 'base64' as const, contentType: undefined }
  }

  private async recordEvent(
    tx: Prisma.TransactionClient,
    messageId: string,
    type: InboxMessageEventType,
    payload?: Record<string, unknown>,
  ) {
    await tx.inboxMessageEvent.create({
      data: {
        messageId,
        type,
        payload: toJsonInput(payload ?? null),
      },
    })
  }

  private async ensureConfiguredEmailAccount() {
    this.emailAdapter.refreshConfig()
    const sanitized = this.emailAdapter.getSanitizedConfig()
    const emailAddress =
      sanitized.defaults.fromAddress ||
      this.configService.get<string>('INBOX_EMAIL_USER')

    if (!emailAddress) {
      this.logger.warn(
        'No email inbox account configured. Set INBOX_EMAIL_* environment variables to enable the inbox module.',
      )
      return
    }

    const normalizedAddress = emailAddress.trim().toLowerCase()
    const displayName =
      this.configService.get<string>('INBOX_EMAIL_DEFAULT_NAME') ||
      this.configService.get<string>('INBOX_EMAIL_DISPLAY_NAME') ||
      sanitized.defaults.fromName ||
      normalizedAddress

    const metadata = {
      defaults: sanitized.defaults,
      imap: sanitized.imap,
      smtp: sanitized.smtp,
      limits: sanitized.limits,
      polling: sanitized.polling,
      lastConfigSync: new Date().toISOString(),
    }

    await this.prisma.inboxAccount.upsert({
      where: {
        channel_address: {
          channel: InboxChannelType.EMAIL,
          address: normalizedAddress,
        },
      },
      update: {
        displayName,
        metadata: toJsonInput(metadata),
        active: true,
      },
      create: {
        channel: InboxChannelType.EMAIL,
        address: normalizedAddress,
        displayName,
        metadata: toJsonInput(metadata),
        active: true,
      },
    })
  }
}

type SendMessageAttachmentPayload = {
  fileName: string
  contentType?: string
  content: string
}

type SendMessagePayloadDto = {
  subject: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  replyTo?: string[]
  replyToRemoteId?: string
  bodyHtml?: string
  bodyText?: string
  attachments?: SendMessageAttachmentPayload[]
  metadata?: Record<string, unknown>
  fromAddress?: string
  fromName?: string
}

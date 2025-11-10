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
import { deriveMessageUid, hashMessageBody, normalizeFolder } from './common/message-identity'
import { resolveQueueSlug, type QueueResolution, type QueueRuleConfig } from './common/queue-classifier'
import { InboxEventsService, type InboxStreamFilter } from './events/inbox-events.service'
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
  provider: string
  messageUid: string
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
  queueId?: string | null
  queueSlug?: string | null
  queueName?: string | null
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
  private readonly queueRuleConfig: QueueRuleConfig
  private readonly queueCache = new Map<string, { id: string; name: string; slug: string }>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly registry: ChannelRegistry,
    private readonly emailAdapter: EmailChannelAdapter,
    private readonly events: InboxEventsService,
  ) {
    this.queueRuleConfig = this.buildQueueConfig()
  }

  async onModuleInit() {
    await this.ensureConfiguredEmailAccount()
  }

  streamMessageEvents(filters: InboxStreamFilter = {}) {
    return this.events.streamEvents(filters)
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
    const summaries = persisted.map((record) => {
      const summary = this.serializeMessage(record)
      const isNew = record.createdAt.getTime() === record.updatedAt.getTime()
      if (isNew) {
        this.emitBroadcast('message.created', summary)
      }
      return summary
    })
    return {
      items: summaries,
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

    const provider = this.resolveProvider(account)
    const metadata = this.extractBodyMetadata(body)

    const detail = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.inboxMessage.findUnique({
        where: {
          accountId_channel_remoteId: {
            accountId: account.id,
            channel: account.channel,
            remoteId: identifier.remoteId,
          },
        },
        include: { queue: true },
      })

      const folder = existing?.folder ?? this.resolveFolder(
        this.extractMetadataString(metadata, 'folder') ??
          this.extractMetadataString(metadata, 'mailbox') ??
          undefined,
      )
      const queueResolution: QueueResolution =
        existing?.queue
          ? { slug: existing.queue.slug, matchedRule: 'persisted' }
          : resolveQueueSlug(
              {
                headers: this.extractHeaderMap(metadata),
                subject: body.subject,
                folder,
              },
              this.queueRuleConfig,
            )
      const queueId = existing?.queueId ?? (await this.ensureQueue(tx, queueResolution))
      const messageUid = deriveMessageUid({
        provider,
        folder,
        messageId: this.extractMetadataString(metadata, 'messageId'),
        gmailId: this.extractMetadataString(metadata, 'gmailId'),
        remoteId: body.remoteId,
        headers: this.extractHeaderMap(metadata),
        bodyHtml: body.bodyHtml,
        bodyText: body.bodyText,
      })
      const bodyHash = hashMessageBody({
        bodyHtml: body.bodyHtml ?? null,
        bodyText: body.bodyText ?? null,
      })

      const messageRecord = await tx.inboxMessage.upsert({
        where: {
          messageUid_provider_folder: {
            messageUid,
            provider,
            folder,
          },
        },
        update: this.buildMessageUpdateFromBody(
          body,
          folder,
          provider,
          queueId,
          bodyHash,
          metadata,
          queueResolution,
        ),
        create: this.buildMessageCreateFromBody(
          account,
          body,
          folder,
          provider,
          messageUid,
          queueId,
          bodyHash,
          metadata,
          queueResolution,
        ),
        include: { queue: true },
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
        queue: queueResolution.slug,
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

    const normalizedFromAddress = (payload.fromAddress ?? '').trim()
    const normalizedFromName = (payload.fromName ?? '').trim()

    const messageInput: ChannelSendMessageInput = {
      subject: payload.subject,
      from:
        normalizedFromAddress || normalizedFromName
          ? {
              address: normalizedFromAddress,
              name: normalizedFromName || undefined,
            }
          : undefined,
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

    const provider = this.resolveProvider(account)
    const folder = this.resolveFolder('Sent')
    const baseMetadata =
      this.mergeMetadata(
        payload.metadata ?? undefined,
        result.metadata ?? undefined,
      ) ?? {}
    const explicitQueueSlug =
      payload.queueSlug ??
      (typeof baseMetadata.queue === 'string' ? String(baseMetadata.queue) : undefined)
    const queueResolution: QueueResolution =
      explicitQueueSlug
        ? {
            slug: explicitQueueSlug.toLowerCase(),
            matchedRule: payload.queueSlug ? 'payload.slug' : 'metadata.queue',
          }
        : resolveQueueSlug(
            {
              headers: this.extractHeaderMap(baseMetadata),
              to: payload.to.map((address) => ({ address })),
              cc: (payload.cc ?? []).map((address) => ({ address })),
              bcc: (payload.bcc ?? []).map((address) => ({ address })),
              subject: payload.subject,
              folder,
            },
            this.queueRuleConfig,
          )
    const bodyHash = hashMessageBody({
      bodyHtml: payload.bodyHtml ?? null,
      bodyText: payload.bodyText ?? null,
    })
    const messageUid = deriveMessageUid({
      provider,
      folder,
      messageId: this.extractMetadataString(baseMetadata, 'messageId'),
      gmailId: this.extractMetadataString(baseMetadata, 'gmailId'),
      remoteId: result.remoteId,
      headers: this.extractHeaderMap(baseMetadata),
      bodyHtml: payload.bodyHtml,
      bodyText: payload.bodyText,
    })

    const summary = await this.prisma.$transaction(async (tx) => {
      let effectiveQueueResolution = queueResolution
      let queueId: string
      if (payload.queueId) {
        const existingQueue = await tx.inboxQueue.findUnique({
          where: { id: payload.queueId },
        })
        if (existingQueue) {
          queueId = existingQueue.id
          effectiveQueueResolution = {
            slug: existingQueue.slug,
            matchedRule: 'payload.id',
          }
        } else {
          queueId = await this.ensureQueue(tx, queueResolution)
        }
      } else {
        queueId = await this.ensureQueue(tx, queueResolution)
      }
      const messageRecord = await tx.inboxMessage.upsert({
        where: {
          messageUid_provider_folder: {
            messageUid,
            provider,
            folder,
          },
        },
        update: this.buildMessageUpdateFromSend(
          payload,
          result,
          folder,
          provider,
          queueId,
          bodyHash,
          baseMetadata,
          effectiveQueueResolution,
        ),
        create: this.buildMessageCreateFromSend(
          account,
          payload,
          result,
          folder,
          provider,
          messageUid,
          queueId,
          bodyHash,
          baseMetadata,
          effectiveQueueResolution,
        ),
        include: { queue: true },
      })

      await this.recordEvent(tx, messageRecord.id, InboxMessageEventType.SENT, {
        accepted: result.accepted,
        rejected: result.rejected,
        queue: effectiveQueueResolution.slug,
      })

      return this.serializeMessage(messageRecord)
    })

    this.emitBroadcast('message.sent', summary)

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
      const existing = await tx.inboxMessage.findUnique({
        where: {
          accountId_channel_remoteId: {
            accountId: account.id,
            channel: account.channel,
            remoteId: identifier.remoteId,
          },
        },
        include: { queue: true },
      })

      const provider = this.resolveProvider(account)
      const folder = existing?.folder ?? this.resolveFolder(undefined)
      const queueResolution: QueueResolution =
        existing?.queue
          ? { slug: existing.queue.slug, matchedRule: 'persisted' }
          : { slug: this.queueRuleConfig.defaultQueue, matchedRule: 'default' }
      const queueId = existing?.queueId ?? (await this.ensureQueue(tx, queueResolution))
      const messageUid =
        existing?.messageUid ??
        deriveMessageUid({
          provider,
          folder,
          remoteId: identifier.remoteId,
        })

      const metadataSource =
        (existing?.metadata as Record<string, unknown> | null) ?? undefined
      const messageRecord = await tx.inboxMessage.upsert({
        where: {
          messageUid_provider_folder: {
            messageUid,
            provider,
            folder,
          },
        },
        update: {
          ...this.buildFlagUpdate(flags, metadataSource, queueResolution),
          queue: { connect: { id: queueId } },
        },
        create: this.buildMinimalMessage(
          account,
          identifier,
          flags,
          folder,
          provider,
          messageUid,
          queueId,
          queueResolution,
        ),
        include: { queue: true },
      })

      await this.recordEvent(tx, messageRecord.id, InboxMessageEventType.FLAG_UPDATED, {
        flags,
        queue: queueResolution.slug,
      })

      return this.serializeMessage(messageRecord)
    })

    this.emitBroadcast('message.flags.updated', summary)

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
      const existing = await tx.inboxMessage.findUnique({
        where: {
          accountId_channel_remoteId: {
            accountId: account.id,
            channel: account.channel,
            remoteId: identifier.remoteId,
          },
        },
        include: { queue: true },
      })

      const provider = this.resolveProvider(account)
      const folder = this.resolveFolder(targetMailbox)
      const queueResolution: QueueResolution =
        existing?.queue
          ? { slug: existing.queue.slug, matchedRule: 'persisted' }
          : { slug: this.queueRuleConfig.defaultQueue, matchedRule: 'default' }
      const queueId = existing?.queueId ?? (await this.ensureQueue(tx, queueResolution))
      const messageUid =
        existing?.messageUid ??
        deriveMessageUid({
          provider,
          folder,
          remoteId: identifier.remoteId,
        })
      const isSpamTarget = folder.toLowerCase().includes('spam') || folder.toLowerCase().includes('junk')
      const metadataSource =
        (existing?.metadata as Record<string, unknown> | null) ?? undefined
      const updatedMetadata = this.mergeMetadata(metadataSource, {
        queue: queueResolution.slug,
        queueRule: queueResolution.matchedRule,
      })

      const messageRecord = await tx.inboxMessage.upsert({
        where: {
          messageUid_provider_folder: {
            messageUid,
            provider,
            folder,
          },
        },
        update: {
          provider,
          folder,
          isSpam: isSpamTarget,
          queue: { connect: { id: queueId } },
          metadata: updatedMetadata ? toJsonUpdate(updatedMetadata) : undefined,
        },
        create: this.buildMinimalMessage(
          account,
          identifier,
          { spam: isSpamTarget },
          folder,
          provider,
          messageUid,
          queueId,
          queueResolution,
        ),
        include: { queue: true },
      })

      await this.recordEvent(tx, messageRecord.id, InboxMessageEventType.MOVED, {
        targetMailbox,
        queue: queueResolution.slug,
      })

      return this.serializeMessage(messageRecord)
    })

    this.emitBroadcast('message.moved', summary)

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
      const existing = await tx.inboxMessage.findUnique({
        where: {
          accountId_channel_remoteId: {
            accountId: account.id,
            channel: account.channel,
            remoteId: identifier.remoteId,
          },
        },
        include: { queue: true },
      })

      const provider = this.resolveProvider(account)
      const folder = this.resolveFolder(targetFolder)
      const queueResolution: QueueResolution =
        existing?.queue
          ? { slug: existing.queue.slug, matchedRule: 'persisted' }
          : { slug: this.queueRuleConfig.defaultQueue, matchedRule: 'default' }
      const queueId = existing?.queueId ?? (await this.ensureQueue(tx, queueResolution))
      const messageUid =
        existing?.messageUid ??
        deriveMessageUid({
          provider,
          folder,
          remoteId: identifier.remoteId,
        })
      const metadataSource =
        (existing?.metadata as Record<string, unknown> | null) ?? undefined
      const updatedMetadata = this.mergeMetadata(metadataSource, {
        queue: queueResolution.slug,
        queueRule: queueResolution.matchedRule,
      })

      const messageRecord = await tx.inboxMessage.upsert({
        where: {
          messageUid_provider_folder: {
            messageUid,
            provider,
            folder,
          },
        },
        update: {
          provider,
          folder,
          isSpam: true,
          queue: { connect: { id: queueId } },
          metadata: updatedMetadata ? toJsonUpdate(updatedMetadata) : undefined,
        },
        create: this.buildMinimalMessage(
          account,
          identifier,
          { spam: true },
          folder,
          provider,
          messageUid,
          queueId,
          queueResolution,
        ),
        include: { queue: true },
      })

      await this.recordEvent(tx, messageRecord.id, InboxMessageEventType.FLAG_UPDATED, {
        spam: true,
        queue: queueResolution.slug,
      })

      return this.serializeMessage(messageRecord)
    })

    this.emitBroadcast('message.flags.updated', summary)

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
      const provider = this.resolveProvider(account)

      for (const message of messages) {
        const folder = this.resolveFolder(message.folder ?? mailbox)
        const metadata = this.extractListMetadata(message)
        const messageUid = deriveMessageUid({
          provider,
          folder,
          messageId: this.extractMetadataString(metadata, 'messageId'),
          gmailId: this.extractMetadataString(metadata, 'gmailId'),
          remoteId: message.remoteId,
          headers: this.extractHeaderMap(metadata),
          bodyHtml: this.extractMetadataString(metadata, 'bodyHtml'),
          bodyText: this.extractMetadataString(metadata, 'bodyText'),
        })
        const bodyHash = hashMessageBody({
          bodyHtml: this.extractMetadataString(metadata, 'bodyHtml'),
          bodyText: this.extractMetadataString(metadata, 'bodyText'),
        })
        const queueResolution = resolveQueueSlug(
          {
            headers: this.extractHeaderMap(metadata),
            to: message.to,
            cc: message.cc,
            bcc: message.bcc,
            labels: this.extractLabels(metadata),
            subject: message.subject,
            folder,
            direction: message.direction,
          },
          this.queueRuleConfig,
        )
        const queueId = await this.ensureQueue(tx, queueResolution)

        const existingByRemote = await tx.inboxMessage.findUnique({
          where: {
            accountId_channel_remoteId: {
              accountId: account.id,
              channel: account.channel,
              remoteId: message.remoteId,
            },
          },
        })

        let record: InboxMessage & { queue?: { id: string; slug: string; name: string } | null }

        if (existingByRemote) {
          record = await tx.inboxMessage.update({
            where: { id: existingByRemote.id },
            data: this.buildMessageUpdateFromListItem(
              message,
              folder,
              provider,
              messageUid,
              queueId,
              bodyHash,
              metadata,
              queueResolution,
            ),
            include: { queue: true },
          })
        } else {
          record = await tx.inboxMessage.upsert({
            where: {
              messageUid_provider_folder: {
                messageUid,
                provider,
                folder,
              },
            },
            update: this.buildMessageUpdateFromListItem(
              message,
              folder,
              provider,
              messageUid,
              queueId,
              bodyHash,
              metadata,
              queueResolution,
            ),
            create: this.buildMessageCreateFromListItem(
              account,
              message,
              folder,
              provider,
              messageUid,
              queueId,
              bodyHash,
              metadata,
              queueResolution,
            ),
            include: { queue: true },
          })
        }
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

  private buildQueueConfig(): QueueRuleConfig {
    return {
      headerKey: this.configService.get<string>('INBOX_QUEUE_HEADER_KEY') ?? 'x-queue',
      defaultQueue: this.configService.get<string>('INBOX_QUEUE_DEFAULT') ?? 'general',
      domainQueues: this.parseKeyValueConfig('INBOX_QUEUE_DOMAIN_MAP', {
        'support.acme.com': 'support',
        'ventas.acme.com': 'sales',
        'noc.acme.com': 'noc',
      }),
      aliasQueues: this.parseKeyValueConfig('INBOX_QUEUE_ALIAS_MAP', {
        'soporte@acme.com': 'support',
        'noc@acme.com': 'noc',
        'ventas@acme.com': 'sales',
      }),
      labelQueues: this.parseKeyValueConfig('INBOX_QUEUE_LABEL_MAP', {
        urgent: 'noc',
      }),
      subjectRules: this.parseSubjectRuleConfig('INBOX_QUEUE_SUBJECT_RULES', [
        { queue: 'billing', regex: /factura|billing|invoice/i },
        { queue: 'support', regex: /ticket|issue|soporte/i },
        { queue: 'noc', regex: /incident|alert|alarma/i },
      ]),
    }
  }

  private parseKeyValueConfig(
    key: string,
    fallback: Record<string, string> = {},
  ): Record<string, string> {
    const raw = this.configService.get<string>(key)
    if (!raw) {
      return fallback
    }
    const parsedJson = this.parseJson<Record<string, string>>(raw)
    if (parsedJson && typeof parsedJson === 'object') {
      return Object.entries(parsedJson).reduce<Record<string, string>>((acc, [envKey, value]) => {
        if (typeof value === 'string' && value.trim()) {
          acc[envKey.trim().toLowerCase()] = value.trim().toLowerCase()
        }
        return acc
      }, {})
    }
    return raw
      .split(',')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, pair) => {
        const [k, v] = pair.split(':')
        if (k && v) {
          acc[k.trim().toLowerCase()] = v.trim().toLowerCase()
        }
        return acc
      }, {})
  }

  private parseSubjectRuleConfig(
    key: string,
    fallback: Array<{ queue: string; regex: RegExp }> = [],
  ) {
    const raw = this.configService.get<string>(key)
    if (!raw) {
      return fallback
    }
    const parsed = this.parseJson<Array<{ queue: string; pattern: string; flags?: string }>>(raw)
    if (!parsed) {
      return fallback
    }
    return parsed
      .filter((entry) => typeof entry.queue === 'string' && typeof entry.pattern === 'string')
      .map((entry) => ({
        queue: entry.queue.trim().toLowerCase(),
        regex: new RegExp(entry.pattern, entry.flags ?? 'i'),
      }))
  }

  private parseJson<T>(value?: string | null): T | null {
    if (!value) {
      return null
    }
    try {
      return JSON.parse(value) as T
    } catch (error) {
      this.logger.warn(`Failed to parse JSON for queue configuration: ${(error as Error).message}`)
      return null
    }
  }

  private async ensureQueue(
    tx: Prisma.TransactionClient,
    resolution: QueueResolution,
  ): Promise<string> {
    if (this.queueCache.has(resolution.slug)) {
      return this.queueCache.get(resolution.slug)!.id
    }
    const record = await tx.inboxQueue.upsert({
      where: { slug: resolution.slug },
      update: {
        isActive: true,
        rules: toJsonUpdate({ lastMatchedRule: resolution.matchedRule }),
      },
      create: {
        slug: resolution.slug,
        name: this.toTitleCase(resolution.slug),
        description: `Queue created via ${resolution.matchedRule} rule`,
        rules: toJsonInput({ bootstrapRule: resolution.matchedRule }),
      },
    })
    this.queueCache.set(record.slug, {
      id: record.id,
      slug: record.slug,
      name: record.name,
    })
    return record.id
  }

  private toTitleCase(value: string) {
    return value
      .split(/[-_\s]/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ')
  }

  private resolveProvider(account: InboxAccount): string {
    const metadata =
      (account.metadata as Record<string, unknown> | null | undefined) ?? undefined
    const provider =
      typeof metadata?.provider === 'string'
        ? metadata.provider
        : account.channel.toLowerCase()
    return provider.toLowerCase()
  }

  private resolveFolder(folder?: string | null) {
    const normalized = (folder || 'INBOX').trim()
    if (!normalized) {
      return 'INBOX'
    }
    return normalized.toUpperCase()
  }

  private extractListMetadata(message: ChannelMessageListItem) {
    if (message.metadata && typeof message.metadata === 'object') {
      return { ...message.metadata }
    }
    return {}
  }

  private extractBodyMetadata(body: ChannelMessageBody) {
    if (body.metadata && typeof body.metadata === 'object') {
      return { ...body.metadata }
    }
    return {}
  }

  private extractMetadataString(metadata: Record<string, unknown>, key: string) {
    const value = metadata[key]
    return typeof value === 'string' ? value : null
  }

  private extractHeaderMap(metadata: Record<string, unknown>) {
    const headers = metadata.headers
    if (!headers || typeof headers !== 'object') {
      return undefined
    }
    return Object.entries(headers as Record<string, string>).reduce<
      Record<string, string>
    >((acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key.toLowerCase()] = value
      }
      return acc
    }, {})
  }

  private extractLabels(metadata: Record<string, unknown>) {
    const labels = metadata.labels
    if (!Array.isArray(labels)) {
      return undefined
    }
    return labels
      .filter((label): label is string => typeof label === 'string' && label.trim().length > 0)
      .map((label) => label.trim())
  }

  private extractQueueSlug(metadata: unknown) {
    if (!metadata || typeof metadata !== 'object') {
      return null
    }
    const record = metadata as Record<string, unknown>
    const queue = record.queue
    if (typeof queue === 'string' && queue.trim()) {
      return queue.trim().toLowerCase()
    }
    const queueSlug = record.queueSlug
    if (typeof queueSlug === 'string' && queueSlug.trim()) {
      return queueSlug.trim().toLowerCase()
    }
    return null
  }

  private serializeMessage(
    record: InboxMessage & { queue?: { id: string; slug: string; name: string } | null },
  ): MessageSummaryDto {
    return {
      id: record.id,
      accountId: record.accountId,
      provider: record.provider,
      messageUid: record.messageUid,
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
      queueId: record.queueId ?? null,
      queueSlug: record.queue?.slug ?? this.extractQueueSlug(record.metadata),
      queueName: record.queue?.name ?? null,
      sentAt: record.sentAt ? record.sentAt.toISOString() : null,
      receivedAt: record.receivedAt ? record.receivedAt.toISOString() : null,
      metadata: (record.metadata as Record<string, unknown> | null) ?? null,
    }
  }

  private emitBroadcast(eventType: string, message: MessageSummaryDto) {
    this.events.emit({
      type: eventType,
      message,
      queueId: message.queueId ?? null,
      queueSlug: message.queueSlug ?? null,
      accountId: message.accountId,
    })
  }

  private serializeMessageDetail(
    record: InboxMessage & { queue?: { id: string; slug: string; name: string } | null },
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
    folder: string,
    provider: string,
    messageUid: string,
    queueId: string,
    bodyHash: string | null,
    metadata: Record<string, unknown>,
    queueResolution: QueueResolution,
  ): Prisma.InboxMessageUpdateInput {
    const mergedMetadata = this.mergeMetadata(metadata, {
      queue: queueResolution.slug,
      queueRule: queueResolution.matchedRule,
    })
    return {
      provider,
      messageUid,
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
      folder,
      queue: { connect: { id: queueId } },
      isRead: message.isRead ?? false,
      isStarred: message.isStarred ?? false,
      isSpam: message.isSpam ?? false,
      hasAttachments: message.hasAttachments ?? false,
      sentAt: message.sentAt ?? null,
      receivedAt: message.receivedAt ?? null,
      bodyHash: bodyHash ?? undefined,
      metadata: toJsonUpdate(mergedMetadata),
    }
  }

  private buildMessageCreateFromListItem(
    account: InboxAccount,
    message: ChannelMessageListItem,
    folder: string,
    provider: string,
    messageUid: string,
    queueId: string,
    bodyHash: string | null,
    metadata: Record<string, unknown>,
    queueResolution: QueueResolution,
  ): Prisma.InboxMessageCreateInput {
    const mergedMetadata = this.mergeMetadata(metadata, {
      queue: queueResolution.slug,
      queueRule: queueResolution.matchedRule,
    })
    return {
      account: { connect: { id: account.id } },
      channel: account.channel,
      provider,
      messageUid,
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
      folder,
      queue: { connect: { id: queueId } },
      isRead: message.isRead ?? false,
      isStarred: message.isStarred ?? false,
      isSpam: message.isSpam ?? false,
      hasAttachments: message.hasAttachments ?? false,
      sentAt: message.sentAt ?? null,
      receivedAt: message.receivedAt ?? null,
      bodyHash: bodyHash ?? null,
      metadata: toJsonInput(mergedMetadata ?? null),
    }
  }

  private buildMessageUpdateFromBody(
    body: ChannelMessageBody,
    folder: string,
    provider: string,
    queueId: string,
    bodyHash: string | null,
    metadata: Record<string, unknown>,
    queueResolution: QueueResolution,
  ): Prisma.InboxMessageUpdateInput {
    const mergedMetadata = this.mergeMetadata(metadata, {
      queue: queueResolution.slug,
      queueRule: queueResolution.matchedRule,
    })
    return {
      provider,
      threadRemoteId: body.threadRemoteId ?? null,
      subject: body.subject ?? null,
      hasAttachments: (body.attachments?.length ?? 0) > 0,
      snippet: this.extractSnippet(body) ?? null,
      previewText: this.extractSnippet(body) ?? null,
      folder,
      queue: { connect: { id: queueId } },
      bodyHash: bodyHash ?? undefined,
      metadata: toJsonUpdate(mergedMetadata),
    }
  }

  private buildMessageCreateFromBody(
    account: InboxAccount,
    body: ChannelMessageBody,
    folder: string,
    provider: string,
    messageUid: string,
    queueId: string,
    bodyHash: string | null,
    metadata: Record<string, unknown>,
    queueResolution: QueueResolution,
  ): Prisma.InboxMessageCreateInput {
    const mergedMetadata = this.mergeMetadata(metadata, {
      queue: queueResolution.slug,
      queueRule: queueResolution.matchedRule,
    })
    return {
      account: { connect: { id: account.id } },
      channel: account.channel,
       provider,
      messageUid,
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
      folder,
      queue: { connect: { id: queueId } },
      isRead: false,
      isStarred: false,
      isSpam: false,
      hasAttachments: (body.attachments?.length ?? 0) > 0,
      metadata: toJsonInput(mergedMetadata ?? null),
      bodyHash: bodyHash ?? null,
    }
  }

  private buildMessageUpdateFromSend(
    payload: SendMessagePayloadDto,
    result: ChannelSendMessageResult,
    folder: string,
    provider: string,
    queueId: string,
    bodyHash: string | null,
    metadata: Record<string, unknown>,
    queueResolution: QueueResolution,
  ): Prisma.InboxMessageUpdateInput {
    const mergedMetadata = this.mergeMetadata(metadata, {
      queue: queueResolution.slug,
      queueRule: queueResolution.matchedRule,
    })
    return {
      provider,
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
      folder,
      queue: { connect: { id: queueId } },
      isRead: true,
      isStarred: false,
      isSpam: false,
      hasAttachments: (payload.attachments?.length ?? 0) > 0,
      sentAt: new Date(),
      bodyHash: bodyHash ?? undefined,
      metadata: toJsonUpdate(mergedMetadata),
    }
  }

  private buildMessageCreateFromSend(
    account: InboxAccount,
    payload: SendMessagePayloadDto,
    result: ChannelSendMessageResult,
    folder: string,
    provider: string,
    messageUid: string,
    queueId: string,
    bodyHash: string | null,
    metadata: Record<string, unknown>,
    queueResolution: QueueResolution,
  ): Prisma.InboxMessageCreateInput {
    const mergedMetadata = this.mergeMetadata(metadata, {
      queue: queueResolution.slug,
      queueRule: queueResolution.matchedRule,
    })
    return {
      account: { connect: { id: account.id } },
      channel: account.channel,
      provider,
      messageUid,
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
      folder,
      queue: { connect: { id: queueId } },
      isRead: true,
      isStarred: false,
      isSpam: false,
      hasAttachments: (payload.attachments?.length ?? 0) > 0,
      sentAt: new Date(),
      bodyHash: bodyHash ?? null,
      metadata: toJsonInput(mergedMetadata ?? null),
      fromAddress: payload.fromAddress ?? null,
      fromName: payload.fromName ?? null,
    }
  }

  private buildFlagUpdate(
    flags: ChannelSetFlagsInput,
    existingMetadata?: Record<string, unknown>,
    queueResolution?: QueueResolution,
  ): Prisma.InboxMessageUpdateInput {
    const mergedMetadata = this.mergeMetadata(existingMetadata, flags.metadata ?? undefined)
    const withQueue =
      queueResolution != null
        ? this.mergeMetadata(mergedMetadata ?? undefined, {
            queue: queueResolution.slug,
            queueRule: queueResolution.matchedRule,
          })
        : mergedMetadata
    return {
      isRead: flags.seen ?? undefined,
      isStarred: flags.starred ?? undefined,
      isSpam: flags.spam ?? undefined,
      metadata:
        withQueue !== undefined
          ? toJsonUpdate(withQueue)
          : undefined,
    }
  }

  private buildMinimalMessage(
    account: InboxAccount,
    identifier: ChannelMessageIdentifier,
    flags?: ChannelSetFlagsInput,
    folder?: string,
    provider?: string,
    messageUid?: string,
    queueId?: string,
    queueResolution?: QueueResolution,
  ): Prisma.InboxMessageCreateInput {
    const effectiveFolder = this.resolveFolder(folder)
    const providerValue = provider ?? this.resolveProvider(account)
    const messageUidValue =
      messageUid ??
      deriveMessageUid({
        provider: providerValue,
        folder: effectiveFolder,
        remoteId: identifier.remoteId,
      })
    const metadata = this.mergeMetadata(flags?.metadata, {
      queue: queueResolution?.slug ?? this.queueRuleConfig.defaultQueue,
      queueRule: queueResolution?.matchedRule ?? 'default',
    })
    return {
      account: { connect: { id: account.id } },
      channel: account.channel,
      provider: providerValue,
      messageUid: messageUidValue,
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
      folder: effectiveFolder,
      queue: queueId
        ? { connect: { id: queueId } }
        : undefined,
      isRead: flags?.seen ?? false,
      isStarred: flags?.starred ?? false,
      isSpam: flags?.spam ?? false,
      hasAttachments: false,
      metadata: toJsonInput(metadata ?? null),
      bodyHash: null,
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

  private mergeMetadata(
    payloadMetadata?: Record<string, unknown>,
    adapterMetadata?: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    const combined = {
      ...(payloadMetadata ?? {}),
      ...(adapterMetadata ?? {}),
    }

    const keys = Object.keys(combined)
    if (keys.length === 0) {
      return null
    }
    return combined
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
    await this.emailAdapter.refreshConfig()
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
  queueId?: string
  queueSlug?: string
}

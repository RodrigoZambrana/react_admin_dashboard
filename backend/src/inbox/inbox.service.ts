import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
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
import { buildCanonicalThreadKey, resolveMessageActivityAt } from './common/threading'
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
  canonicalThreadKey?: string | null
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
  activityAt?: string | null
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

type ThreadMessageDto = {
  id: string
  remoteId: string
  threadRemoteId?: string | null
  canonicalThreadKey?: string | null
  subject?: string | null
  previewText?: string | null
  snippet?: string | null
  from?: { name?: string | null; address?: string | null } | null
  to: string[]
  cc: string[]
  bcc: string[]
  direction: InboxMessageDirection
  isRead: boolean
  isStarred: boolean
  isSpam: boolean
  hasAttachments: boolean
  sentAt?: string | null
  receivedAt?: string | null
  activityAt?: string | null
}

type ThreadSummaryDto = {
  id: string
  accountId: string
  mailbox: string
  canonicalThreadKey: string
  subject?: string | null
  previewText?: string | null
  snippet?: string | null
  from?: { name?: string | null; address?: string | null } | null
  to: string[]
  cc: string[]
  bcc: string[]
  isRead: boolean
  isStarred: boolean
  isSpam: boolean
  hasAttachments: boolean
  latestMessageAt?: string | null
  latestMessageId?: string | null
  latestRemoteId?: string | null
  threadRemoteId?: string | null
  messageCount: number
  messages: ThreadMessageDto[]
}

type ListThreadsResultDto = {
  items: ThreadSummaryDto[]
  nextCursor?: string | null
}

type SyncMailboxResultDto = {
  mailbox: string
  fetched: number
  nextCursor?: string | null
  complete?: boolean
}

type InboxThreadCursor = {
  offset: number
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

const encodeInboxThreadCursor = (cursor: InboxThreadCursor) =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')

const decodeInboxThreadCursor = (
  value?: string | null,
): InboxThreadCursor | null => {
  if (!value) {
    return null
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      offset?: unknown
    }
    const offset = Number(parsed.offset)
    if (!Number.isInteger(offset) || offset < 0) {
      return null
    }
    return { offset }
  } catch {
    return null
  }
}

@Injectable()
export class InboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxService.name)
  private readonly queueRuleConfig: QueueRuleConfig
  private readonly queueCache = new Map<string, { id: string; name: string; slug: string }>()
  private readonly pollingAccountLocks = new Set<string>()
  private pollingTimer: NodeJS.Timeout | null = null
  private pollingLoopActive = false

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
    await this.synchronizeConfiguredEmailAccount({ triggerSync: true })
    this.startPollingLoop()
  }

  onModuleDestroy() {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer)
      this.pollingTimer = null
    }
    this.pollingLoopActive = false
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
    const [mailboxes, syncStates, persistedCounts] = await Promise.all([
      adapter.listMailboxes(channelAccount),
      this.prisma.inboxSyncState.findMany({
        where: {
          accountId: account.id,
          channel: account.channel,
        },
      }),
      this.prisma.inboxMessage.groupBy({
        by: ['folder'],
        where: { accountId: account.id, channel: account.channel },
        _count: { _all: true },
      }),
    ])

    const syncStateByFolder = new Map(syncStates.map((entry) => [entry.folder, entry]))
    const persistedCountByFolder = new Map(
      persistedCounts.map((entry) => [entry.folder ?? '', entry._count._all]),
    )

    return mailboxes.map((mailbox) => {
      const syncState = syncStateByFolder.get(mailbox.id)
      const syncMetadata =
        syncState?.metadata && typeof syncState.metadata === 'object'
          ? (syncState.metadata as Record<string, unknown>)
          : null
      const existingMetadata =
        mailbox.metadata && typeof mailbox.metadata === 'object'
          ? (mailbox.metadata as Record<string, unknown>)
          : {}
      const nextCursor =
        typeof syncMetadata?.nextCursor === 'string' && syncMetadata.nextCursor.trim()
          ? syncMetadata.nextCursor.trim()
          : null
      const complete =
        typeof syncMetadata?.complete === 'boolean'
          ? syncMetadata.complete
          : nextCursor
            ? false
            : null
      const historyComplete =
        typeof syncMetadata?.historyComplete === 'boolean'
          ? syncMetadata.historyComplete
          : null
      const lastHistorySyncAt =
        typeof syncMetadata?.lastHistorySyncAt === 'string'
          ? syncMetadata.lastHistorySyncAt
          : null
      const historyRequestedAt =
        typeof syncMetadata?.historyRequestedAt === 'string'
          ? syncMetadata.historyRequestedAt
          : null
      const lastHistoryFetched =
        typeof syncMetadata?.lastHistoryFetched === 'number'
          ? syncMetadata.lastHistoryFetched
          : null
      const lastHistoryPageCount =
        typeof syncMetadata?.lastHistoryPageCount === 'number'
          ? syncMetadata.lastHistoryPageCount
          : null

      return {
        ...mailbox,
        metadata: {
          ...existingMetadata,
          sync: {
            complete,
            historyComplete,
            nextCursor,
            lastSyncAt: syncState?.lastSyncAt?.toISOString() ?? null,
            lastHistorySyncAt,
            historyRequestedAt,
            lastHistoryFetched,
            lastHistoryPageCount,
            localMessageCount: persistedCountByFolder.get(mailbox.id) ?? 0,
          },
        },
      }
    })
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

  async listThreads(
    accountId: string,
    options: ChannelListMessagesOptions,
  ): Promise<ListThreadsResultDto> {
    this.assertMailboxOption(options)
    const account = await this.getAccountOrThrow(accountId)
    const mailbox = this.resolveFolder(options.mailbox)
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 200)
    const cursor = decodeInboxThreadCursor(options.cursor ?? null)
    const offset = cursor?.offset ?? 0

    const records = await this.prisma.inboxMessage.findMany({
      where: {
        accountId: account.id,
        channel: account.channel,
        folder: mailbox,
      },
      orderBy: [{ receivedAt: 'desc' }, { sentAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        queue: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
      take: 5000,
    })

    const grouped = new Map<string, ThreadSummaryDto>()
    for (const record of records) {
      const summary = this.serializeMessage(record)
      const threadKey =
        summary.canonicalThreadKey ||
        buildCanonicalThreadKey({
          threadRemoteId: summary.threadRemoteId ?? null,
          messageId: this.extractMetadataString(summary.metadata ?? {}, 'messageId'),
          inReplyTo: this.extractMetadataString(summary.metadata ?? {}, 'inReplyTo'),
          references: this.extractMetadataString(summary.metadata ?? {}, 'references'),
          subject: summary.subject ?? null,
          fromAddress: summary.from?.address ?? null,
          toAddresses: summary.to,
        }).key
      const threadMessage: ThreadMessageDto = {
        id: summary.id,
        remoteId: summary.remoteId,
        threadRemoteId: summary.threadRemoteId ?? null,
        canonicalThreadKey: threadKey,
        subject: summary.subject ?? null,
        previewText: summary.previewText ?? null,
        snippet: summary.snippet ?? null,
        from: summary.from ?? null,
        to: summary.to,
        cc: summary.cc,
        bcc: summary.bcc,
        direction: summary.direction,
        isRead: summary.isRead,
        isStarred: summary.isStarred,
        isSpam: summary.isSpam,
        hasAttachments: summary.hasAttachments,
        sentAt: summary.sentAt ?? null,
        receivedAt: summary.receivedAt ?? null,
        activityAt: summary.activityAt ?? null,
      }

      const existing = grouped.get(threadKey)
      if (!existing) {
        grouped.set(threadKey, {
          id: threadKey,
          accountId: summary.accountId,
          mailbox,
          canonicalThreadKey: threadKey,
          subject: summary.subject ?? null,
          previewText: summary.previewText ?? null,
          snippet: summary.snippet ?? null,
          from: summary.from ?? null,
          to: summary.to,
          cc: summary.cc,
          bcc: summary.bcc,
          isRead: summary.isRead,
          isStarred: summary.isStarred,
          isSpam: summary.isSpam,
          hasAttachments: summary.hasAttachments,
          latestMessageAt: summary.activityAt ?? summary.receivedAt ?? summary.sentAt ?? null,
          latestMessageId: summary.id,
          latestRemoteId: summary.remoteId,
          threadRemoteId: summary.threadRemoteId ?? null,
          messageCount: 1,
          messages: [threadMessage],
        })
        continue
      }

      existing.messages.push(threadMessage)
      existing.messageCount += 1
      existing.isRead = existing.isRead && summary.isRead
      existing.isStarred = existing.isStarred || summary.isStarred
      existing.isSpam = existing.isSpam || summary.isSpam
      existing.hasAttachments = existing.hasAttachments || summary.hasAttachments

      const currentLatest =
        this.parseSummaryTimestamp(existing.latestMessageAt) ?? 0
      const candidateLatest =
        this.parseSummaryTimestamp(summary.activityAt ?? summary.receivedAt ?? summary.sentAt ?? null) ?? 0
      if (candidateLatest >= currentLatest) {
        existing.subject = summary.subject ?? existing.subject ?? null
        existing.previewText = summary.previewText ?? existing.previewText ?? null
        existing.snippet = summary.snippet ?? existing.snippet ?? null
        existing.from = summary.from ?? existing.from ?? null
        existing.to = summary.to
        existing.cc = summary.cc
        existing.bcc = summary.bcc
        existing.latestMessageAt =
          summary.activityAt ?? summary.receivedAt ?? summary.sentAt ?? null
        existing.latestMessageId = summary.id
        existing.latestRemoteId = summary.remoteId
        existing.threadRemoteId = summary.threadRemoteId ?? existing.threadRemoteId ?? null
      }
    }

    const orderedThreads = Array.from(grouped.values())
      .map((thread) => ({
        ...thread,
        messages: thread.messages.sort((left, right) => {
          const leftTime = this.parseSummaryTimestamp(
            left.activityAt ?? left.receivedAt ?? left.sentAt ?? null,
          ) ?? 0
          const rightTime = this.parseSummaryTimestamp(
            right.activityAt ?? right.receivedAt ?? right.sentAt ?? null,
          ) ?? 0
          return leftTime - rightTime
        }),
      }))
      .sort((left, right) => {
        const leftTime = this.parseSummaryTimestamp(left.latestMessageAt) ?? 0
        const rightTime = this.parseSummaryTimestamp(right.latestMessageAt) ?? 0
        return rightTime - leftTime
      })

    const items = orderedThreads.slice(offset, offset + limit)
    const nextOffset = offset + items.length

    return {
      items,
      nextCursor:
        nextOffset < orderedThreads.length
          ? encodeInboxThreadCursor({ offset: nextOffset })
          : null,
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
      fullHistory?: boolean
      maxPages?: number
    } = {},
  ) {
    const account = await this.getAccountOrThrow(accountId)
    const mailboxes =
      options.mailboxes && options.mailboxes.length > 0 ? options.mailboxes : ['INBOX']

    const results: SyncMailboxResultDto[] = []
    const maxPages =
      Number.isInteger(options.maxPages) && (options.maxPages ?? 0) > 0
        ? Math.min(options.maxPages as number, 200)
        : 100

    for (const mailbox of mailboxes) {
      let totalFetched = 0
      let nextCursor: string | null | undefined =
        options.cursor ??
        (options.fullHistory
          ? await this.resolveStoredSyncCursor(account.id, account.channel, mailbox)
          : undefined)
      let page = 0

      do {
        const result = await this.listMessages(accountId, {
          mailbox,
          limit: options.limit,
          cursor: nextCursor ?? undefined,
          since: options.since,
        })
        totalFetched += result.items.length
        nextCursor = result.nextCursor ?? null
        page += 1
      } while (options.fullHistory && nextCursor && page < maxPages)

      results.push({
        mailbox,
        fetched: totalFetched,
        nextCursor: nextCursor ?? null,
        complete: !nextCursor,
      })

      if (options.fullHistory) {
        await this.annotateHistorySync(account.id, account.channel, mailbox, {
          complete: !nextCursor,
          fetched: totalFetched,
          pageCount: page,
        })
      }
    }

    return {
      accountId,
      mailboxes: results,
    }
  }

  async synchronizeConfiguredEmailAccount(options: { triggerSync?: boolean } = {}) {
    const account = await this.ensureConfiguredEmailAccount()
    if (!account) {
      return null
    }
    if (options.triggerSync) {
      await this.pollAccountIfDue(account, { force: true })
    }
    return account
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

  private startPollingLoop() {
    if (this.pollingLoopActive) {
      return
    }
    this.pollingLoopActive = true
    void this.runPollingLoop()
  }

  private async runPollingLoop() {
    try {
      await this.pollActiveEmailAccounts()
    } catch (error) {
      this.logger.error(
        `Inbox polling loop failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      if (!this.pollingLoopActive) {
        return
      }
      this.pollingTimer = setTimeout(() => {
        void this.runPollingLoop()
      }, this.resolvePollingTickMs())
    }
  }

  private resolvePollingTickMs() {
    const configuredTick = Number(this.configService.get('INBOX_POLLING_TICK_MS') ?? 30_000)
    if (Number.isFinite(configuredTick) && configuredTick >= 5_000) {
      return configuredTick
    }
    return 30_000
  }

  private async pollActiveEmailAccounts() {
    const accounts = await this.prisma.inboxAccount.findMany({
      where: {
        active: true,
        channel: InboxChannelType.EMAIL,
      },
      orderBy: { createdAt: 'asc' },
    })

    for (const account of accounts) {
      await this.pollAccountIfDue(account)
    }
  }

  private async pollAccountIfDue(account: InboxAccount, options: { force?: boolean } = {}) {
    const polling = this.extractPollingConfig(account)
    if (polling.intervalMs <= 0 || polling.batchSize <= 0) {
      return
    }

    if (!options.force) {
      const syncState = await this.prisma.inboxSyncState.findUnique({
        where: {
          accountId_channel_folder: {
            accountId: account.id,
            channel: account.channel,
            folder: 'INBOX',
          },
        },
      })
      if (syncState?.lastSyncAt) {
        const elapsed = Date.now() - syncState.lastSyncAt.getTime()
        if (elapsed < polling.intervalMs) {
          return
        }
      }
    }

    if (this.pollingAccountLocks.has(account.id)) {
      return
    }

    this.pollingAccountLocks.add(account.id)
    try {
      const result = await this.synchronizeAccount(account.id, {
        mailboxes: ['INBOX'],
        limit: polling.batchSize,
      })
      const fetched = result.mailboxes.reduce((total, mailbox) => total + mailbox.fetched, 0)
      if (fetched > 0) {
        this.logger.log(
          `Inbox polling synchronized ${fetched} messages for ${account.address} (accountId=${account.id}).`,
        )
      }
    } catch (error) {
      this.logger.error(
        `Inbox polling failed for ${account.address}: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      this.pollingAccountLocks.delete(account.id)
    }
  }

  private extractPollingConfig(account: InboxAccount) {
    const metadata =
      (account.metadata as Record<string, unknown> | null | undefined) ?? undefined
    const polling =
      metadata?.polling && typeof metadata.polling === 'object'
        ? (metadata.polling as Record<string, unknown>)
        : undefined

    const intervalCandidate = Number(polling?.intervalMs)
    const batchCandidate = Number(polling?.batchSize)
    const configuredFallbackInterval = Number(
      this.configService.get('INBOX_EMAIL_POLL_INTERVAL_MS') ?? 120_000,
    )
    const configuredFallbackBatch = Number(
      this.configService.get('INBOX_EMAIL_POLL_BATCH_SIZE') ?? 50,
    )
    const fallbackInterval =
      Number.isFinite(configuredFallbackInterval) && configuredFallbackInterval > 0
        ? configuredFallbackInterval
        : 120_000
    const fallbackBatch =
      Number.isFinite(configuredFallbackBatch) && configuredFallbackBatch > 0
        ? configuredFallbackBatch
        : 50

    return {
      intervalMs:
        Number.isFinite(intervalCandidate) && intervalCandidate > 0
          ? intervalCandidate
          : fallbackInterval,
      batchSize:
        Number.isFinite(batchCandidate) && batchCandidate > 0
          ? batchCandidate
          : fallbackBatch,
    }
  }

  private async persistMessageList(
    account: InboxAccount,
    mailbox: string,
    messages: ChannelMessageListItem[],
    nextCursor: string | null,
  ): Promise<InboxMessage[]> {
    if (messages.length === 0) {
      await this.upsertSyncState(this.prisma, {
        accountId: account.id,
        channel: account.channel,
        folder: mailbox,
        lastRemoteId: null,
        nextCursor,
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

      await this.upsertSyncState(tx, {
        accountId: account.id,
        channel: account.channel,
        folder: mailbox,
        lastRemoteId,
        nextCursor,
      })

      return persisted
    })
  }

  private async resolveStoredSyncCursor(
    accountId: string,
    channel: InboxChannelType,
    mailbox: string,
  ) {
    const state = await this.prisma.inboxSyncState.findUnique({
      where: {
        accountId_channel_folder: {
          accountId,
          channel,
          folder: mailbox,
        },
      },
      select: {
        metadata: true,
      },
    })
    const metadata =
      state?.metadata && typeof state.metadata === 'object'
        ? (state.metadata as Record<string, unknown>)
        : null
    const nextCursor =
      typeof metadata?.nextCursor === 'string' && metadata.nextCursor.trim()
        ? metadata.nextCursor.trim()
        : null
    return nextCursor ?? undefined
  }

  private async annotateHistorySync(
    accountId: string,
    channel: InboxChannelType,
    mailbox: string,
    input: {
      complete: boolean
      fetched: number
      pageCount: number
    },
  ) {
    const state = await this.prisma.inboxSyncState.findUnique({
      where: {
        accountId_channel_folder: {
          accountId,
          channel,
          folder: mailbox,
        },
      },
      select: {
        metadata: true,
      },
    })
    const metadata =
      state?.metadata && typeof state.metadata === 'object'
        ? { ...(state.metadata as Record<string, unknown>) }
        : {}
    const now = new Date().toISOString()
    metadata.historyRequestedAt = now
    metadata.lastHistoryFetched = input.fetched
    metadata.lastHistoryPageCount = input.pageCount
    metadata.historyComplete = input.complete
    if (input.complete) {
      metadata.lastHistorySyncAt = now
    }

    await this.prisma.inboxSyncState.upsert({
      where: {
        accountId_channel_folder: {
          accountId,
          channel,
          folder: mailbox,
        },
      },
      update: {
        metadata: toJsonInput(metadata),
      },
      create: {
        accountId,
        channel,
        folder: mailbox,
        lastRemoteId: null,
        lastSyncAt: new Date(),
        metadata: toJsonInput(metadata),
      },
    })
  }

  private async upsertSyncState(
    tx: Prisma.TransactionClient | PrismaService,
    input: {
      accountId: string
      channel: InboxChannelType
      folder: string
      lastRemoteId: string | null
      nextCursor: string | null
    },
  ) {
    const existing = await tx.inboxSyncState.findUnique({
      where: {
        accountId_channel_folder: {
          accountId: input.accountId,
          channel: input.channel,
          folder: input.folder,
        },
      },
      select: {
        metadata: true,
      },
    })
    const currentMetadata =
      existing?.metadata && typeof existing.metadata === 'object'
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {}

    const metadata = {
      ...currentMetadata,
      nextCursor: input.nextCursor,
      complete: !input.nextCursor,
    }

    await tx.inboxSyncState.upsert({
      where: {
        accountId_channel_folder: {
          accountId: input.accountId,
          channel: input.channel,
          folder: input.folder,
        },
      },
      update: {
        lastRemoteId: input.lastRemoteId,
        lastSyncAt: new Date(),
        metadata: toJsonInput(metadata),
      },
      create: {
        accountId: input.accountId,
        channel: input.channel,
        folder: input.folder,
        lastRemoteId: input.lastRemoteId,
        lastSyncAt: new Date(),
        metadata: toJsonInput(metadata),
      },
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

  private extractCanonicalThreadMetadata(input: {
    threadRemoteId?: string | null
    subject?: string | null
    metadata?: Record<string, unknown> | null
    fromAddress?: string | null
    toAddresses?: string[]
    receivedAt?: Date | null
    sentAt?: Date | null
  }) {
    const metadata = input.metadata ?? {}
    const headers = this.extractHeaderMap(metadata) ?? {}
    const canonicalThread = buildCanonicalThreadKey({
      threadRemoteId: input.threadRemoteId ?? null,
      gmailThreadId: this.extractMetadataString(metadata, 'gmailThreadId'),
      messageId:
        this.extractMetadataString(metadata, 'messageId') ?? headers['message-id'] ?? null,
      inReplyTo:
        this.extractMetadataString(metadata, 'inReplyTo') ?? headers['in-reply-to'] ?? null,
      references:
        this.extractMetadataString(metadata, 'references') ?? headers.references ?? null,
      subject: input.subject ?? null,
      fromAddress: input.fromAddress ?? null,
      toAddresses: input.toAddresses ?? [],
    })
    const activityAt = resolveMessageActivityAt({
      receivedAt: input.receivedAt ?? null,
      sentAt: input.sentAt ?? null,
    })

    return {
      canonicalThreadKey: canonicalThread.key,
      canonicalThreadReason: canonicalThread.reason,
      activityAt: activityAt?.toISOString() ?? null,
    }
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
    const metadata = (record.metadata as Record<string, unknown> | null) ?? null
    return {
      id: record.id,
      accountId: record.accountId,
      provider: record.provider,
      messageUid: record.messageUid,
      remoteId: record.remoteId,
      threadRemoteId: record.threadRemoteId,
      canonicalThreadKey:
        metadata && typeof metadata.canonicalThreadKey === 'string'
          ? metadata.canonicalThreadKey
          : null,
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
      activityAt:
        metadata && typeof metadata.activityAt === 'string'
          ? metadata.activityAt
          : (record.receivedAt ?? record.sentAt)?.toISOString() ?? null,
      metadata,
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
    const canonicalThreadMetadata = this.extractCanonicalThreadMetadata({
      threadRemoteId: message.threadRemoteId ?? null,
      subject: message.subject ?? null,
      metadata,
      fromAddress: message.from?.address ?? null,
      toAddresses: this.normalizeAddressArray(message.to),
      receivedAt: message.receivedAt ?? null,
      sentAt: message.sentAt ?? null,
    })
    const mergedMetadata = this.mergeMetadata(metadata, {
      queue: queueResolution.slug,
      queueRule: queueResolution.matchedRule,
      ...canonicalThreadMetadata,
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
    const canonicalThreadMetadata = this.extractCanonicalThreadMetadata({
      threadRemoteId: message.threadRemoteId ?? null,
      subject: message.subject ?? null,
      metadata,
      fromAddress: message.from?.address ?? null,
      toAddresses: this.normalizeAddressArray(message.to),
      receivedAt: message.receivedAt ?? null,
      sentAt: message.sentAt ?? null,
    })
    const mergedMetadata = this.mergeMetadata(metadata, {
      queue: queueResolution.slug,
      queueRule: queueResolution.matchedRule,
      ...canonicalThreadMetadata,
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
    const canonicalThreadMetadata = this.extractCanonicalThreadMetadata({
      threadRemoteId: body.threadRemoteId ?? null,
      subject: body.subject ?? null,
      metadata,
      fromAddress: null,
      toAddresses: [],
    })
    const mergedMetadata = this.mergeMetadata(metadata, {
      queue: queueResolution.slug,
      queueRule: queueResolution.matchedRule,
      ...canonicalThreadMetadata,
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
    const canonicalThreadMetadata = this.extractCanonicalThreadMetadata({
      threadRemoteId: body.threadRemoteId ?? null,
      subject: body.subject ?? null,
      metadata,
      fromAddress: null,
      toAddresses: [],
    })
    const mergedMetadata = this.mergeMetadata(metadata, {
      queue: queueResolution.slug,
      queueRule: queueResolution.matchedRule,
      ...canonicalThreadMetadata,
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
    const sentAt = new Date()
    const canonicalThreadMetadata = this.extractCanonicalThreadMetadata({
      threadRemoteId: result.threadRemoteId ?? payload.replyToRemoteId ?? null,
      subject: payload.subject ?? null,
      metadata,
      fromAddress: payload.fromAddress ?? null,
      toAddresses: payload.to,
      sentAt,
    })
    const mergedMetadata = this.mergeMetadata(metadata, {
      queue: queueResolution.slug,
      queueRule: queueResolution.matchedRule,
      ...canonicalThreadMetadata,
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
      sentAt,
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
    const sentAt = new Date()
    const canonicalThreadMetadata = this.extractCanonicalThreadMetadata({
      threadRemoteId: result.threadRemoteId ?? payload.replyToRemoteId ?? null,
      subject: payload.subject ?? null,
      metadata,
      fromAddress: payload.fromAddress ?? null,
      toAddresses: payload.to,
      sentAt,
    })
    const mergedMetadata = this.mergeMetadata(metadata, {
      queue: queueResolution.slug,
      queueRule: queueResolution.matchedRule,
      ...canonicalThreadMetadata,
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
      sentAt,
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

  private parseSummaryTimestamp(value?: string | null) {
    if (!value) {
      return null
    }
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
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
      return null
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

    return this.prisma.inboxAccount.upsert({
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

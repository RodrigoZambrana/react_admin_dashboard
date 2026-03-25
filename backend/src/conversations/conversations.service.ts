import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ConversationChannel,
  ConversationControlMode,
  ConversationHandoffEventType,
  ConversationMessageAuthorType,
  ConversationMessageKind,
  ConversationParticipantRole,
  ConversationScope,
  ConversationStatus,
  ConversationToolCallStatus,
  InboxMessageEventType,
  InboxChannelType,
  InboxMessageDirection,
  Prisma,
} from '@prisma/client'
import { randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { InboxService } from '../inbox/inbox.service'
import { CreateWebchatSessionDto } from './dto/create-webchat-session.dto'
import { ListConversationsDto } from './dto/list-conversations.dto'
import { ReplyConversationDto } from './dto/reply-conversation.dto'
import { AssignConversationDto } from './dto/assign-conversation.dto'
import { ConversationHandoffDto } from './dto/conversation-handoff.dto'
import { CreateWebchatMessageDto } from './dto/create-webchat-message.dto'
import { AgentReplyDto } from './dto/agent-reply.dto'
import { DispatchWebchatMessageDto } from './dto/dispatch-webchat-message.dto'
import { GetWebchatSessionDto } from './dto/get-webchat-session.dto'
import { IngestInboundMessageDto } from './dto/ingest-inbound-message.dto'
import { SyncOutboundStatusDto } from './dto/sync-outbound-status.dto'
import { CreateAdminInternalSessionDto } from './dto/create-admin-internal-session.dto'

type OutboundDispatchResult = {
  kind: ConversationMessageKind
  sentAt: Date
  externalMessageId?: string | null
  inboxMessageId?: string | null
  metadata?: Record<string, unknown>
  queueId?: string | null
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly inboxService?: InboxService,
  ) {}

  async listConversations(query: ListConversationsDto, currentUserId?: number) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where: Prisma.ConversationWhereInput = {}

    if (query.scope) {
      where.scope = this.mapScope(query.scope)
    }

    if (query.channel) {
      where.channel = this.mapChannel(query.channel)
    }

    if (query.controlMode) {
      where.controlMode = this.mapControlMode(query.controlMode)
    }

    if (query.status) {
      where.status = this.mapStatus(query.status)
    }

    if (query.assignedToMe) {
      where.assignedToUserId = currentUserId
        ? currentUserId
        : { not: null }
    }

    if (query.assignedUserId) {
      const assignedUserId = Number(query.assignedUserId)
      if (Number.isInteger(assignedUserId)) {
        where.assignedToUserId = assignedUserId
      }
    }

    if (query.inboxAccountId) {
      where.inboxAccountId = query.inboxAccountId
    }

    if (query.queueSlug) {
      where.messages = {
        some: {
          inboxMessage: {
            queue: {
              slug: query.queueSlug.trim().toLowerCase(),
            },
          },
        },
      }
    }

    const search = query.search?.trim()
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { externalUserId: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
            },
          },
          assignedToUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          inboxAccount: {
            select: {
              id: true,
              displayName: true,
              address: true,
              channel: true,
            },
          },
          participants: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              role: true,
              displayName: true,
              externalUserId: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          messages: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              authorType: true,
              kind: true,
              body: true,
              normalizedText: true,
              createdAt: true,
              inboxMessage: {
                select: {
                  queue: {
                    select: {
                      id: true,
                      slug: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ])

    return {
      items: items.map((item) => this.mapConversationSummary(item)),
      total,
      page,
      pageSize,
      filters: {
        scope: query.scope ?? null,
        channel: query.channel ?? null,
        controlMode: query.controlMode ?? null,
        status: query.status ?? null,
        assignedToMe: query.assignedToMe ?? false,
        assignedUserId: query.assignedUserId ?? null,
        inboxAccountId: query.inboxAccountId ?? null,
        queueSlug: query.queueSlug ?? null,
        search: search ?? null,
      },
    }
  }

  async getConversation(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
        assignedToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        inboxAccount: {
          select: {
            id: true,
            displayName: true,
            address: true,
            channel: true,
          },
        },
        participants: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            displayName: true,
            externalUserId: true,
            metadata: true,
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
          select: {
            id: true,
            authorType: true,
            kind: true,
            body: true,
            normalizedText: true,
            payload: true,
            metadata: true,
            sentAt: true,
            receivedAt: true,
            createdAt: true,
            inboxMessage: {
              select: {
                queue: {
                  select: {
                    id: true,
                    slug: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        handoffEvents: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            type: true,
            previousMode: true,
            nextMode: true,
            notes: true,
            createdAt: true,
            actorUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        toolCalls: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            toolName: true,
            status: true,
            validatedPayload: true,
            resultPayload: true,
            errorCode: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true,
            messageId: true,
          },
        },
      },
    })

    if (!conversation) {
      return null
    }

    return {
      ...this.mapConversationSummary(conversation),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        authorType: this.normalizeEnum(message.authorType),
        kind: this.normalizeEnum(message.kind),
        body: message.body ?? null,
        normalizedText: message.normalizedText ?? null,
        payload: message.payload ?? null,
        metadata: message.metadata ?? null,
        sentAt: message.sentAt,
        receivedAt: message.receivedAt,
        createdAt: message.createdAt,
        queue: message.inboxMessage?.queue ?? null,
      })),
      handoffEvents: (conversation.handoffEvents ?? []).map((event) => ({
        id: event.id,
        type: this.normalizeEnum(event.type),
        previousMode: event.previousMode
          ? this.normalizeEnum(event.previousMode)
          : null,
        nextMode: event.nextMode ? this.normalizeEnum(event.nextMode) : null,
        notes: event.notes ?? null,
        createdAt: event.createdAt,
        actorUser: event.actorUser ?? null,
      })),
      toolCalls: (conversation.toolCalls ?? []).map((toolCall) => ({
        id: toolCall.id,
        messageId: toolCall.messageId ?? null,
        toolName: toolCall.toolName,
        status: this.normalizeEnum(toolCall.status),
        validatedPayload: toolCall.validatedPayload ?? null,
        resultPayload: toolCall.resultPayload ?? null,
        errorCode: toolCall.errorCode ?? null,
        errorMessage: toolCall.errorMessage ?? null,
        createdAt: toolCall.createdAt,
        updatedAt: toolCall.updatedAt,
      })),
    }
  }

  async listInboxes() {
    const accounts = await this.prisma.inboxAccount.findMany({
      where: { active: true },
      orderBy: [{ channel: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        channel: true,
        displayName: true,
        address: true,
        active: true,
        updatedAt: true,
      },
    })

    return accounts.map((account) => ({
      ...account,
      channel: this.normalizeEnum(account.channel),
      scope: 'customer_public' as const,
    }))
  }

  async listQueues() {
    const queues = await this.prisma.inboxQueue.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }, { slug: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        isActive: true,
      },
    })

    return queues.map((queue) => ({
      ...queue,
      conversationCount: 0,
    }))
  }

  async createAdminInternalSession(
    input: CreateAdminInternalSessionDto,
    actorUserId: number,
  ) {
    const conversation = await this.prisma.conversation.create({
      data: {
        tenantKey: input.tenantKey?.trim() || 'default',
        scope: ConversationScope.ADMIN_INTERNAL,
        channel: ConversationChannel.ADMIN_CHAT,
        status: ConversationStatus.WAITING_INTERNAL,
        controlMode: ConversationControlMode.AI,
        subject: input.subject.trim(),
        assignedToUserId: actorUserId,
        externalUserId: `admin:${actorUserId}`,
        externalThreadId: `admin-chat:${randomUUID()}`,
        metadata: {
          source: 'admin-internal',
        },
        participants: {
          create: {
            role: ConversationParticipantRole.OPERATOR,
            userId: actorUserId,
            displayName: 'Operador interno',
          },
        },
      },
      select: {
        id: true,
      },
    })

    await this.replyAsOperator(
      conversation.id,
      {
        body: input.message.trim(),
        kind: 'text',
      },
      actorUserId,
    )

    return this.getConversation(conversation.id)
  }

  async createWebchatSession(input: CreateWebchatSessionDto) {
    const tenantKey =
      input.tenantKey?.trim() ||
      this.config.get<string>('CLIENT_SLUG') ||
      'default'

    const guestId = input.guestId?.trim() || randomUUID()
    const email = input.email?.trim() || null
    const customer = email
      ? await this.prisma.customer.findFirst({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        })
      : null

    const conversation = await this.prisma.conversation.create({
      data: {
        tenantKey,
        scope: ConversationScope.CUSTOMER_PUBLIC,
        channel: ConversationChannel.WEBCHAT,
        status: ConversationStatus.OPEN,
        controlMode: ConversationControlMode.AI,
        subject: input.page?.trim() || 'webchat session',
        customerId: customer?.id ?? null,
        externalUserId: guestId,
        externalThreadId: `webchat:${guestId}`,
        externalChannelRef: input.page?.trim() || null,
        metadata: {
          locale: input.locale?.trim() || 'es-UY',
          page: input.page?.trim() || null,
          source: 'webchat-session',
        },
        lastMessageAt: new Date(),
        participants: {
          create: {
            role: ConversationParticipantRole.CUSTOMER,
            customerId: customer?.id ?? null,
            externalUserId: guestId,
            displayName: input.name?.trim() || customer?.name || 'Guest',
            metadata: {
              email,
              locale: input.locale?.trim() || 'es-UY',
            },
          },
        },
        messages: {
          create: {
            authorType: ConversationMessageAuthorType.SYSTEM,
            kind: ConversationMessageKind.SYSTEM_EVENT,
            body: 'webchat session created',
            normalizedText: 'webchat session created',
            metadata: {
              source: 'webchat-session',
            },
          },
        },
      },
    })

    return {
      sessionId: conversation.id,
      conversationId: conversation.id,
      tenantKey,
      scope: 'customer_public' as const,
      channel: 'webchat' as const,
      controlMode: 'ai' as const,
      participant: {
        guestId,
        name: input.name?.trim() || customer?.name || null,
        email,
        locale: input.locale?.trim() || 'es-UY',
      },
      context: {
        page: input.page?.trim() || null,
      },
    }
  }

  async getWebchatSession(id: string, query: GetWebchatSessionDto) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            externalUserId: true,
            displayName: true,
            metadata: true,
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
          select: {
            id: true,
            authorType: true,
            kind: true,
            body: true,
            normalizedText: true,
            createdAt: true,
          },
        },
      },
    })

    if (!conversation || conversation.channel !== ConversationChannel.WEBCHAT) {
      throw new NotFoundException('conversation.notFound')
    }

    const participant = conversation.participants.find(
      (entry) => entry.role === ConversationParticipantRole.CUSTOMER,
    )
    const guestId = query.guestId?.trim() || participant?.externalUserId || null
    if (
      query.guestId?.trim() &&
      participant?.externalUserId &&
      participant.externalUserId !== query.guestId.trim()
    ) {
      throw new NotFoundException('conversation.notFound')
    }

    return {
      sessionId: conversation.id,
      conversationId: conversation.id,
      tenantKey: conversation.tenantKey,
      scope: 'customer_public' as const,
      channel: 'webchat' as const,
      controlMode: this.normalizeEnum(conversation.controlMode) as
        | 'ai'
        | 'human'
        | 'hybrid',
      participant: {
        guestId: guestId || 'guest',
        name:
          participant?.displayName ??
          participant?.customer?.name ??
          null,
        email:
          ((participant?.metadata as Record<string, unknown> | null)?.email as
            string | null) ??
          participant?.customer?.email ??
          null,
        locale:
          ((participant?.metadata as Record<string, unknown> | null)?.locale as
            string | null) ?? 'es-UY',
      },
      context: {
        page:
          ((conversation.metadata as Record<string, unknown> | null)?.page as
            string | null) ?? null,
      },
      messages: conversation.messages
        .filter(
          (message) =>
            message.authorType === ConversationMessageAuthorType.CUSTOMER ||
            message.authorType === ConversationMessageAuthorType.AGENT ||
            message.authorType === ConversationMessageAuthorType.OPERATOR,
        )
        .map((message) => ({
          id: message.id,
          role:
            message.authorType === ConversationMessageAuthorType.CUSTOMER
              ? 'customer'
              : 'agent',
          text: message.body ?? message.normalizedText ?? '',
          createdAt: message.createdAt,
        })),
    }
  }

  async createWebchatMessage(input: CreateWebchatMessageDto) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: {
        id: true,
        channel: true,
        externalUserId: true,
      },
    })

    if (!conversation || conversation.channel !== ConversationChannel.WEBCHAT) {
      throw new NotFoundException('conversation.notFound')
    }

    const message = await this.prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        authorType: ConversationMessageAuthorType.CUSTOMER,
        kind: ConversationMessageKind.TEXT,
        body: input.text,
        normalizedText: input.text,
        metadata: {
          source: 'webchat',
          guestId: input.guestId?.trim() || conversation.externalUserId || null,
        },
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
      },
    })

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.createdAt,
        lastInboundAt: message.createdAt,
        status: ConversationStatus.WAITING_INTERNAL,
      },
    })

    return {
      ok: true,
      conversationId: conversation.id,
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
      },
    }
  }

  async dispatchWebchatMessage(input: DispatchWebchatMessageDto) {
    const channelAdapterBaseUrl =
      this.config.get<string>('CHANNEL_ADAPTER_BASE_URL') ||
      'http://channel-adapter:4200'

    const response = await fetch(
      `${channelAdapterBaseUrl.replace(/\/$/, '')}/webhooks/webchat`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    )

    const rawText = await response.text()
    const payload = rawText ? JSON.parse(rawText) : null

    if (!response.ok) {
      throw new NotFoundException(
        payload?.message || 'conversation.webchatDispatchFailed',
      )
    }

    return payload
  }

  async ingestInboundMessage(input: IngestInboundMessageDto) {
    const normalizedText = input.text?.trim() || input.subject?.trim() || ''
    if (!normalizedText) {
      throw new BadRequestException('conversation.inboundTextRequired')
    }

    return this.prisma.$transaction(async (tx) => {
      const channel = this.mapChannel(input.channel)
      const inboxChannel = this.mapInboxChannel(input.channel)
      const tenantKey = input.tenantKey.trim()
      const receivedAt = input.receivedAt ?? new Date()
      const customer = await this.resolveInboundCustomer(tx, input)
      const inboxAccount = await this.resolveInboundInboxAccount(
        tx,
        input,
        inboxChannel,
      )
      const queue = await this.resolveInboundQueue(tx, input)

      let conversation =
        input.conversationId?.trim()
          ? await tx.conversation.findUnique({
              where: { id: input.conversationId.trim() },
            })
          : null

      if (!conversation) {
        conversation = await this.findInboundConversation(tx, {
          tenantKey,
          channel,
          threadId: input.threadId?.trim() || null,
          inboxAccountId: inboxAccount?.id ?? null,
          userId: input.userId.trim(),
        })
      }

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            tenantKey,
            scope: ConversationScope.CUSTOMER_PUBLIC,
            channel,
            status: ConversationStatus.WAITING_INTERNAL,
            controlMode: ConversationControlMode.AI,
            subject:
              input.subject?.trim() ||
              `Inbound ${input.channel}`,
            customerId: customer?.id ?? null,
            inboxAccountId: inboxAccount?.id ?? null,
            externalUserId: input.userId.trim(),
            externalThreadId:
              input.threadId?.trim() ||
              `${input.channel}:${input.userId.trim()}`,
            externalChannelRef:
              ((input.metadata as Record<string, unknown> | null)?.threadId as
                string | null) ?? null,
            metadata: {
              source: 'channel-adapter',
              queueSlug: queue?.slug ?? null,
              ...(input.metadata ?? {}),
            },
          },
        })
      } else {
        conversation = await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            customerId: conversation.customerId ?? customer?.id ?? null,
            inboxAccountId: conversation.inboxAccountId ?? inboxAccount?.id ?? null,
            subject: conversation.subject ?? input.subject?.trim() ?? null,
            metadata: {
              ...(this.asRecord(conversation.metadata) ?? {}),
              ...(input.metadata ?? {}),
              queueSlug: queue?.slug ?? this.asRecord(conversation.metadata)?.queueSlug ?? null,
            },
          },
        })
      }

      await this.ensureInboundParticipant(tx, conversation.id, customer?.id ?? null, {
        externalUserId: input.userId.trim(),
        displayName:
          input.displayName?.trim() || customer?.name || null,
        email: input.email?.trim() || customer?.email || null,
      })

      const duplicateMessage =
        input.externalMessageId?.trim()
          ? await tx.conversationMessage.findFirst({
              where: {
                conversationId: conversation.id,
                externalMessageId: input.externalMessageId.trim(),
              },
            })
          : null

      if (duplicateMessage) {
        return {
          conversationId: conversation.id,
          status: this.normalizeEnum(conversation.status),
          controlMode: this.normalizeEnum(conversation.controlMode),
          duplicate: true,
          queue,
        }
      }

      const inboxMessage =
        inboxAccount != null
          ? await tx.inboxMessage.create({
              data: {
                accountId: inboxAccount.id,
                channel: inboxChannel,
                provider:
                  ((input.metadata as Record<string, unknown> | null)
                    ?.provider as string | null) || 'channel-adapter',
                messageUid:
                  input.externalMessageId?.trim() ||
                  `${input.channel}:${randomUUID()}`,
                remoteId:
                  input.externalMessageId?.trim() ||
                  `${input.channel}:${randomUUID()}`,
                threadRemoteId: input.threadId?.trim() || null,
                subject: input.subject?.trim() || null,
                snippet: normalizedText.slice(0, 280),
                previewText: normalizedText.slice(0, 280),
                fromAddress:
                  input.email?.trim() ||
                  input.userId.trim(),
                fromName: input.displayName?.trim() || null,
                toAddresses: [],
                ccAddresses: [],
                bccAddresses: [],
                replyToAddresses: [],
                direction: InboxMessageDirection.INBOUND,
                folder: 'inbox',
                queueId: queue?.id ?? null,
                receivedAt,
                metadata: {
                  source: 'channel-adapter',
                  ...(input.metadata ?? {}),
                },
              },
            })
          : null

      const kind =
        channel === ConversationChannel.EMAIL
          ? ConversationMessageKind.EMAIL
          : ConversationMessageKind.TEXT

      const message = await tx.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          authorType: ConversationMessageAuthorType.CUSTOMER,
          kind,
          authorCustomerId: customer?.id ?? null,
          externalMessageId: input.externalMessageId?.trim() || null,
          inboxMessageId: inboxMessage?.id ?? null,
          body: normalizedText,
          normalizedText,
          payload: {
            subject: input.subject?.trim() || null,
          },
          metadata: {
            source: 'channel-adapter',
            channel: input.channel,
            ...(input.metadata ?? {}),
          },
          receivedAt,
        },
        select: {
          id: true,
          createdAt: true,
        },
      })

      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: message.createdAt,
          lastInboundAt: message.createdAt,
          status: ConversationStatus.WAITING_INTERNAL,
        },
      })

      return {
        conversationId: conversation.id,
        messageId: message.id,
        status: 'waiting_internal' as const,
        controlMode: this.normalizeEnum(conversation.controlMode),
        scope: 'customer_public' as const,
        channel: this.normalizeEnum(channel),
        queue,
        inboxAccount: inboxAccount
          ? {
              id: inboxAccount.id,
              displayName: inboxAccount.displayName ?? null,
              address: inboxAccount.address ?? null,
            }
          : null,
      }
    })
  }

  async takeoverConversation(
    id: string,
    actorUserId: number,
    input: ConversationHandoffDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id },
        select: { id: true, controlMode: true },
      })

      if (!conversation) {
        throw new NotFoundException('conversation.notFound')
      }

      await tx.conversation.update({
        where: { id },
        data: {
          controlMode: ConversationControlMode.HUMAN,
          assignedToUserId: actorUserId,
        },
      })

      await tx.conversationHandoffEvent.create({
        data: {
          conversationId: id,
          type: ConversationHandoffEventType.HUMAN_TAKEOVER,
          actorUserId,
          previousMode: conversation.controlMode,
          nextMode: ConversationControlMode.HUMAN,
          notes: input.notes?.trim() || null,
        },
      })
    })

    return this.getConversation(id)
  }

  async releaseConversation(
    id: string,
    actorUserId: number,
    input: ConversationHandoffDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id },
        select: { id: true, controlMode: true },
      })

      if (!conversation) {
        throw new NotFoundException('conversation.notFound')
      }

      await tx.conversation.update({
        where: { id },
        data: {
          controlMode: ConversationControlMode.AI,
          assignedToUserId: null,
        },
      })

      await tx.conversationHandoffEvent.create({
        data: {
          conversationId: id,
          type: ConversationHandoffEventType.HUMAN_RELEASE,
          actorUserId,
          previousMode: conversation.controlMode,
          nextMode: ConversationControlMode.AI,
          notes: input.notes?.trim() || null,
        },
      })
    })

    return this.getConversation(id)
  }

  async assignConversation(
    id: string,
    input: AssignConversationDto,
    actorUserId: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!conversation) {
        throw new NotFoundException('conversation.notFound')
      }

      await tx.conversation.update({
        where: { id },
        data: {
          assignedToUserId: input.userId,
        },
      })

      await tx.conversationHandoffEvent.create({
        data: {
          conversationId: id,
          type: ConversationHandoffEventType.ASSIGNED,
          actorUserId,
          notes: input.notes?.trim() || null,
          metadata: {
            assignedToUserId: input.userId,
          },
        },
      })
    })

    return this.getConversation(id)
  }

  async replyAsOperator(
    id: string,
    input: ReplyConversationDto,
    actorUserId: number,
  ) {
    const conversation = await this.requireConversationForOutbound(id)
    const outbound = await this.dispatchOutboundMessage(
      conversation,
      input.body,
      'admin-reply',
    )

    await this.prisma.$transaction(async (tx) => {
      const message = await tx.conversationMessage.create({
        data: {
          conversationId: id,
          authorType: ConversationMessageAuthorType.OPERATOR,
          kind:
            input.kind?.trim().toLowerCase() === 'system_event'
              ? ConversationMessageKind.SYSTEM_EVENT
              : outbound.kind,
          authorUserId: actorUserId,
          externalMessageId: outbound.externalMessageId ?? null,
          inboxMessageId: outbound.inboxMessageId ?? null,
          body: input.body,
          normalizedText: input.body,
          sentAt: outbound.sentAt,
          metadata: {
            source: 'admin-reply',
            ...(outbound.metadata ?? {}),
          },
        },
        select: {
          createdAt: true,
        },
      })

      await tx.conversation.update({
        where: { id },
        data: {
          controlMode:
            conversation.scope === ConversationScope.ADMIN_INTERNAL
              ? ConversationControlMode.AI
              : ConversationControlMode.HUMAN,
          assignedToUserId: actorUserId,
          lastMessageAt: message.createdAt,
          lastOutboundAt: message.createdAt,
          status:
            conversation.scope === ConversationScope.ADMIN_INTERNAL
              ? ConversationStatus.WAITING_INTERNAL
              : ConversationStatus.WAITING_CUSTOMER,
        },
      })
    })

    if (conversation.scope === ConversationScope.ADMIN_INTERNAL) {
      await this.respondToAdminInternalMessage(conversation, actorUserId, input.body)
    }

    return this.getConversation(id)
  }

  async replyAsAgent(id: string, input: AgentReplyDto) {
    const conversation = await this.requireConversationForOutbound(id)
    const outbound = await this.dispatchOutboundMessage(
      conversation,
      input.body,
      'ai-agent-service',
      input.metadata ?? undefined,
    )

    await this.prisma.$transaction(async (tx) => {
      const message = await tx.conversationMessage.create({
        data: {
          conversationId: id,
          authorType: ConversationMessageAuthorType.AGENT,
          kind: outbound.kind,
          externalMessageId: outbound.externalMessageId ?? null,
          inboxMessageId: outbound.inboxMessageId ?? null,
          body: input.body,
          normalizedText: input.body,
          sentAt: outbound.sentAt,
          metadata: {
            source: 'ai-agent-service',
            ...(input.metadata ?? {}),
            ...(outbound.metadata ?? {}),
          },
        },
        select: {
          id: true,
          createdAt: true,
        },
      })

      if (input.toolCalls?.length) {
        await tx.conversationToolCall.createMany({
          data: input.toolCalls.map((toolCall) => ({
            conversationId: id,
            messageId: message.id,
            toolName: toolCall.name,
            status: this.mapToolCallStatus(toolCall.status),
            requestedBy: ConversationMessageAuthorType.AGENT,
            validatedPayload: this.toJsonValue(toolCall.arguments),
            resultPayload: this.toJsonValue(toolCall.result),
            errorCode: toolCall.errorCode ?? null,
            errorMessage: toolCall.errorMessage ?? null,
          })),
        })
      }

      await tx.conversation.update({
        where: { id },
        data: {
          controlMode: ConversationControlMode.AI,
          lastMessageAt: message.createdAt,
          lastOutboundAt: message.createdAt,
          status: ConversationStatus.WAITING_CUSTOMER,
        },
      })
    })

    return this.getConversation(id)
  }

  async syncOutboundStatus(input: SyncOutboundStatusDto) {
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date()

    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id: input.conversationId },
        select: { id: true, inboxAccountId: true },
      })

      if (!conversation) {
        throw new NotFoundException('conversation.notFound')
      }

      const inboxMessage = await tx.inboxMessage.findFirst({
        where: {
          accountId: input.inboxAccountId ?? conversation.inboxAccountId ?? undefined,
          channel: this.mapInboxChannel(input.channel),
          remoteId: input.remoteId,
        },
        select: {
          id: true,
          metadata: true,
        },
      })

      if (inboxMessage) {
        await tx.inboxMessage.update({
          where: { id: inboxMessage.id },
          data: {
            metadata: {
              ...(this.asRecord(inboxMessage.metadata) ?? {}),
              deliveryStatus: input.deliveryStatus,
              providerMessageId:
                input.providerMessageId ?? input.externalMessageId ?? input.remoteId,
              lastStatusAt: occurredAt.toISOString(),
              ...(input.metadata ?? {}),
            },
            updatedAt: occurredAt,
          },
        })

        await tx.inboxMessageEvent.create({
          data: {
            messageId: inboxMessage.id,
            type:
              input.deliveryStatus === 'failed' || input.deliveryStatus === 'rejected'
                ? InboxMessageEventType.ERROR
                : InboxMessageEventType.SYNCED,
            payload: this.toJsonValue({
              deliveryStatus: input.deliveryStatus,
              errorCode: input.errorCode ?? null,
              errorMessage: input.errorMessage ?? null,
              ...(input.metadata ?? {}),
            }),
          },
        })
      }

      const messages = await tx.conversationMessage.findMany({
        where: {
          conversationId: input.conversationId,
          OR: [
            { externalMessageId: input.externalMessageId ?? input.remoteId },
            inboxMessage ? { inboxMessageId: inboxMessage.id } : undefined,
          ].filter(Boolean) as Prisma.ConversationMessageWhereInput[],
        },
        select: {
          id: true,
          metadata: true,
        },
      })

      for (const message of messages) {
        await tx.conversationMessage.update({
          where: { id: message.id },
          data: {
            metadata: {
              ...(this.asRecord(message.metadata) ?? {}),
              channel: input.channel,
              deliveryStatus: input.deliveryStatus,
              providerMessageId:
                input.providerMessageId ?? input.externalMessageId ?? input.remoteId,
              deliveryUpdatedAt: occurredAt.toISOString(),
              errorCode: input.errorCode ?? null,
              errorMessage: input.errorMessage ?? null,
              ...(input.metadata ?? {}),
            },
          },
        })
      }

      return {
        ok: true,
        conversationId: input.conversationId,
        deliveryStatus: input.deliveryStatus,
        syncedMessages: messages.length,
      }
    })
  }

  private mapConversationSummary(
    conversation: Prisma.ConversationGetPayload<{
      include: {
        customer: {
          select: { id: true; name: true; email: true; phoneNumber: true }
        }
        assignedToUser: {
          select: { id: true; name: true; email: true }
        }
        inboxAccount: {
          select: { id: true; displayName: true; address: true; channel: true }
        }
        participants: {
          select: {
            id: true
            role: true
            displayName: true
            externalUserId: true
            customer: { select: { id: true; name: true; email: true } }
            user: { select: { id: true; name: true; email: true } }
          }
        }
        messages: {
          select: {
            id: true
            authorType: true
            kind: true
            body: true
            normalizedText: true
            createdAt: true
            inboxMessage: {
              select: {
                queue: {
                  select: { id: true; slug: true; name: true }
                }
              }
            }
          }
        }
      }
    }>,
  ) {
    const latestMessage = conversation.messages.reduce<
      (typeof conversation.messages)[number] | null
    >((latest, current) => {
      if (!latest) {
        return current
      }

      return current.createdAt > latest.createdAt ? current : latest
    }, null)
    const latestQueuedMessage = conversation.messages.find(
      (message) => message.inboxMessage?.queue,
    )

    return {
      id: conversation.id,
      tenantKey: conversation.tenantKey,
      scope: this.normalizeEnum(conversation.scope),
      channel: this.normalizeEnum(conversation.channel),
      status: this.normalizeEnum(conversation.status),
      controlMode: this.normalizeEnum(conversation.controlMode),
      subject: conversation.subject ?? null,
      externalUserId: conversation.externalUserId ?? null,
      externalThreadId: conversation.externalThreadId ?? null,
      externalChannelRef: conversation.externalChannelRef ?? null,
      lastMessageAt: conversation.lastMessageAt,
      lastInboundAt: conversation.lastInboundAt,
      lastOutboundAt: conversation.lastOutboundAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      customer: conversation.customer,
      assignedToUser: conversation.assignedToUser,
      inboxAccount: conversation.inboxAccount
        ? {
            ...conversation.inboxAccount,
            channel: this.normalizeEnum(conversation.inboxAccount.channel),
          }
        : null,
      queue: latestQueuedMessage?.inboxMessage?.queue ?? null,
      participants: conversation.participants.map((participant) => ({
        id: participant.id,
        role: this.normalizeEnum(participant.role),
        displayName: participant.displayName ?? null,
        externalUserId: participant.externalUserId ?? null,
        customer: participant.customer ?? null,
        user: participant.user ?? null,
      })),
      latestMessage: latestMessage
        ? {
            id: latestMessage.id,
            authorType: this.normalizeEnum(latestMessage.authorType),
            kind: this.normalizeEnum(latestMessage.kind),
            body: latestMessage.body ?? latestMessage.normalizedText ?? null,
            createdAt: latestMessage.createdAt,
          }
        : null,
    }
  }

  private async resolveInboundCustomer(
    tx: Prisma.TransactionClient,
    input: IngestInboundMessageDto,
  ) {
    const email =
      input.email?.trim().toLowerCase() ||
      (input.channel === 'email' ? input.userId.trim().toLowerCase() : null)

    if (!email) {
      return null
    }

    return tx.customer.findFirst({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })
  }

  private async resolveInboundInboxAccount(
    tx: Prisma.TransactionClient,
    input: IngestInboundMessageDto,
    channel: InboxChannelType,
  ) {
    if (input.inboxAccountId?.trim()) {
      return tx.inboxAccount.findUnique({
        where: { id: input.inboxAccountId.trim() },
      })
    }

    const fallbackAddress =
      input.inboxAddress?.trim() ||
      (this.asRecord(input.metadata)?.pageId as string | undefined) ||
      `${input.tenantKey.trim()}:${input.channel}`

    return tx.inboxAccount.upsert({
      where: {
        channel_address: {
          channel,
          address: fallbackAddress,
        },
      },
      update: {
        displayName:
          input.channel === 'email'
            ? 'Email'
            : `Meta ${input.channel}`,
        active: true,
      },
      create: {
        channel,
        address: fallbackAddress,
        displayName:
          input.channel === 'email'
            ? input.inboxAddress?.trim() || 'Email'
            : `Meta ${input.channel}`,
        active: true,
        metadata: {
          source: 'conversation-hub',
        },
      },
    })
  }

  private async resolveInboundQueue(
    tx: Prisma.TransactionClient,
    input: IngestInboundMessageDto,
  ) {
    const slug = (
      input.queueSlug?.trim().toLowerCase() ||
      (input.channel === 'email' ? 'support' : 'social')
    ).replace(/[^a-z0-9-_]/g, '-')

    return tx.inboxQueue.upsert({
      where: { slug },
      update: {
        isActive: true,
      },
      create: {
        slug,
        name: slug
          .split('-')
          .map((segment) =>
            segment ? segment[0].toUpperCase() + segment.slice(1) : segment,
          )
          .join(' '),
        description: `Auto-generated queue for ${input.channel}`,
        isActive: true,
      },
    })
  }

  private async findInboundConversation(
    tx: Prisma.TransactionClient,
    input: {
      tenantKey: string
      channel: ConversationChannel
      threadId: string | null
      inboxAccountId: string | null
      userId: string
    },
  ) {
    if (input.threadId) {
      const byThread = await tx.conversation.findFirst({
        where: {
          tenantKey: input.tenantKey,
          channel: input.channel,
          externalThreadId: input.threadId,
        },
      })
      if (byThread) {
        return byThread
      }
    }

    return tx.conversation.findFirst({
      where: {
        tenantKey: input.tenantKey,
        channel: input.channel,
        externalUserId: input.userId,
        inboxAccountId: input.inboxAccountId,
        status: { not: ConversationStatus.CLOSED },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    })
  }

  private async ensureInboundParticipant(
    tx: Prisma.TransactionClient,
    conversationId: string,
    customerId: number | null,
    input: {
      externalUserId: string
      displayName: string | null
      email: string | null
    },
  ) {
    const existing = await tx.conversationParticipant.findFirst({
      where: {
        conversationId,
        role: ConversationParticipantRole.CUSTOMER,
        OR: [
          { externalUserId: input.externalUserId },
          customerId ? { customerId } : undefined,
        ].filter(Boolean) as Prisma.ConversationParticipantWhereInput[],
      },
    })

    if (existing) {
      return existing
    }

    return tx.conversationParticipant.create({
      data: {
        conversationId,
        role: ConversationParticipantRole.CUSTOMER,
        customerId,
        externalUserId: input.externalUserId,
        displayName: input.displayName,
        metadata: {
          email: input.email,
        },
      },
    })
  }

  private async requireConversationForOutbound(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
        inboxAccount: {
          select: {
            id: true,
            address: true,
            displayName: true,
            channel: true,
          },
        },
        participants: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            displayName: true,
            externalUserId: true,
            metadata: true,
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            inboxMessageId: true,
            inboxMessage: {
              select: {
                id: true,
                threadRemoteId: true,
                queueId: true,
                queue: {
                  select: {
                    id: true,
                    slug: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!conversation) {
      throw new NotFoundException('conversation.notFound')
    }

    return conversation
  }

  private async dispatchOutboundMessage(
    conversation: Awaited<ReturnType<ConversationsService['requireConversationForOutbound']>>,
    body: string,
    source: string,
    extraMetadata?: Record<string, unknown>,
  ): Promise<OutboundDispatchResult> {
    const sentAt = new Date()
    const latestInboxMessage = conversation.messages[0]?.inboxMessage ?? null

    if (
      conversation.channel === ConversationChannel.EMAIL &&
      conversation.inboxAccountId &&
      this.inboxService
    ) {
      const recipientEmail =
        conversation.customer?.email?.trim() ||
        conversation.participants
          .map(
            (participant) =>
              participant.customer?.email ||
              (this.asRecord(participant.metadata)?.email as string | undefined) ||
              (participant.externalUserId?.includes('@')
                ? participant.externalUserId
                : undefined),
          )
          .find((value) => value?.trim()) ||
        null

      if (!recipientEmail) {
        throw new BadRequestException('conversation.emailRecipientRequired')
      }

      const sentMessage = await this.inboxService.sendMessage(
        conversation.inboxAccountId,
        {
          subject: conversation.subject?.trim() || 'Respuesta desde atención',
          bodyText: body,
          to: [recipientEmail],
          replyToRemoteId:
            latestInboxMessage?.threadRemoteId ||
            conversation.externalThreadId ||
            undefined,
          queueId: latestInboxMessage?.queueId ?? undefined,
          metadata: {
            source,
            conversationId: conversation.id,
            scope: this.normalizeEnum(conversation.scope),
            ...(extraMetadata ?? {}),
          },
        },
      )

      return {
        kind: ConversationMessageKind.EMAIL,
        sentAt: sentMessage.sentAt ? new Date(sentMessage.sentAt) : sentAt,
        externalMessageId: sentMessage.remoteId,
        inboxMessageId: sentMessage.id,
        queueId: sentMessage.queueId ?? latestInboxMessage?.queueId ?? null,
        metadata: {
          channel: 'email',
          deliveryStatus: 'sent',
          provider: sentMessage.provider,
          providerMessageId:
            (this.asRecord(sentMessage.metadata)?.messageId as string | undefined) ??
            sentMessage.remoteId,
          threadRemoteId: sentMessage.threadRemoteId ?? null,
          ...(extraMetadata ?? {}),
        },
      }
    }

    if (this.isMetaConversationChannel(conversation.channel)) {
      const outbound = await this.dispatchMetaOutbound(conversation, body, {
        source,
        ...(extraMetadata ?? {}),
      })

      return {
        kind: ConversationMessageKind.TEXT,
        sentAt,
        externalMessageId: outbound.remoteId,
        inboxMessageId: outbound.inboxMessageId,
        metadata: {
          channel: this.normalizeEnum(conversation.channel),
          deliveryStatus: outbound.deliveryStatus,
          provider: outbound.provider,
          providerMessageId: outbound.providerMessageId ?? outbound.remoteId,
          threadRemoteId: outbound.threadRemoteId ?? null,
          ...(extraMetadata ?? {}),
        },
      }
    }

    return {
      kind: ConversationMessageKind.TEXT,
      sentAt,
      metadata: {
        channel: this.normalizeEnum(conversation.channel),
        deliveryStatus: 'internal_only',
        ...(extraMetadata ?? {}),
      },
    }
  }

  private async dispatchMetaOutbound(
    conversation: Awaited<ReturnType<ConversationsService['requireConversationForOutbound']>>,
    body: string,
    metadata: Record<string, unknown>,
  ) {
    if (!conversation.inboxAccountId) {
      throw new BadRequestException('conversation.metaInboxRequired')
    }

    const recipientId =
      conversation.externalUserId?.trim() ||
      conversation.participants
        .map((participant) => participant.externalUserId)
        .find((value) => value?.trim()) ||
      null

    if (!recipientId) {
      throw new BadRequestException('conversation.metaRecipientRequired')
    }

    const channelAdapterBaseUrl =
      this.config.get<string>('CHANNEL_ADAPTER_BASE_URL') ||
      'http://channel-adapter:4200'

    const response = await fetch(
      `${channelAdapterBaseUrl.replace(/\/$/, '')}/dispatch/meta`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ai-internal-token':
            this.config.get<string>('AI_INTERNAL_TOKEN') ||
            'local-ai-internal-token',
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          tenantKey: conversation.tenantKey,
          channel: this.normalizeEnum(conversation.channel),
          inboxAccountId: conversation.inboxAccountId,
          inboxAddress: conversation.inboxAccount?.address ?? null,
          recipientId,
          threadId: conversation.externalThreadId ?? null,
          text: body,
          metadata,
        }),
      },
    )

    const rawText = await response.text()
    const payload = rawText ? JSON.parse(rawText) : null

    if (!response.ok) {
      throw new BadRequestException(
        payload?.message || 'conversation.metaDispatchFailed',
      )
    }

    const createdInboxMessage = await this.prisma.$transaction(async (tx) => {
      const inboxMessage = await tx.inboxMessage.create({
        data: {
          accountId: conversation.inboxAccountId!,
          channel: this.mapInboxChannel(
            this.normalizeEnum(conversation.channel) as IngestInboundMessageDto['channel'],
          ),
          provider:
            typeof payload?.provider === 'string'
              ? payload.provider
              : 'meta-graph',
          messageUid: payload?.remoteId || `meta:${randomUUID()}`,
          remoteId: payload?.remoteId || `meta:${randomUUID()}`,
          threadRemoteId:
            payload?.threadRemoteId || conversation.externalThreadId || null,
          subject: conversation.subject ?? null,
          snippet: body.slice(0, 280),
          previewText: body.slice(0, 280),
          fromAddress: conversation.inboxAccount?.address ?? null,
          fromName: conversation.inboxAccount?.displayName ?? null,
          toAddresses: [recipientId],
          ccAddresses: [],
          bccAddresses: [],
          replyToAddresses: [],
          direction: InboxMessageDirection.OUTBOUND,
          folder: 'sent',
          queueId: conversation.messages[0]?.inboxMessage?.queueId ?? null,
          sentAt: new Date(),
          metadata: this.toJsonValue({
            source: metadata.source ?? 'conversation-hub',
            deliveryStatus: payload?.deliveryStatus ?? 'accepted',
            providerMessageId: payload?.providerMessageId ?? payload?.remoteId ?? null,
            ...(payload?.metadata ?? {}),
          }),
        },
        select: {
          id: true,
        },
      })

      await tx.inboxMessageEvent.create({
        data: {
          messageId: inboxMessage.id,
          type: InboxMessageEventType.SENT,
          payload: this.toJsonValue({
            channel: this.normalizeEnum(conversation.channel),
            deliveryStatus: payload?.deliveryStatus ?? 'accepted',
            providerMessageId: payload?.providerMessageId ?? payload?.remoteId ?? null,
          }),
        },
      })

      return inboxMessage
    })

    return {
      remoteId: payload?.remoteId || `meta:${randomUUID()}`,
      threadRemoteId: payload?.threadRemoteId || conversation.externalThreadId || null,
      providerMessageId: payload?.providerMessageId ?? payload?.remoteId ?? null,
      deliveryStatus: payload?.deliveryStatus || 'accepted',
      provider: payload?.provider || 'meta-graph',
      inboxMessageId: createdInboxMessage.id,
    }
  }

  private async respondToAdminInternalMessage(
    conversation: Awaited<ReturnType<ConversationsService['requireConversationForOutbound']>>,
    actorUserId: number,
    body: string,
  ) {
    const aiAgentBaseUrl =
      this.config.get<string>('AI_AGENT_BASE_URL') ||
      'http://ai-agent-service:4100'

    const response = await fetch(`${aiAgentBaseUrl.replace(/\/$/, '')}/respond`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tenantKey: conversation.tenantKey,
        scope: 'admin_internal',
        channel: 'admin_chat',
        conversationId: conversation.id,
        userId: `admin:${actorUserId}`,
        text: body,
      }),
    })

    const rawText = await response.text()
    const payload = rawText ? JSON.parse(rawText) : null

    if (!response.ok || !payload?.ok || !payload?.response?.text?.trim()) {
      return null
    }

    return this.replyAsAgent(conversation.id, {
      body: payload.response.text.trim(),
      metadata: {
        provider: payload.response.provider ?? null,
        model: payload.response.model ?? null,
        channel: 'admin_chat',
      },
      toolCalls: payload.response.toolCalls ?? [],
    })
  }

  private isMetaConversationChannel(channel: ConversationChannel) {
    return (
      channel === ConversationChannel.WHATSAPP ||
      channel === ConversationChannel.FACEBOOK ||
      channel === ConversationChannel.INSTAGRAM
    )
  }

  private asRecord(input: unknown): Record<string, unknown> | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return input as Record<string, unknown>
  }

  private mapInboxChannel(
    input: IngestInboundMessageDto['channel'],
  ): InboxChannelType {
    switch (input) {
      case 'email':
        return InboxChannelType.EMAIL
      case 'whatsapp':
        return InboxChannelType.WHATSAPP
      case 'facebook':
        return InboxChannelType.MESSENGER
      case 'instagram':
        return InboxChannelType.INSTAGRAM
      default:
        return InboxChannelType.OTHER
    }
  }

  private mapToolCallStatus(status?: string | null): ConversationToolCallStatus {
    switch ((status ?? '').trim().toLowerCase()) {
      case 'failed':
        return ConversationToolCallStatus.FAILED
      case 'rejected':
        return ConversationToolCallStatus.REJECTED
      case 'confirmed':
        return ConversationToolCallStatus.CONFIRMED
      case 'validated':
        return ConversationToolCallStatus.VALIDATED
      case 'requested':
        return ConversationToolCallStatus.REQUESTED
      default:
        return ConversationToolCallStatus.EXECUTED
    }
  }

  private toJsonValue(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value === undefined || value === null) {
      return Prisma.JsonNull
    }
    return value as Prisma.InputJsonValue
  }

  private normalizeEnum(input: string) {
    return input.toLowerCase()
  }

  private mapScope(scope: NonNullable<ListConversationsDto['scope']>) {
    return scope === 'admin_internal'
      ? ConversationScope.ADMIN_INTERNAL
      : ConversationScope.CUSTOMER_PUBLIC
  }

  private mapChannel(channel: NonNullable<ListConversationsDto['channel']>) {
    switch (channel) {
      case 'admin_chat':
        return ConversationChannel.ADMIN_CHAT
      case 'email':
        return ConversationChannel.EMAIL
      case 'facebook':
        return ConversationChannel.FACEBOOK
      case 'instagram':
        return ConversationChannel.INSTAGRAM
      case 'whatsapp':
        return ConversationChannel.WHATSAPP
      default:
        return ConversationChannel.WEBCHAT
    }
  }

  private mapControlMode(mode: NonNullable<ListConversationsDto['controlMode']>) {
    switch (mode) {
      case 'human':
        return ConversationControlMode.HUMAN
      case 'hybrid':
        return ConversationControlMode.HYBRID
      default:
        return ConversationControlMode.AI
    }
  }

  private mapStatus(status: NonNullable<ListConversationsDto['status']>) {
    switch (status) {
      case 'closed':
        return ConversationStatus.CLOSED
      case 'waiting_customer':
        return ConversationStatus.WAITING_CUSTOMER
      case 'waiting_internal':
        return ConversationStatus.WAITING_INTERNAL
      default:
        return ConversationStatus.OPEN
    }
  }
}

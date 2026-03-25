import { Injectable, NotFoundException } from '@nestjs/common'
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
  Prisma,
} from '@prisma/client'
import { randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { CreateWebchatSessionDto } from './dto/create-webchat-session.dto'
import { ListConversationsDto } from './dto/list-conversations.dto'
import { ReplyConversationDto } from './dto/reply-conversation.dto'
import { AssignConversationDto } from './dto/assign-conversation.dto'
import { ConversationHandoffDto } from './dto/conversation-handoff.dto'
import { CreateWebchatMessageDto } from './dto/create-webchat-message.dto'
import { AgentReplyDto } from './dto/agent-reply.dto'
import { DispatchWebchatMessageDto } from './dto/dispatch-webchat-message.dto'

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async listConversations(query: ListConversationsDto) {
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
      where.assignedToUserId = { not: null }
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
            take: 1,
            orderBy: { createdAt: 'desc' },
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
          take: 50,
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
    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!conversation) {
        throw new NotFoundException('conversation.notFound')
      }

      const message = await tx.conversationMessage.create({
        data: {
          conversationId: id,
          authorType: ConversationMessageAuthorType.OPERATOR,
          kind:
            input.kind?.trim().toLowerCase() === 'system_event'
              ? ConversationMessageKind.SYSTEM_EVENT
              : ConversationMessageKind.TEXT,
          authorUserId: actorUserId,
          body: input.body,
          normalizedText: input.body,
          sentAt: new Date(),
          metadata: {
            source: 'admin-reply',
          },
        },
        select: {
          createdAt: true,
        },
      })

      await tx.conversation.update({
        where: { id },
        data: {
          controlMode: ConversationControlMode.HUMAN,
          assignedToUserId: actorUserId,
          lastMessageAt: message.createdAt,
          lastOutboundAt: message.createdAt,
          status: ConversationStatus.WAITING_CUSTOMER,
        },
      })
    })

    return this.getConversation(id)
  }

  async replyAsAgent(id: string, input: AgentReplyDto) {
    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!conversation) {
        throw new NotFoundException('conversation.notFound')
      }

      const message = await tx.conversationMessage.create({
        data: {
          conversationId: id,
          authorType: ConversationMessageAuthorType.AGENT,
          kind: ConversationMessageKind.TEXT,
          body: input.body,
          normalizedText: input.body,
          sentAt: new Date(),
          metadata: {
            source: 'ai-agent-service',
            ...(input.metadata ?? {}),
          },
        },
        select: {
          createdAt: true,
        },
      })

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

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
  ConversationRole,
  ConversationScope,
  ConversationStatus,
  ConversationToolCallStatus,
  InboxMessageEventType,
  InboxChannelType,
  InboxMessageDirection,
  InboxQueueAssignmentMode,
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
import { RerouteConversationDto } from './dto/reroute-conversation.dto'
import { ListConversationContactsDto } from './dto/list-conversation-contacts.dto'
import { StartContactConversationDto } from './dto/start-contact-conversation.dto'
import {
  type AiConversationRole,
  normalizeAiConversationRole,
  resolveAiConversationRole,
  resolveAiScopeFromRole,
} from '../ai/role-engine'

type OutboundDispatchResult = {
  kind: ConversationMessageKind
  sentAt: Date
  externalMessageId?: string | null
  inboxMessageId?: string | null
  metadata?: Record<string, unknown>
  queueId?: string | null
}

type ConversationReadStateSummary = {
  lastReadAt: Date | null
  unreadCount: number
  isRead: boolean
  manualUnread: boolean
}

const INTERNAL_ASSISTANT_CONTACT_KEY = 'internal:assistant'
const INTERNAL_ASSISTANT_CONTACT_LABEL = 'Asistente interno'
const INTERNAL_ASSISTANT_CONTACT_ALIASES = [
  INTERNAL_ASSISTANT_CONTACT_LABEL,
  'Agente IA',
  'IA',
  'Chat interno IA operativa',
]

const isInternalAssistantSubject = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }

  return INTERNAL_ASSISTANT_CONTACT_ALIASES.some(
    (alias) => alias.trim().toLowerCase() === normalized,
  )
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
              metadata: true,
              createdAt: true,
              inboxMessage: {
                select: {
                  queue: {
                    select: {
                      id: true,
                      slug: true,
                      name: true,
                      priority: true,
                      slaTargetMinutes: true,
                    },
                  },
                },
              },
            },
          },
          toolCalls: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: {
              toolName: true,
              status: true,
              updatedAt: true,
            },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ])

    const readStateByConversationId = await this.buildReadStateMap(
      items.map((item) => item.id),
      currentUserId,
    )

    return {
      items: items.map((item) =>
        this.mapConversationSummary(
          item,
          readStateByConversationId.get(item.id) ?? null,
        ),
      ),
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

  async getConversation(id: string, currentUserId?: number) {
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
                    priority: true,
                    slaTargetMinutes: true,
                  },
                },
                events: {
                  orderBy: { occurredAt: 'desc' },
                  take: 10,
                  select: {
                    id: true,
                    type: true,
                    payload: true,
                    occurredAt: true,
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

    const readState =
      currentUserId != null
        ? await this.buildReadStateMap([conversation.id], currentUserId).then(
            (result) => result.get(conversation.id) ?? null,
          )
        : null

    return {
      ...this.mapConversationSummary(conversation, readState),
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
        transportEvents:
          message.inboxMessage?.events?.map((event) => ({
            id: String(event.id),
            type: this.normalizeEnum(event.type),
            payload: event.payload ?? null,
            occurredAt: event.occurredAt,
          })) ?? [],
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
        priority: true,
        slaTargetMinutes: true,
        maxAssignedConversations: true,
        assignmentMode: true,
        assignments: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            isPrimary: true,
            maxOpenConversations: true,
            user: {
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

    const diagnostics = await Promise.all(
      queues.map(async (queue) => {
        const slaTargetMinutes =
          queue.slaTargetMinutes > 0
            ? queue.slaTargetMinutes
            : this.getConversationSlaTargetMinutes()
        const slaCutoff = new Date(Date.now() - slaTargetMinutes * 60_000)
        const assignmentUserIds = queue.assignments.map(
          (assignment) => assignment.user.id,
        )
        const activeWhere: Prisma.ConversationWhereInput = {
          status: { not: ConversationStatus.CLOSED },
          messages: {
            some: {
              inboxMessage: {
                queueId: queue.id,
              },
            },
          },
        }

        const [
          conversationCount,
          waitingCustomerCount,
          unassignedCount,
          breachedSlaCount,
          oldestConversation,
          assignedOpenCount,
        ] =
          await Promise.all([
            this.prisma.conversation.count({
              where: activeWhere,
            }),
            this.prisma.conversation.count({
              where: {
                ...activeWhere,
                status: ConversationStatus.WAITING_CUSTOMER,
              },
            }),
            this.prisma.conversation.count({
              where: {
                ...activeWhere,
                assignedToUserId: null,
              },
            }),
            this.prisma.conversation.count({
              where: {
                ...activeWhere,
                lastInboundAt: {
                  lte: slaCutoff,
                },
              },
            }),
            this.prisma.conversation.findFirst({
              where: {
                ...activeWhere,
                lastInboundAt: {
                  not: null,
                },
              },
              orderBy: {
                lastInboundAt: 'asc',
              },
              select: {
                lastInboundAt: true,
              },
            }),
            assignmentUserIds.length
              ? this.prisma.conversation.count({
                  where: {
                    ...activeWhere,
                    assignedToUserId: {
                      in: assignmentUserIds,
                    },
                  },
                })
              : Promise.resolve(0),
          ])

        const configuredCapacity = queue.assignments.reduce<number | null>(
          (acc, assignment) => {
            const capacity =
              assignment.maxOpenConversations ??
              queue.maxAssignedConversations ??
              null

            if (capacity === null) {
              return null
            }

            return (acc ?? 0) + capacity
          },
          0,
        )

        return {
          id: queue.id,
          conversationCount,
          waitingCustomerCount,
          unassignedCount,
          breachedSlaCount,
          oldestInboundAt: oldestConversation?.lastInboundAt ?? null,
          assignedOpenCount,
          configuredCapacity,
          availableCapacity:
            configuredCapacity === null
              ? null
              : Math.max(configuredCapacity - assignedOpenCount, 0),
          slaTargetMinutes,
        }
      }),
    )

    const diagnosticsByQueue = new Map(
      diagnostics.map((entry) => [entry.id, entry] as const),
    )

    return queues.map((queue) => ({
      id: queue.id,
      slug: queue.slug,
      name: queue.name,
      description: queue.description,
      isActive: queue.isActive,
      conversationCount:
        diagnosticsByQueue.get(queue.id)?.conversationCount ?? 0,
      waitingCustomerCount:
        diagnosticsByQueue.get(queue.id)?.waitingCustomerCount ?? 0,
      unassignedCount:
        diagnosticsByQueue.get(queue.id)?.unassignedCount ?? 0,
      breachedSlaCount:
        diagnosticsByQueue.get(queue.id)?.breachedSlaCount ?? 0,
      oldestInboundAt:
        diagnosticsByQueue.get(queue.id)?.oldestInboundAt ?? null,
      assignedOpenCount:
        diagnosticsByQueue.get(queue.id)?.assignedOpenCount ?? 0,
      configuredCapacity:
        diagnosticsByQueue.get(queue.id)?.configuredCapacity ?? null,
      availableCapacity:
        diagnosticsByQueue.get(queue.id)?.availableCapacity ?? null,
      slaTargetMinutes:
        diagnosticsByQueue.get(queue.id)?.slaTargetMinutes ??
        this.getConversationSlaTargetMinutes(),
      priority: queue.priority,
      maxAssignedConversations: queue.maxAssignedConversations ?? null,
      assignmentMode: this.normalizeEnum(queue.assignmentMode),
      operatorCount: queue.assignments.length,
      primaryOperators: queue.assignments
        .filter((assignment) => assignment.isPrimary)
        .map((assignment) => ({
          id: assignment.user.id,
          name: assignment.user.name ?? assignment.user.email,
          email: assignment.user.email,
          maxOpenConversations:
            assignment.maxOpenConversations ??
            queue.maxAssignedConversations ??
            null,
        })),
    }))
  }

  async listContacts(query: ListConversationContactsDto, actorUserId: number) {
    const search = query.search?.trim() || ''
    const limit = query.limit ?? 20
    const normalizedSearch = search.toLowerCase()

    const [customers, internalConversation] = await Promise.all([
      this.prisma.customer.findMany({
        where: search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phoneNumber: { contains: search, mode: 'insensitive' } },
              ],
            }
          : undefined,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
        },
      }),
      this.prisma.conversation.findFirst({
        where: {
          scope: ConversationScope.ADMIN_INTERNAL,
          externalUserId: `admin:${actorUserId}`,
          status: { not: ConversationStatus.CLOSED },
          metadata: {
            path: ['contactKey'],
            equals: INTERNAL_ASSISTANT_CONTACT_KEY,
          },
        },
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          updatedAt: true,
        },
      }),
    ])

    const customerIds = customers.map((customer) => customer.id)
    const customerConversations = customerIds.length
      ? await this.prisma.conversation.findMany({
          where: {
            customerId: { in: customerIds },
            scope: {
              in: [
                ConversationScope.CUSTOMER_PUBLIC,
                ConversationScope.CUSTOMER_AUTHENTICATED,
              ],
            },
            status: { not: ConversationStatus.CLOSED },
          },
          orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
          select: {
            id: true,
            customerId: true,
            channel: true,
            lastMessageAt: true,
            updatedAt: true,
          },
        })
      : []

    const latestConversationByCustomer = new Map<
      number,
      {
        id: string
        channel: ConversationChannel
        lastMessageAt: Date | null
        updatedAt: Date
      }
    >()

    for (const conversation of customerConversations) {
      if (!conversation.customerId) {
        continue
      }

      if (!latestConversationByCustomer.has(conversation.customerId)) {
        latestConversationByCustomer.set(conversation.customerId, {
          id: conversation.id,
          channel: conversation.channel,
          lastMessageAt: conversation.lastMessageAt,
          updatedAt: conversation.updatedAt,
        })
      }
    }

    const internalMatches =
      !normalizedSearch ||
      INTERNAL_ASSISTANT_CONTACT_ALIASES.some((alias) =>
        alias.toLowerCase().includes(normalizedSearch),
      )

    return {
      items: [
        ...(internalMatches
          ? [
              {
                key: INTERNAL_ASSISTANT_CONTACT_KEY,
                kind: 'internal' as const,
                label: INTERNAL_ASSISTANT_CONTACT_LABEL,
                description: 'Chat interno con IA operativa',
                email: null,
                phoneNumber: null,
                channel: 'admin_chat' as const,
                conversationId: internalConversation?.id ?? null,
                hasDeliveryChannel: true,
                updatedAt: internalConversation?.updatedAt ?? null,
              },
            ]
          : []),
        ...customers.map((customer) => {
          const latestConversation = latestConversationByCustomer.get(customer.id)
          const preferredChannel =
            customer.email?.trim() ? 'email' : latestConversation?.channel
          return {
            key: `customer:${customer.id}`,
            kind: 'customer' as const,
            customerId: customer.id,
            label: customer.name || customer.email || `Cliente ${customer.id}`,
            description: customer.email || customer.phoneNumber || 'Sin canal configurado',
            email: customer.email ?? null,
            phoneNumber: customer.phoneNumber ?? null,
            channel: preferredChannel
              ? this.normalizeEnum(preferredChannel)
              : null,
            conversationId: latestConversation?.id ?? null,
            hasDeliveryChannel: Boolean(customer.email?.trim()),
            updatedAt:
              latestConversation?.lastMessageAt ??
              latestConversation?.updatedAt ??
              null,
          }
        }),
      ],
    }
  }

  async createAdminInternalSession(
    input: CreateAdminInternalSessionDto,
    actorUserId: number,
    actorUser?:
      | {
          role?: string | null
          authority?: string[] | null
          capabilityGroups?: string[] | null
          directCapabilities?: string[] | null
          capabilityEnvelope?: string[] | null
        }
      | null,
  ) {
    const conversationRole = this.resolveAdminConversationRole(actorUser)
    const normalizedSubject = input.subject.trim()
    const reuseInternalAssistant = isInternalAssistantSubject(normalizedSubject)
    const conversation =
      (reuseInternalAssistant
        ? await this.findAdminInternalAssistantConversation(actorUserId)
        : null) ??
      (await this.createAdminInternalConversationRecord({
        tenantKey: this.resolveTenantKey(input.tenantKey),
        actorUserId,
        conversationRole,
        subject: normalizedSubject,
        contactKey: reuseInternalAssistant ? INTERNAL_ASSISTANT_CONTACT_KEY : undefined,
        contactLabel: reuseInternalAssistant
          ? INTERNAL_ASSISTANT_CONTACT_LABEL
          : undefined,
      }))

    return this.replyAsOperator(
      conversation.id,
      {
        body: input.message.trim(),
        kind: 'text',
      },
      actorUserId,
    )
  }

  async startConversationFromContact(
    input: StartContactConversationDto,
    actorUserId: number,
    actorUser?:
      | {
          role?: string | null
          authority?: string[] | null
          capabilityGroups?: string[] | null
          directCapabilities?: string[] | null
          capabilityEnvelope?: string[] | null
        }
      | null,
  ) {
    if (input.contactType === 'internal') {
      const conversationRole = this.resolveAdminConversationRole(actorUser)
      const conversation =
        (await this.findAdminInternalAssistantConversation(actorUserId)) ??
        (await this.createAdminInternalConversationRecord({
          tenantKey: this.resolveTenantKey(input.tenantKey),
          actorUserId,
          conversationRole,
          subject: INTERNAL_ASSISTANT_CONTACT_LABEL,
          contactKey: INTERNAL_ASSISTANT_CONTACT_KEY,
          contactLabel: INTERNAL_ASSISTANT_CONTACT_LABEL,
        }))

      const message = input.message?.trim()
      if (!message) {
        return this.getConversation(conversation.id, actorUserId)
      }

      return this.replyAsOperator(
        conversation.id,
        {
          body: message,
          kind: 'text',
        },
        actorUserId,
      )
    }

    if (!input.customerId) {
      throw new BadRequestException('conversation.customerRequired')
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
      },
    })

    if (!customer) {
      throw new NotFoundException('conversation.customerNotFound')
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        customerId: customer.id,
        scope: {
          in: [
            ConversationScope.CUSTOMER_PUBLIC,
            ConversationScope.CUSTOMER_AUTHENTICATED,
          ],
        },
        status: { not: ConversationStatus.CLOSED },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      select: { id: true },
    })

    if (!conversation) {
      const emailInbox = customer.email?.trim()
        ? await this.prisma.inboxAccount.findFirst({
            where: {
              active: true,
              channel: InboxChannelType.EMAIL,
            },
            orderBy: [{ updatedAt: 'desc' }],
            select: { id: true },
          })
        : null

      const channel = emailInbox
        ? ConversationChannel.EMAIL
        : ConversationChannel.ADMIN_CHAT

      conversation = await this.prisma.conversation.create({
        data: {
          tenantKey:
            input.tenantKey?.trim() ||
            this.config.get<string>('CLIENT_SLUG') ||
            'default',
          scope: ConversationScope.CUSTOMER_PUBLIC,
          conversationRole: 'CUSTOMER_PUBLIC' as ConversationRole,
          channel,
          status: ConversationStatus.OPEN,
          controlMode: ConversationControlMode.HUMAN,
          subject: customer.name || customer.email || `Cliente ${customer.id}`,
          customerId: customer.id,
          inboxAccountId: emailInbox?.id ?? null,
          assignedToUserId: actorUserId,
          externalUserId:
            customer.email?.trim().toLowerCase() || `customer:${customer.id}`,
          externalThreadId:
            customer.email?.trim().toLowerCase()
              ? `email:${customer.email.trim().toLowerCase()}`
              : `customer:${customer.id}`,
          externalChannelRef: customer.email?.trim() || null,
          metadata: {
            source: 'admin-contact-start',
            contactKey: `customer:${customer.id}`,
            missingDeliveryChannel: emailInbox ? false : true,
          },
          participants: {
            create: {
              role: ConversationParticipantRole.CUSTOMER,
              customerId: customer.id,
              externalUserId:
                customer.email?.trim().toLowerCase() || `customer:${customer.id}`,
              displayName:
                customer.name || customer.email || `Cliente ${customer.id}`,
              metadata: {
                email: customer.email ?? null,
                phoneNumber: customer.phoneNumber ?? null,
              },
            },
          },
        },
        select: { id: true },
      })
    }

    const message = input.message?.trim()
    if (!message) {
      return this.getConversation(conversation.id, actorUserId)
    }

    return this.replyAsOperator(
      conversation.id,
      {
        body: message,
        kind: 'text',
      },
      actorUserId,
    )
  }

  private async findAdminInternalAssistantConversation(actorUserId: number) {
    return this.prisma.conversation.findFirst({
      where: {
        scope: ConversationScope.ADMIN_INTERNAL,
        externalUserId: `admin:${actorUserId}`,
        status: { not: ConversationStatus.CLOSED },
        metadata: {
          path: ['contactKey'],
          equals: INTERNAL_ASSISTANT_CONTACT_KEY,
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
      },
    })
  }

  private async createAdminInternalConversationRecord(input: {
    tenantKey: string
    actorUserId: number
    conversationRole: AiConversationRole
    subject: string
    contactKey?: string
    contactLabel?: string
  }) {
    return this.prisma.conversation.create({
      data: {
        tenantKey: input.tenantKey,
        scope: ConversationScope.ADMIN_INTERNAL,
        conversationRole: this.mapConversationRoleEnum(input.conversationRole),
        channel: ConversationChannel.ADMIN_CHAT,
        status: ConversationStatus.WAITING_INTERNAL,
        controlMode: ConversationControlMode.AI,
        subject: input.subject,
        assignedToUserId: input.actorUserId,
        externalUserId: `admin:${input.actorUserId}`,
        externalThreadId: `admin-chat:${randomUUID()}`,
        metadata: {
          source: 'admin-internal',
          contactKey: input.contactKey ?? null,
          contactLabel: input.contactLabel ?? null,
        },
        participants: {
          create: {
            role: ConversationParticipantRole.OPERATOR,
            userId: input.actorUserId,
            displayName: input.contactLabel || 'Operador interno',
          },
        },
      },
      select: {
        id: true,
      },
    })
  }

  async createWebchatSession(input: CreateWebchatSessionDto) {
    const tenantKey = this.resolveTenantKey(input.tenantKey)

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
    const conversationRole = resolveAiConversationRole({
      session: {
        authenticated: Boolean(input.authenticated),
      },
    })
    const scope = this.mapConversationScopeFromRole(conversationRole)

    const conversation = await this.prisma.conversation.create({
      data: {
        tenantKey,
        scope,
        conversationRole: this.mapConversationRoleEnum(conversationRole),
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

    return this.buildWebchatSessionResponse({
      id: conversation.id,
      tenantKey,
      scope,
      conversationRole: this.mapConversationRoleEnum(conversationRole),
      controlMode: ConversationControlMode.AI,
      needsHuman: false,
      metadata: {
        locale: input.locale?.trim() || 'es-UY',
        page: input.page?.trim() || null,
      },
      participants: [
        {
          role: ConversationParticipantRole.CUSTOMER,
          externalUserId: guestId,
          displayName: input.name?.trim() || customer?.name || null,
          metadata: {
            email,
            locale: input.locale?.trim() || 'es-UY',
          },
          customer: customer
            ? {
                id: customer.id,
                name: customer.name,
                email: customer.email,
              }
            : null,
        },
      ],
      messages: [],
    })
  }

  private resolveTenantKey(value?: string | null) {
    return value?.trim() || this.config.get<string>('CLIENT_SLUG') || 'default'
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
            metadata: true,
            payload: true,
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

    return this.buildWebchatSessionResponse({
      ...conversation,
      participants: conversation.participants.map((entry) =>
        entry.role === ConversationParticipantRole.CUSTOMER &&
        guestId &&
        !entry.externalUserId
          ? {
              ...entry,
              externalUserId: guestId,
            }
          : entry,
      ),
    })
  }

  private buildWebchatSessionResponse(conversation: {
    id: string
    tenantKey: string
    scope: ConversationScope
    conversationRole: ConversationRole | null
    controlMode: ConversationControlMode
    needsHuman?: boolean | null
    metadata?: Prisma.JsonValue | null
    participants: Array<{
      role: ConversationParticipantRole
      externalUserId?: string | null
      displayName?: string | null
      metadata?: Prisma.JsonValue | null
      customer?: {
        id?: number | null
        name?: string | null
        email?: string | null
      } | null
    }>
    messages: Array<{
      id: string
      authorType: ConversationMessageAuthorType
      kind: ConversationMessageKind
      body?: string | null
      normalizedText?: string | null
      metadata?: Prisma.JsonValue | null
      payload?: Prisma.JsonValue | null
      createdAt: Date
    }>
  }) {
    const participant = conversation.participants.find(
      (entry) => entry.role === ConversationParticipantRole.CUSTOMER,
    )
    const participantMetadata = this.asRecord(participant?.metadata)
    const conversationMetadata = this.asRecord(conversation.metadata)
    const aiState = this.extractConversationAiState(conversation.metadata)

    return {
      sessionId: conversation.id,
      conversationId: conversation.id,
      tenantKey: conversation.tenantKey,
      scope: this.normalizeEnum(conversation.scope) as
        | 'customer_public'
        | 'customer_authenticated',
      role: this.normalizeConversationRoleValue(
        conversation.conversationRole,
        conversation.scope,
      ),
      channel: 'webchat' as const,
      controlMode: this.normalizeEnum(conversation.controlMode) as
        | 'ai'
        | 'human'
        | 'hybrid',
      needsHuman: Boolean(conversation.needsHuman || aiState?.needsHuman),
      aiState,
      participant: {
        guestId: participant?.externalUserId || 'guest',
        name: participant?.displayName ?? participant?.customer?.name ?? null,
        email:
          (typeof participantMetadata?.email === 'string'
            ? participantMetadata.email
            : null) ??
          participant?.customer?.email ??
          null,
        locale:
          typeof participantMetadata?.locale === 'string'
            ? participantMetadata.locale
            : 'es-UY',
      },
      context: {
        page:
          typeof conversationMetadata?.page === 'string'
            ? conversationMetadata.page
            : null,
      },
      messages: conversation.messages
        .filter(
          (message) =>
            message.authorType === ConversationMessageAuthorType.CUSTOMER ||
            message.authorType === ConversationMessageAuthorType.AGENT ||
            message.authorType === ConversationMessageAuthorType.OPERATOR,
        )
        .map((message) => {
          const payload = this.asRecord(message.payload)
          const metadata = this.asRecord(message.metadata)
          const rawAttachments =
            Array.isArray(payload?.attachments) && payload?.attachments.length > 0
              ? payload.attachments
              : Array.isArray(metadata?.attachments) && metadata?.attachments.length > 0
                ? metadata.attachments
                : []

          return {
            id: message.id,
            role:
              message.authorType === ConversationMessageAuthorType.CUSTOMER
                ? 'customer'
                : 'agent',
            kind: this.normalizeEnum(message.kind),
            text: message.body ?? message.normalizedText ?? '',
            createdAt: message.createdAt,
            attachments: rawAttachments
              .map((entry) => this.asRecord(entry))
              .filter((entry): entry is Record<string, unknown> => Boolean(entry))
              .map((entry) => ({
                assetType:
                  typeof entry.assetType === 'string' ? entry.assetType : null,
                fileName:
                  typeof entry.fileName === 'string' ? entry.fileName : null,
                contentType:
                  typeof entry.contentType === 'string'
                    ? entry.contentType
                    : null,
                textContent:
                  typeof entry.textContent === 'string'
                    ? entry.textContent
                    : null,
              })),
          }
        }),
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

    const attachments = this.normalizeConversationAttachments(input.attachments)
    const normalizedText =
      input.text?.trim() || this.buildAttachmentSummary(attachments)

    if (!normalizedText) {
      throw new BadRequestException('conversation.webchatMessageContentRequired')
    }

    const message = await this.prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        authorType: ConversationMessageAuthorType.CUSTOMER,
        kind: ConversationMessageKind.TEXT,
        body: normalizedText,
        normalizedText,
        metadata: this.toJsonValue({
          source: 'webchat',
          guestId: input.guestId?.trim() || conversation.externalUserId || null,
          hasAttachments: attachments.length > 0,
          attachments: attachments.length > 0 ? attachments : null,
        }),
        payload:
          attachments.length > 0
            ? this.toJsonValue({
                attachments,
              })
            : Prisma.JsonNull,
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
    const attachments = this.normalizeConversationAttachments(input.attachments)
    const normalizedText =
      input.text?.trim() ||
      input.subject?.trim() ||
      this.buildAttachmentSummary(attachments) ||
      ''
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
      const autoAssignedUserId = await this.resolveAutoAssignedUserId(tx, queue)
      let createdConversation = false

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

      const previousAssignedToUserId = conversation?.assignedToUserId ?? null

      if (!conversation) {
        createdConversation = true
        conversation = await tx.conversation.create({
          data: {
            tenantKey,
            scope: ConversationScope.CUSTOMER_PUBLIC,
            conversationRole: 'CUSTOMER_PUBLIC' as ConversationRole,
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
            assignedToUserId: autoAssignedUserId,
          },
        })
      } else {
        conversation = await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            customerId: conversation.customerId ?? customer?.id ?? null,
            inboxAccountId: conversation.inboxAccountId ?? inboxAccount?.id ?? null,
            subject: conversation.subject ?? input.subject?.trim() ?? null,
            assignedToUserId:
              conversation.assignedToUserId ?? autoAssignedUserId ?? null,
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
                metadata: this.toJsonValue({
                  source: 'channel-adapter',
                  hasAttachments: attachments.length > 0,
                  attachments: attachments.length > 0 ? attachments : null,
                  ...(input.metadata ?? {}),
                }),
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
          payload: this.toJsonValue({
            subject: input.subject?.trim() || null,
            attachments: attachments.length > 0 ? attachments : null,
          }),
          metadata: this.toJsonValue({
            source: 'channel-adapter',
            channel: input.channel,
            hasAttachments: attachments.length > 0,
            attachments: attachments.length > 0 ? attachments : null,
            ...(input.metadata ?? {}),
          }),
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

      if (autoAssignedUserId && (createdConversation || !previousAssignedToUserId)) {
        await tx.conversationHandoffEvent.create({
          data: {
            conversationId: conversation.id,
            type: ConversationHandoffEventType.ASSIGNED,
            notes: 'Auto-assigned from queue rules',
            metadata: {
              assignedToUserId: autoAssignedUserId,
              assignmentSource: 'queue-auto-assign',
              queueSlug: queue.slug,
            },
          },
        })
      }

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

    return this.getConversation(id, actorUserId)
  }

  async releaseConversation(
    id: string,
    actorUserId: number,
    input: ConversationHandoffDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id },
        select: { id: true, controlMode: true, metadata: true },
      })

      if (!conversation) {
        throw new NotFoundException('conversation.notFound')
      }

      await tx.conversation.update({
        where: { id },
        data: {
          controlMode: ConversationControlMode.AI,
          assignedToUserId: null,
          needsHuman: false,
          metadata: {
            ...(this.asRecord(conversation.metadata) ?? {}),
            aiState: {
              ...(this.asRecord(this.asRecord(conversation.metadata)?.aiState) ?? {}),
              needsHuman: false,
              fallbackReason: null,
              updatedAt: new Date().toISOString(),
            },
          },
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

    return this.getConversation(id, actorUserId)
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

    return this.getConversation(id, actorUserId)
  }

  async rerouteConversation(
    id: string,
    input: RerouteConversationDto,
    actorUserId: number,
  ) {
    const nextQueueSlug = input.queueSlug?.trim().toLowerCase() || null

    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id },
        include: {
          messages: {
            where: {
              inboxMessageId: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              inboxMessageId: true,
            },
          },
        },
      })

      if (!conversation) {
        throw new NotFoundException('conversation.notFound')
      }

      const nextQueue = nextQueueSlug
        ? await tx.inboxQueue.findUnique({
            where: { slug: nextQueueSlug },
            select: {
              id: true,
              slug: true,
              name: true,
              assignmentMode: true,
              maxAssignedConversations: true,
              assignments: {
                where: { isActive: true },
                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
                select: {
                  id: true,
                  isPrimary: true,
                  maxOpenConversations: true,
                  userId: true,
                },
              },
            },
          })
        : null

      if (nextQueueSlug && !nextQueue) {
        throw new NotFoundException('conversation.queueNotFound')
      }

      const nextAssignedUserId =
        input.userId ??
        (nextQueue ? await this.resolveAutoAssignedUserId(tx, nextQueue) : null) ??
        conversation.assignedToUserId

      if (nextQueue) {
        const inboxMessageIds = conversation.messages
          .map((message) => message.inboxMessageId)
          .filter((value): value is string => Boolean(value))

        if (inboxMessageIds.length) {
          await tx.inboxMessage.updateMany({
            where: { id: { in: inboxMessageIds } },
            data: { queueId: nextQueue.id },
          })
        }
      }

      await tx.conversation.update({
        where: { id },
        data: {
          assignedToUserId: nextAssignedUserId ?? null,
          metadata: {
            ...(this.asRecord(conversation.metadata) ?? {}),
            queueSlug:
              nextQueue?.slug ??
              this.asRecord(conversation.metadata)?.queueSlug ??
              null,
            routingOverrideByUserId: actorUserId,
            routingOverrideAt: new Date().toISOString(),
          },
        },
      })

      await tx.conversationHandoffEvent.create({
        data: {
          conversationId: id,
          type: ConversationHandoffEventType.ASSIGNED,
          actorUserId,
          notes: input.notes?.trim() || 'Supervisor override applied',
          metadata: {
            assignedToUserId: nextAssignedUserId ?? null,
            queueSlug: nextQueue?.slug ?? null,
            assignmentSource: input.userId ? 'supervisor-manual' : 'supervisor-routing',
          },
        },
      })
    })

    return this.getConversation(id, actorUserId)
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

      await tx.conversationReadState.upsert({
        where: {
          conversationId_userId: {
            conversationId: id,
            userId: actorUserId,
          },
        },
        update: {
          lastReadAt: message.createdAt,
          manualUnread: false,
        },
        create: {
          conversationId: id,
          userId: actorUserId,
          lastReadAt: message.createdAt,
          manualUnread: false,
        },
      })
    })

    if (conversation.scope === ConversationScope.ADMIN_INTERNAL) {
      await this.respondToAdminInternalMessage(conversation, actorUserId, input.body)
    }

    return this.getConversation(id, actorUserId)
  }

  async replyAsAgent(id: string, input: AgentReplyDto) {
    const conversation = await this.requireConversationForOutbound(id)
    const outbound = await this.dispatchOutboundMessage(
      conversation,
      input.body,
      'ai-agent-service',
      input.metadata ?? undefined,
    )
    const groundingState = this.normalizeGroundingState(
      input.grounding,
      input.needsHuman ?? false,
      input.metadata ?? undefined,
    )
    const nextControlMode =
      input.needsHuman && this.isCustomerFacingScope(conversation.scope)
        ? ConversationControlMode.HUMAN
        : ConversationControlMode.AI
    const nextStatus =
      input.needsHuman && this.isCustomerFacingScope(conversation.scope)
        ? ConversationStatus.WAITING_INTERNAL
        : ConversationStatus.WAITING_CUSTOMER
    const currentRole = this.normalizeConversationRoleValue(
      conversation.conversationRole,
      conversation.scope,
    )
    const metadataRecord = this.asRecord(input.metadata)
    const metadataRole =
      typeof metadataRecord?.aiRole === 'string'
        ? metadataRecord.aiRole
        : currentRole
    const auditEvent = this.normalizeAiAuditEvent(input.audit, {
      role: currentRole,
      intentKey:
        typeof metadataRecord?.aiMemory === 'object'
          ? (this.asRecord(metadataRecord?.aiMemory)?.intentKey as
              | string
              | undefined)
          : undefined,
      taskChanged:
        typeof metadataRecord?.aiMemory === 'object'
          ? Boolean(this.asRecord(metadataRecord?.aiMemory)?.resetApplied)
          : false,
      fallbackReason: groundingState.fallbackReason,
    })

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
            ai: groundingState,
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
          controlMode: nextControlMode,
          needsHuman: Boolean(input.needsHuman),
          lastMessageAt: message.createdAt,
          lastOutboundAt: message.createdAt,
          status: nextStatus,
          metadata: this.toJsonValue({
            ...(this.asRecord(conversation.metadata) ?? {}),
            aiState: {
              ...groundingState,
              role: metadataRole,
              audit: auditEvent,
              updatedAt: message.createdAt.toISOString(),
            },
            aiAuditLog: this.appendAiAuditLog(
              this.asRecord(conversation.metadata)?.aiAuditLog,
              auditEvent,
            ),
          }),
        },
      })

      if (input.needsHuman && this.isCustomerFacingScope(conversation.scope)) {
        await tx.conversationHandoffEvent.create({
          data: {
            conversationId: id,
            type: ConversationHandoffEventType.AI_SUGGEST_ONLY,
            previousMode: conversation.controlMode,
            nextMode: ConversationControlMode.HUMAN,
            notes:
              groundingState.fallbackReason ||
              'AI escalation due to missing approved grounding',
            metadata: {
              reason: 'needs_human_fallback',
              grounding: groundingState,
            },
          },
        })
      }
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

  async markConversationRead(id: string, userId: number) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: { id: true, lastMessageAt: true },
    })

    if (!conversation) {
      throw new NotFoundException('conversation.notFound')
    }

    await this.upsertConversationReadState(id, userId, {
      lastReadAt: conversation.lastMessageAt ?? new Date(),
      manualUnread: false,
    })

    return this.getConversation(id, userId)
  }

  async markConversationUnread(id: string, userId: number) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: { id: true, lastMessageAt: true },
    })

    if (!conversation) {
      throw new NotFoundException('conversation.notFound')
    }

    await this.upsertConversationReadState(id, userId, {
      lastReadAt: conversation.lastMessageAt ?? null,
      manualUnread: true,
    })

    return this.getConversation(id, userId)
  }

  async pinConversation(id: string, actorUserId: number) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!conversation) {
      throw new NotFoundException('conversation.notFound')
    }

    await this.prisma.conversation.update({
      where: { id },
      data: {
        pinnedAt: new Date(),
      },
    })

    return this.getConversation(id, actorUserId)
  }

  async unpinConversation(id: string, actorUserId: number) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!conversation) {
      throw new NotFoundException('conversation.notFound')
    }

    await this.prisma.conversation.update({
      where: { id },
      data: {
        pinnedAt: null,
      },
    })

    return this.getConversation(id, actorUserId)
  }

  private async upsertConversationReadState(
    conversationId: string,
    userId: number,
    data: {
      lastReadAt: Date | null
      manualUnread: boolean
    },
  ) {
    await this.prisma.conversationReadState.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      update: {
        lastReadAt: data.lastReadAt,
        manualUnread: data.manualUnread,
      },
      create: {
        conversationId,
        userId,
        lastReadAt: data.lastReadAt,
        manualUnread: data.manualUnread,
      },
    })
  }

  private async buildReadStateMap(
    conversationIds: string[],
    currentUserId?: number,
  ) {
    const readStateMap = new Map<string, ConversationReadStateSummary>()

    if (!currentUserId || conversationIds.length === 0) {
      return readStateMap
    }

    const readStates = await this.prisma.conversationReadState.findMany({
      where: {
        userId: currentUserId,
        conversationId: { in: conversationIds },
      },
      select: {
        conversationId: true,
        lastReadAt: true,
        manualUnread: true,
      },
    })

    const readStateById = new Map(
      readStates.map((state) => [state.conversationId, state] as const),
    )

    const unreadCounts = await Promise.all(
      conversationIds.map(async (conversationId) => {
        const readState = readStateById.get(conversationId)
        const unreadCount = await this.prisma.conversationMessage.count({
          where: {
            conversationId,
            ...(readState?.lastReadAt
              ? {
                  createdAt: {
                    gt: readState.lastReadAt,
                  },
                }
              : {}),
            NOT: {
              authorUserId: currentUserId,
            },
          },
        })

        return {
          conversationId,
          unreadCount,
          readState,
        }
      }),
    )

    unreadCounts.forEach(({ conversationId, unreadCount, readState }) => {
      const effectiveUnreadCount = readState?.manualUnread
        ? Math.max(unreadCount, 1)
        : unreadCount

      readStateMap.set(conversationId, {
        lastReadAt: readState?.lastReadAt ?? null,
        manualUnread: readState?.manualUnread ?? false,
        unreadCount: effectiveUnreadCount,
        isRead: effectiveUnreadCount === 0,
      })
    })

    return readStateMap
  }

  private mapConversationSummary(
    conversation: {
      id: string
      tenantKey: string
      scope: ConversationScope
      conversationRole?: ConversationRole | null
      channel: ConversationChannel
      status: ConversationStatus
      controlMode: ConversationControlMode
      subject: string | null
      externalUserId: string | null
      externalThreadId: string | null
      externalChannelRef: string | null
      pinnedAt: Date | null
      lastMessageAt: Date | null
      lastInboundAt: Date | null
      lastOutboundAt: Date | null
      createdAt: Date
      updatedAt: Date
      metadata: Prisma.JsonValue | null
      needsHuman: boolean
      customer: {
        id: number
        name: string
        email: string | null
        phoneNumber: string | null
      } | null
      assignedToUser: {
        id: number
        name: string | null
        email: string
      } | null
      inboxAccount: {
        id: string
        displayName: string | null
        address: string | null
        channel: InboxChannelType
      } | null
      participants: Array<{
        id: string
        role: ConversationParticipantRole
        displayName: string | null
        externalUserId: string | null
        customer: {
          id: number
          name: string
          email: string | null
        } | null
        user: {
          id: number
          name: string | null
          email: string
        } | null
      }>
      messages: Array<{
        id: string
        authorType: ConversationMessageAuthorType
        kind: ConversationMessageKind
        body: string | null
        normalizedText: string | null
        metadata: Prisma.JsonValue | null
        createdAt: Date
        inboxMessage?: {
          queue?: {
            id: string
            slug: string
            name: string
            priority: number
            slaTargetMinutes: number
          } | null
        } | null
      }>
      toolCalls?: Array<{
        toolName: string
        status: ConversationToolCallStatus
        updatedAt: Date
      }>
    },
    readState?: ConversationReadStateSummary | null,
  ) {
    const aiState = this.extractConversationAiState(conversation.metadata)
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
    const queue = latestQueuedMessage?.inboxMessage?.queue ?? null
    const slaTargetMinutes = queue?.slaTargetMinutes ?? null
    const slaAgeMinutes =
      conversation.lastInboundAt != null
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - conversation.lastInboundAt.getTime()) / 60_000,
            ),
          )
        : null
    const isSlaBreached =
      slaTargetMinutes != null &&
      slaTargetMinutes > 0 &&
      slaAgeMinutes != null &&
      slaAgeMinutes >= slaTargetMinutes

    return {
      id: conversation.id,
      tenantKey: conversation.tenantKey,
      scope: this.normalizeEnum(conversation.scope),
      role: this.normalizeConversationRoleValue(
        conversation.conversationRole,
        conversation.scope,
      ),
      channel: this.normalizeEnum(conversation.channel),
      status: this.normalizeEnum(conversation.status),
      controlMode: this.normalizeEnum(conversation.controlMode),
      subject: conversation.subject ?? null,
      externalUserId: conversation.externalUserId ?? null,
      externalThreadId: conversation.externalThreadId ?? null,
      externalChannelRef: conversation.externalChannelRef ?? null,
      isPinned: conversation.pinnedAt != null,
      pinnedAt: conversation.pinnedAt ?? null,
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
      queue:
        queue != null
          ? {
              id: queue.id,
              slug: queue.slug,
              name: queue.name,
              priority: queue.priority,
              slaTargetMinutes: queue.slaTargetMinutes,
            }
          : null,
      operational: {
        needsAssignment: conversation.assignedToUser == null,
        isSlaBreached,
        slaAgeMinutes,
        slaTargetMinutes,
      },
      needsHuman: conversation.needsHuman || Boolean(aiState?.needsHuman),
      aiState,
      aiAudit: this.summarizeConversationToolCalls(conversation.toolCalls ?? []),
      readState: readState
        ? {
            lastReadAt: readState.lastReadAt,
            unreadCount: readState.unreadCount,
            isRead: readState.isRead,
            manualUnread: readState.manualUnread,
          }
        : {
            lastReadAt: null,
            unreadCount: 0,
            isRead: true,
            manualUnread: false,
          },
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
            metadata: latestMessage.metadata ?? null,
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
        priority: 100,
        slaTargetMinutes: this.getConversationSlaTargetMinutes(),
        assignmentMode: InboxQueueAssignmentMode.MANUAL,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        assignmentMode: true,
        maxAssignedConversations: true,
        slaTargetMinutes: true,
        assignments: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            isPrimary: true,
            maxOpenConversations: true,
            userId: true,
          },
        },
      },
    })
  }

  private async resolveAutoAssignedUserId(
    tx: Prisma.TransactionClient,
    queue:
      | {
          id: string
          slug: string
          assignmentMode: InboxQueueAssignmentMode
          maxAssignedConversations: number | null
          assignments: Array<{
            id: string
            isPrimary: boolean
            maxOpenConversations: number | null
            userId: number
          }>
        }
      | null,
  ) {
    if (!queue || queue.assignmentMode !== InboxQueueAssignmentMode.LEAST_LOADED) {
      return null
    }

    if (!queue.assignments.length) {
      return null
    }

    const loads = await Promise.all(
      queue.assignments.map(async (assignment) => {
        const openCount = await tx.conversation.count({
          where: {
            assignedToUserId: assignment.userId,
            status: { not: ConversationStatus.CLOSED },
            messages: {
              some: {
                inboxMessage: {
                  queueId: queue.id,
                },
              },
            },
          },
        })

        const capacity =
          assignment.maxOpenConversations ??
          queue.maxAssignedConversations ??
          null

        return {
          userId: assignment.userId,
          isPrimary: assignment.isPrimary,
          openCount,
          capacity,
          available: capacity === null ? true : openCount < capacity,
        }
      }),
    )

    const nextAssignee = loads
      .filter((entry) => entry.available)
      .sort((left, right) => {
        if (left.isPrimary !== right.isPrimary) {
          return left.isPrimary ? -1 : 1
        }
        if (left.openCount !== right.openCount) {
          return left.openCount - right.openCount
        }
        return left.userId - right.userId
      })[0]

    return nextAssignee?.userId ?? null
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
        role: this.normalizeConversationRoleValue(
          conversation.conversationRole,
          conversation.scope,
        ),
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
        aiMemory: payload.response.memory ?? null,
        aiRole: payload.response.role ?? null,
        aiAudit: payload.response.audit ?? null,
      },
      toolCalls: payload.response.toolCalls ?? [],
      needsHuman: payload.response.needsHuman ?? false,
      grounding: payload.response.grounding ?? null,
      audit: payload.response.audit ?? null,
    })
  }

  private extractConversationAiState(metadata: unknown) {
    const root = this.asRecord(metadata)
    const state = this.asRecord(root?.aiState)
    if (!state) {
      return null
    }

    const sources = Array.isArray(state.sources)
      ? state.sources
          .map((entry) => this.asRecord(entry))
          .filter((entry): entry is Record<string, unknown> => Boolean(entry))
          .map((entry) => ({
            id: typeof entry.id === 'string' ? entry.id : null,
            title: typeof entry.title === 'string' ? entry.title : null,
            scope: typeof entry.scope === 'string' ? entry.scope : null,
            sourceType:
              typeof entry.sourceType === 'string' ? entry.sourceType : null,
            score:
              typeof entry.score === 'number' && Number.isFinite(entry.score)
                ? entry.score
                : null,
          }))
      : []

    return {
      needsHuman: Boolean(state.needsHuman),
      grounded: Boolean(state.grounded),
      role: typeof state.role === 'string' ? state.role : null,
      fallbackReason:
        typeof state.fallbackReason === 'string' ? state.fallbackReason : null,
      sourceCount:
        typeof state.sourceCount === 'number' && Number.isFinite(state.sourceCount)
          ? state.sourceCount
          : sources.length,
      sources,
      memory: this.extractConversationAiMemoryState(state.memory),
      audit: this.extractConversationAiAuditState(state.audit),
      updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : null,
    }
  }

  private extractConversationAiMemoryState(memory: unknown) {
    const state = this.asRecord(memory)
    if (!state) {
      return null
    }

    return {
      taskId: typeof state.taskId === 'string' ? state.taskId : null,
      intentKey: typeof state.intentKey === 'string' ? state.intentKey : null,
      taskSummary:
        typeof state.taskSummary === 'string' ? state.taskSummary : null,
      resetApplied: Boolean(state.resetApplied),
      resetCount:
        typeof state.resetCount === 'number' && Number.isFinite(state.resetCount)
          ? state.resetCount
          : 0,
      lastResetAt:
        typeof state.lastResetAt === 'string' ? state.lastResetAt : null,
      historyTurnCount:
        typeof state.historyTurnCount === 'number' &&
        Number.isFinite(state.historyTurnCount)
          ? state.historyTurnCount
          : 0,
      currentTask: this.extractConversationCurrentTask(state.currentTask),
    }
  }

  private extractConversationCurrentTask(task: unknown) {
    const state = this.asRecord(task)
    if (!state) {
      return null
    }

    return {
      intentKey: typeof state.intentKey === 'string' ? state.intentKey : null,
      status: typeof state.status === 'string' ? state.status : null,
      lastUpdate: typeof state.lastUpdate === 'string' ? state.lastUpdate : null,
      entities: Array.isArray(state.entities)
        ? state.entities
            .map((entry) => this.asRecord(entry))
            .filter((entry): entry is Record<string, unknown> => Boolean(entry))
            .map((entry) => ({
              type: typeof entry.type === 'string' ? entry.type : null,
              value: typeof entry.value === 'string' ? entry.value : null,
            }))
        : [],
    }
  }

  private extractConversationAiAuditState(audit: unknown) {
    const state = this.asRecord(audit)
    if (!state) {
      return null
    }

    return {
      role: typeof state.role === 'string' ? state.role : null,
      intentKey: typeof state.intentKey === 'string' ? state.intentKey : null,
      blockedTools: Array.isArray(state.blockedTools)
        ? state.blockedTools
            .filter((entry): entry is string => typeof entry === 'string')
        : [],
      executedTools: Array.isArray(state.executedTools)
        ? state.executedTools
            .filter((entry): entry is string => typeof entry === 'string')
        : [],
      fallbackActivated: Boolean(state.fallbackActivated),
      taskChanged: Boolean(state.taskChanged),
      createdAt: typeof state.createdAt === 'string' ? state.createdAt : null,
    }
  }

  private summarizeConversationToolCalls(
    toolCalls: Array<{
      toolName?: string | null
      status?: ConversationToolCallStatus | null
      updatedAt?: Date | null
    }>,
  ) {
    if (!toolCalls.length) {
      return {
        total: 0,
        search: 0,
        state: 0,
        parser: 0,
        crud: 0,
        latestToolName: null,
        latestStatus: null,
        updatedAt: null,
      }
    }

    const summary = {
      total: 0,
      search: 0,
      state: 0,
      parser: 0,
      crud: 0,
      latestToolName: toolCalls[0]?.toolName ?? null,
      latestStatus: toolCalls[0]?.status ? this.normalizeEnum(toolCalls[0].status) : null,
      updatedAt: toolCalls[0]?.updatedAt ?? null,
    }

    for (const toolCall of toolCalls) {
      if (!toolCall.toolName) {
        continue
      }
      summary.total += 1
      if (toolCall.toolName.startsWith('search_')) {
        summary.search += 1
      } else if (
        [
          'update_order_status',
          'update_quote_status',
          'update_payment_status',
          'send_quote',
          'confirm_quote',
        ].includes(toolCall.toolName)
      ) {
        summary.state += 1
      } else if (toolCall.toolName === 'parse_aberturas') {
        summary.parser += 1
      } else {
        summary.crud += 1
      }
    }

    return summary
  }

  private normalizeGroundingState(
    grounding: Record<string, unknown> | undefined,
    needsHuman: boolean,
    metadata?: Record<string, unknown>,
  ) {
    const input = this.asRecord(grounding) ?? {}
    const rawSources = Array.isArray(input.sources) ? input.sources : []
    const sources = rawSources
      .map((entry) => this.asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .map((entry) => ({
        id: typeof entry.id === 'string' ? entry.id : null,
        title: typeof entry.title === 'string' ? entry.title : null,
        scope: typeof entry.scope === 'string' ? entry.scope : null,
        sourceType:
          typeof entry.sourceType === 'string' ? entry.sourceType : null,
        score:
          typeof entry.score === 'number' && Number.isFinite(entry.score)
            ? entry.score
            : null,
      }))

    const sourceCount =
      typeof input.sourceCount === 'number' && Number.isFinite(input.sourceCount)
        ? input.sourceCount
        : sources.length

    const memory = this.extractConversationAiMemoryState(metadata?.aiMemory)

    return {
      needsHuman,
      grounded:
        typeof input.grounded === 'boolean' ? input.grounded : sourceCount > 0,
      fallbackReason:
        typeof input.fallbackReason === 'string'
          ? input.fallbackReason
          : needsHuman
            ? 'missing_approved_context'
            : null,
      sourceCount,
      sources,
      memory,
      provider:
        typeof metadata?.provider === 'string' ? metadata.provider : null,
      model: typeof metadata?.model === 'string' ? metadata.model : null,
    }
  }

  private isCustomerFacingScope(scope: ConversationScope) {
    return (
      scope === ConversationScope.CUSTOMER_PUBLIC ||
      scope === ConversationScope.CUSTOMER_AUTHENTICATED
    )
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

  private normalizeConversationAttachments(
    input: Array<{
      assetType?: string | null
      fileName?: string | null
      contentType?: string | null
      content?: string | null
      textContent?: string | null
      metadata?: Record<string, unknown> | null
    }> | null | undefined,
  ) {
    return (Array.isArray(input) ? input : [])
      .map((attachment) => ({
        assetType: attachment?.assetType?.trim() || null,
        fileName: attachment?.fileName?.trim() || null,
        contentType: attachment?.contentType?.trim() || null,
        content: attachment?.content?.trim() || null,
        textContent: attachment?.textContent?.trim() || null,
        metadata: this.asRecord(attachment?.metadata) ?? null,
      }))
      .filter(
        (attachment) =>
          attachment.assetType ||
          attachment.fileName ||
          attachment.contentType ||
          attachment.content ||
          attachment.textContent ||
          attachment.metadata,
      )
  }

  private buildAttachmentSummary(
    attachments: Array<{
      assetType?: string | null
      fileName?: string | null
      contentType?: string | null
      textContent?: string | null
    }>,
  ) {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return ''
    }

    return attachments
      .slice(0, 6)
      .map((attachment) => {
        const label =
          attachment.fileName ||
          attachment.assetType ||
          attachment.contentType ||
          'adjunto'
        const hint = attachment.textContent?.trim()
        return hint
          ? `[Adjunto: ${label}] ${hint.slice(0, 180)}`
          : `[Adjunto: ${label}]`
      })
      .join('\n')
      .trim()
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

  private getConversationSlaTargetMinutes() {
    const raw =
      this.config.get<number>('CONVERSATION_SLA_MINUTES') ??
      this.config.get<string>('CONVERSATION_SLA_MINUTES') ??
      30
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30
  }

  private mapScope(scope: NonNullable<ListConversationsDto['scope']>) {
    switch (scope) {
      case 'admin_internal':
        return ConversationScope.ADMIN_INTERNAL
      case 'customer_authenticated':
        return ConversationScope.CUSTOMER_AUTHENTICATED
      default:
        return ConversationScope.CUSTOMER_PUBLIC
    }
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

  private normalizeConversationRoleValue(
    role: ConversationRole | string | null | undefined,
    fallbackScope?: ConversationScope | string | null,
  ): AiConversationRole {
    const normalized = normalizeAiConversationRole(
      typeof role === 'string' ? role : role ? String(role) : null,
    )
    if (normalized) {
      return normalized
    }

    return resolveAiConversationRole({
      session: {
        authenticated:
          fallbackScope === ConversationScope.CUSTOMER_AUTHENTICATED ||
          fallbackScope === 'CUSTOMER_AUTHENTICATED',
        scope:
          fallbackScope === ConversationScope.ADMIN_INTERNAL ||
          fallbackScope === 'ADMIN_INTERNAL'
            ? 'admin_internal'
            : fallbackScope === ConversationScope.CUSTOMER_AUTHENTICATED ||
                fallbackScope === 'CUSTOMER_AUTHENTICATED'
              ? 'customer_authenticated'
              : 'customer_public',
      },
    })
  }

  private mapConversationRoleEnum(role: AiConversationRole) {
    switch (role) {
      case 'customer_authenticated':
        return 'CUSTOMER_AUTHENTICATED' as ConversationRole
      case 'admin_sales':
        return 'ADMIN_SALES' as ConversationRole
      case 'admin_operations':
        return 'ADMIN_OPERATIONS' as ConversationRole
      case 'admin_supervisor':
        return 'ADMIN_SUPERVISOR' as ConversationRole
      case 'superadmin':
        return 'SUPERADMIN' as ConversationRole
      case 'admin_support':
        return 'ADMIN_SUPPORT' as ConversationRole
      default:
        return 'CUSTOMER_PUBLIC' as ConversationRole
    }
  }

  private mapConversationScopeFromRole(role: AiConversationRole) {
    const scope = resolveAiScopeFromRole(role)
    if (scope === 'admin_internal') {
      return ConversationScope.ADMIN_INTERNAL
    }
    if (scope === 'customer_authenticated') {
      return ConversationScope.CUSTOMER_AUTHENTICATED
    }
    return ConversationScope.CUSTOMER_PUBLIC
  }

  private resolveAdminConversationRole(
    actorUser?:
      | {
          role?: string | null
          authority?: string[] | null
          capabilityGroups?: string[] | null
          directCapabilities?: string[] | null
          capabilityEnvelope?: string[] | null
        }
      | null,
  ) {
    const explicitConversationRole = normalizeAiConversationRole(actorUser?.role)
    const hasExplicitCapabilityContext = Boolean(
      actorUser?.capabilityGroups?.length ||
        actorUser?.directCapabilities?.length ||
        actorUser?.capabilityEnvelope?.length,
    )
    return resolveAiConversationRole({
      user: actorUser
        ? {
            role: (actorUser.role as never) ?? undefined,
            authority: (actorUser.authority as never) ?? undefined,
            capabilityGroups: actorUser.capabilityGroups ?? undefined,
            directCapabilities: actorUser.directCapabilities ?? undefined,
            capabilityEnvelope: actorUser.capabilityEnvelope ?? undefined,
          }
        : null,
      session: {
        role:
          explicitConversationRole ??
          (hasExplicitCapabilityContext ? undefined : 'admin_internal'),
        capabilityGroups: actorUser?.capabilityGroups ?? undefined,
        directCapabilities: actorUser?.directCapabilities ?? undefined,
        capabilityEnvelope: actorUser?.capabilityEnvelope ?? undefined,
      },
    })
  }

  private normalizeAiAuditEvent(
    audit: unknown,
    fallback: {
      role: AiConversationRole
      intentKey?: string | null
      taskChanged?: boolean
      fallbackReason?: string | null
    },
  ) {
    const state = this.asRecord(audit)
    const blockedTools = Array.isArray(state?.blockedTools)
      ? state?.blockedTools.filter((entry): entry is string => typeof entry === 'string')
      : []
    const executedTools = Array.isArray(state?.executedTools)
      ? state?.executedTools.filter((entry): entry is string => typeof entry === 'string')
      : []

    return {
      role: typeof state?.role === 'string' ? state.role : fallback.role,
      intentKey:
        typeof state?.intentKey === 'string'
          ? state.intentKey
          : fallback.intentKey ?? null,
      blockedTools,
      executedTools,
      fallbackActivated:
        Boolean(state?.fallbackActivated) || Boolean(fallback.fallbackReason),
      taskChanged: Boolean(state?.taskChanged ?? fallback.taskChanged),
      createdAt:
        typeof state?.createdAt === 'string'
          ? state.createdAt
          : new Date().toISOString(),
    }
  }

  private appendAiAuditLog(existing: unknown, next: ReturnType<ConversationsService['normalizeAiAuditEvent']>) {
    const current = Array.isArray(existing)
      ? existing
          .map((entry) => this.asRecord(entry))
          .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      : []

    return [...current.slice(-19), next]
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

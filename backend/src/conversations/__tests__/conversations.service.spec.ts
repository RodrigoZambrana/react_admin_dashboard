import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConversationsService } from '../conversations.service'

const createPrisma = () => ({
  $transaction: vi.fn(),
  customer: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  conversation: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  conversationMessage: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  conversationReadState: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  conversationParticipant: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  conversationHandoffEvent: {
    create: vi.fn(),
  },
  conversationToolCall: {
    createMany: vi.fn(),
  },
  inboxAccount: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  inboxQueue: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  inboxMessage: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  inboxMessageEvent: {
    create: vi.fn(),
  },
})

const createConfig = () => ({
  get: vi.fn(),
})

describe('ConversationsService', () => {
  let prisma: ReturnType<typeof createPrisma>
  let config: ReturnType<typeof createConfig>
  let service: ConversationsService

  beforeEach(() => {
    prisma = createPrisma()
    config = createConfig()
    prisma.conversationReadState.findMany.mockResolvedValue([])
    prisma.conversationReadState.upsert.mockResolvedValue({})
    prisma.conversationMessage.count.mockResolvedValue(0)
    prisma.$transaction.mockImplementation(
      (
        input:
          | Promise<unknown>[]
          | ((tx: ReturnType<typeof createPrisma>) => Promise<unknown>),
      ) => {
        if (typeof input === 'function') {
          return input(prisma)
        }
        return Promise.all(input)
      },
    )
    service = new ConversationsService(prisma as never, config as never)
  })

  it('lists persisted conversations with normalized summary fields', async () => {
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: 'conv_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'OPEN',
        controlMode: 'AI',
        subject: 'Consulta de roller',
        externalUserId: 'guest_1',
        externalThreadId: 'webchat:guest_1',
        externalChannelRef: '/shop',
        lastMessageAt: new Date('2026-03-25T01:00:00.000Z'),
        lastInboundAt: new Date('2026-03-25T01:00:00.000Z'),
        lastOutboundAt: null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: new Date('2026-03-25T01:00:00.000Z'),
        customer: {
          id: 44,
          name: 'Rodrigo',
          email: 'rodrigo@example.com',
          phoneNumber: '+59891234567',
        },
        assignedToUser: {
          id: 5,
          name: 'Operador',
          email: 'ops@example.com',
        },
        inboxAccount: {
          id: 'inbox_1',
          displayName: 'Webchat',
          address: null,
          channel: 'WHATSAPP',
        },
        participants: [
          {
            id: 'part_1',
            role: 'CUSTOMER',
            displayName: 'Rodrigo',
            externalUserId: 'guest_1',
            customer: {
              id: 44,
              name: 'Rodrigo',
              email: 'rodrigo@example.com',
            },
            user: null,
          },
        ],
        messages: [
          {
            id: 'msg_1',
            authorType: 'CUSTOMER',
            kind: 'TEXT',
            body: 'Hola, quiero cotizar',
            normalizedText: 'Hola, quiero cotizar',
            createdAt: new Date('2026-03-25T01:00:00.000Z'),
          },
        ],
        toolCalls: [
          {
            toolName: 'search_products',
            status: 'EXECUTED',
            updatedAt: new Date('2026-03-25T01:05:00.000Z'),
          },
          {
            toolName: 'update_quote_status',
            status: 'EXECUTED',
            updatedAt: new Date('2026-03-25T01:06:00.000Z'),
          },
        ],
      },
    ])
    prisma.conversation.count.mockResolvedValue(1)

    const result = await service.listConversations({
      page: 2,
      pageSize: 25,
      scope: 'customer_public',
      channel: 'webchat',
      controlMode: 'ai',
      status: 'open',
      assignedToMe: true,
      search: 'roller',
    })

    expect(prisma.conversation.findMany).toHaveBeenCalled()
    expect(prisma.conversation.count).toHaveBeenCalled()
    expect(result.total).toBe(1)
    expect(result.page).toBe(2)
    expect(result.pageSize).toBe(25)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'conv_1',
      tenantKey: 'urucortinas',
      scope: 'customer_public',
      channel: 'webchat',
      status: 'open',
      controlMode: 'ai',
      subject: 'Consulta de roller',
      inboxAccount: {
        id: 'inbox_1',
        channel: 'whatsapp',
      },
      latestMessage: {
        id: 'msg_1',
        authorType: 'customer',
        kind: 'text',
        body: 'Hola, quiero cotizar',
      },
      aiAudit: {
        total: 2,
        search: 1,
        state: 1,
      },
    })
  })

  it('maps a conversation detail and resolves latestMessage from chronological messages', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_2',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WEBCHAT',
      status: 'OPEN',
      controlMode: 'HYBRID',
      subject: 'Seguimiento de pedido',
      externalUserId: 'guest_2',
      externalThreadId: 'webchat:guest_2',
      externalChannelRef: '/account/orders/1',
      lastMessageAt: new Date('2026-03-25T03:00:00.000Z'),
      lastInboundAt: new Date('2026-03-25T02:00:00.000Z'),
      lastOutboundAt: new Date('2026-03-25T03:00:00.000Z'),
      createdAt: new Date('2026-03-25T00:00:00.000Z'),
      updatedAt: new Date('2026-03-25T03:00:00.000Z'),
      customer: {
        id: 55,
        name: 'Cliente',
        email: 'cliente@example.com',
        phoneNumber: '+59890000000',
      },
      assignedToUser: null,
      inboxAccount: null,
      participants: [],
      messages: [
        {
          id: 'msg_old',
          authorType: 'CUSTOMER',
          kind: 'TEXT',
          body: 'Necesito ayuda',
          normalizedText: 'Necesito ayuda',
          payload: null,
          metadata: null,
          sentAt: null,
          receivedAt: null,
          createdAt: new Date('2026-03-25T01:00:00.000Z'),
          inboxMessage: {
            queue: null,
            events: [],
          },
        },
        {
          id: 'msg_new',
          authorType: 'OPERATOR',
          kind: 'TEXT',
          body: 'Ya te respondo',
          normalizedText: 'Ya te respondo',
          payload: null,
          metadata: { internal: true },
          sentAt: null,
          receivedAt: null,
          createdAt: new Date('2026-03-25T03:00:00.000Z'),
          inboxMessage: {
            queue: {
              id: 'queue_1',
              slug: 'support',
              name: 'Support',
            },
            events: [
              {
                id: 44,
                type: 'SYNCED',
                payload: { deliveryStatus: 'delivered' },
                occurredAt: new Date('2026-03-25T03:02:00.000Z'),
              },
            ],
          },
        },
      ],
      handoffEvents: [],
      toolCalls: [],
    })

    const result = await service.getConversation('conv_2')

    expect(prisma.conversation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv_2' },
      }),
    )
    expect(result).toMatchObject({
      id: 'conv_2',
      controlMode: 'hybrid',
      latestMessage: {
        id: 'msg_new',
        authorType: 'operator',
        body: 'Ya te respondo',
      },
    })
    expect(result?.messages).toHaveLength(2)
    expect(result?.messages[0]).toMatchObject({
      id: 'msg_old',
      authorType: 'customer',
      kind: 'text',
    })
    expect(result?.messages[1]).toMatchObject({
      id: 'msg_new',
      authorType: 'operator',
      kind: 'text',
      metadata: { internal: true },
      queue: {
        slug: 'support',
      },
      transportEvents: [
        {
          id: '44',
          type: 'synced',
        },
      ],
    })
  })

  it('builds queue diagnostics with counts and SLA data', async () => {
    prisma.inboxQueue.findMany.mockResolvedValue([
      {
        id: 'queue_support',
        slug: 'support',
        name: 'Support',
        description: 'Casos generales',
        isActive: true,
        priority: 10,
        slaTargetMinutes: 45,
        maxAssignedConversations: 6,
        assignmentMode: 'LEAST_LOADED',
        assignments: [
          {
            id: 'assignment_1',
            isPrimary: true,
            maxOpenConversations: 3,
            user: {
              id: 12,
              name: 'Operador Uno',
              email: 'ops1@example.com',
            },
          },
        ],
      },
    ])
    prisma.conversation.count
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
    prisma.conversation.findFirst.mockResolvedValue({
      lastInboundAt: new Date('2026-03-25T00:15:00.000Z'),
    })

    const result = await service.listQueues()

    expect(result).toEqual([
      {
        id: 'queue_support',
        slug: 'support',
        name: 'Support',
        description: 'Casos generales',
        isActive: true,
        priority: 10,
        maxAssignedConversations: 6,
        assignmentMode: 'least_loaded',
        operatorCount: 1,
        conversationCount: 6,
        waitingCustomerCount: 4,
        unassignedCount: 2,
        breachedSlaCount: 1,
        oldestInboundAt: new Date('2026-03-25T00:15:00.000Z'),
        assignedOpenCount: 2,
        configuredCapacity: 3,
        availableCapacity: 1,
        slaTargetMinutes: 45,
        primaryOperators: [
          {
            id: 12,
            name: 'Operador Uno',
            email: 'ops1@example.com',
            maxOpenConversations: 3,
          },
        ],
      },
    ])
  })

  it('maps active inbox accounts for the future unified inbox surface', async () => {
    prisma.inboxAccount.findMany.mockResolvedValue([
      {
        id: 'acc_1',
        channel: 'EMAIL',
        displayName: 'Ventas',
        address: 'ventas@example.com',
        active: true,
        updatedAt: new Date('2026-03-25T00:00:00.000Z'),
      },
    ])

    const result = await service.listInboxes()

    expect(prisma.inboxAccount.findMany).toHaveBeenCalled()
    expect(result).toEqual([
      {
        id: 'acc_1',
        channel: 'email',
        displayName: 'Ventas',
        address: 'ventas@example.com',
        active: true,
        updatedAt: new Date('2026-03-25T00:00:00.000Z'),
        scope: 'customer_public',
      },
    ])
  })

  it('creates a persisted webchat session with customer match and initial system event', async () => {
    config.get.mockReturnValue('urucortinas')
    prisma.customer.findFirst.mockResolvedValue({
      id: 77,
      name: 'Rodrigo',
      email: 'rodrigo@example.com',
      phoneNumber: '+59891234567',
    })
    prisma.conversation.create.mockResolvedValue({
      id: 'conv_webchat_1',
    })

    const result = await service.createWebchatSession({
      guestId: 'guest_web_1',
      name: 'Rodrigo',
      email: 'rodrigo@example.com',
      locale: 'es-UY',
      page: '/shop',
    })

    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { email: 'rodrigo@example.com' },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
      },
    })
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantKey: 'urucortinas',
          customerId: 77,
          externalUserId: 'guest_web_1',
          externalThreadId: 'webchat:guest_web_1',
          participants: expect.objectContaining({
            create: expect.objectContaining({
              customerId: 77,
              displayName: 'Rodrigo',
            }),
          }),
          messages: expect.objectContaining({
            create: expect.objectContaining({
              body: 'webchat session created',
            }),
          }),
        }),
      }),
    )
    expect(result).toEqual({
      sessionId: 'conv_webchat_1',
      conversationId: 'conv_webchat_1',
      tenantKey: 'urucortinas',
      scope: 'customer_public',
      channel: 'webchat',
      controlMode: 'ai',
      participant: {
        guestId: 'guest_web_1',
        name: 'Rodrigo',
        email: 'rodrigo@example.com',
        locale: 'es-UY',
      },
      context: {
        page: '/shop',
      },
    })
  })

  it('appends a customer webchat message and updates conversation timestamps', async () => {
    const createdAt = new Date('2026-03-25T05:00:00.000Z')
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_webchat_2',
      channel: 'WEBCHAT',
      externalUserId: 'guest_2',
    })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_webchat_2',
      body: 'Necesito ayuda con una cortina',
      createdAt,
    })

    const result = await service.createWebchatMessage({
      conversationId: 'conv_webchat_2',
      guestId: 'guest_2',
      text: 'Necesito ayuda con una cortina',
    })

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_webchat_2',
        body: 'Necesito ayuda con una cortina',
      }),
      select: {
        id: true,
        body: true,
        createdAt: true,
      },
    })
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_webchat_2' },
      data: {
        lastMessageAt: createdAt,
        lastInboundAt: createdAt,
        status: 'WAITING_INTERNAL',
      },
    })
    expect(result).toEqual({
      ok: true,
      conversationId: 'conv_webchat_2',
      message: {
        id: 'msg_webchat_2',
        body: 'Necesito ayuda con una cortina',
        createdAt,
      },
    })
  })

  it('takes over a conversation, assigns the actor and appends a handoff event', async () => {
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_takeover',
        controlMode: 'AI',
      })
      .mockResolvedValueOnce({
        id: 'conv_takeover',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_INTERNAL',
        controlMode: 'HUMAN',
        subject: 'Consulta',
        externalUserId: 'guest_10',
        externalThreadId: 'webchat:guest_10',
        externalChannelRef: '/shop',
        lastMessageAt: new Date('2026-03-25T01:00:00.000Z'),
        lastInboundAt: new Date('2026-03-25T01:00:00.000Z'),
        lastOutboundAt: null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: new Date('2026-03-25T01:00:00.000Z'),
        customer: null,
        assignedToUser: {
          id: 9,
          name: 'Operador',
          email: 'operador@example.com',
        },
        inboxAccount: null,
        participants: [],
        messages: [],
        handoffEvents: [
          {
            id: 'handoff_1',
            type: 'HUMAN_TAKEOVER',
            previousMode: 'AI',
            nextMode: 'HUMAN',
            notes: 'Tomo el caso',
            createdAt: new Date('2026-03-25T01:05:00.000Z'),
            actorUser: {
              id: 9,
              name: 'Operador',
              email: 'operador@example.com',
            },
          },
        ],
      })

    const result = await service.takeoverConversation('conv_takeover', 9, {
      notes: 'Tomo el caso',
    })

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_takeover' },
      data: {
        controlMode: 'HUMAN',
        assignedToUserId: 9,
      },
    })
    expect(prisma.conversationHandoffEvent.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv_takeover',
        type: 'HUMAN_TAKEOVER',
        actorUserId: 9,
        previousMode: 'AI',
        nextMode: 'HUMAN',
        notes: 'Tomo el caso',
      },
    })
    expect(result).toMatchObject({
      id: 'conv_takeover',
      controlMode: 'human',
      assignedToUser: {
        id: 9,
      },
      handoffEvents: [
        {
          type: 'human_takeover',
          notes: 'Tomo el caso',
        },
      ],
    })
  })

  it('releases a conversation back to AI and clears manual assignment', async () => {
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_release',
        controlMode: 'HUMAN',
      })
      .mockResolvedValueOnce({
        id: 'conv_release',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'OPEN',
        controlMode: 'AI',
        subject: 'Consulta',
        externalUserId: 'guest_11',
        externalThreadId: 'webchat:guest_11',
        externalChannelRef: '/shop',
        lastMessageAt: null,
        lastInboundAt: null,
        lastOutboundAt: null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: new Date('2026-03-25T01:00:00.000Z'),
        customer: null,
        assignedToUser: null,
        inboxAccount: null,
        participants: [],
        messages: [],
        handoffEvents: [
          {
            id: 'handoff_2',
            type: 'HUMAN_RELEASE',
            previousMode: 'HUMAN',
            nextMode: 'AI',
            notes: 'Vuelve al agente',
            createdAt: new Date('2026-03-25T01:10:00.000Z'),
            actorUser: {
              id: 9,
              name: 'Operador',
              email: 'operador@example.com',
            },
          },
        ],
      })

    const result = await service.releaseConversation('conv_release', 9, {
      notes: 'Vuelve al agente',
    })

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_release' },
      data: expect.objectContaining({
        controlMode: 'AI',
        assignedToUserId: null,
        needsHuman: false,
        metadata: expect.objectContaining({
          aiState: expect.objectContaining({
            needsHuman: false,
            fallbackReason: null,
          }),
        }),
      }),
    })
    expect(prisma.conversationHandoffEvent.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv_release',
        type: 'HUMAN_RELEASE',
        actorUserId: 9,
        previousMode: 'HUMAN',
        nextMode: 'AI',
        notes: 'Vuelve al agente',
      },
    })
    expect(result).toMatchObject({
      id: 'conv_release',
      controlMode: 'ai',
      assignedToUser: null,
    })
  })

  it('assigns a conversation to a specific operator and records the assignment event', async () => {
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_assign',
      })
      .mockResolvedValueOnce({
        id: 'conv_assign',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'OPEN',
        controlMode: 'HUMAN',
        subject: 'Consulta',
        externalUserId: 'guest_12',
        externalThreadId: 'webchat:guest_12',
        externalChannelRef: '/shop',
        lastMessageAt: null,
        lastInboundAt: null,
        lastOutboundAt: null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: new Date('2026-03-25T01:00:00.000Z'),
        customer: null,
        assignedToUser: {
          id: 12,
          name: 'Analista',
          email: 'analista@example.com',
        },
        inboxAccount: null,
        participants: [],
        messages: [],
        handoffEvents: [],
      })

    const result = await service.assignConversation(
      'conv_assign',
      { userId: 12, notes: 'Derivo a analista' },
      9,
    )

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_assign' },
      data: {
        assignedToUserId: 12,
      },
    })
    expect(prisma.conversationHandoffEvent.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv_assign',
        type: 'ASSIGNED',
        actorUserId: 9,
        notes: 'Derivo a analista',
        metadata: {
          assignedToUserId: 12,
        },
      },
    })
    expect(result).toMatchObject({
      id: 'conv_assign',
      assignedToUser: {
        id: 12,
      },
    })
  })

  it('applies supervisor reroute and updates queue plus assignee', async () => {
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_route',
        assignedToUserId: 12,
        metadata: { queueSlug: 'support' },
        messages: [{ id: 'msg_route', inboxMessageId: 'inbox_route_1' }],
      })
      .mockResolvedValueOnce({
        id: 'conv_route',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'EMAIL',
        status: 'OPEN',
        controlMode: 'HUMAN',
        subject: 'Consulta soporte',
        externalUserId: 'cliente@example.com',
        externalThreadId: 'thread-route',
        externalChannelRef: null,
        lastMessageAt: null,
        lastInboundAt: null,
        lastOutboundAt: null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: new Date('2026-03-25T01:00:00.000Z'),
        customer: null,
        assignedToUser: {
          id: 15,
          name: 'Supervisor target',
          email: 'supervisor.target@example.com',
        },
        inboxAccount: null,
        participants: [],
        messages: [],
        handoffEvents: [],
      })
    prisma.inboxQueue.findUnique.mockResolvedValue({
      id: 'queue_ops',
      slug: 'ops',
      name: 'Ops',
      assignmentMode: 'MANUAL',
      maxAssignedConversations: null,
      assignments: [],
    })

    const result = await service.rerouteConversation(
      'conv_route',
      { queueSlug: 'ops', userId: 15, notes: 'Mover a ops' },
      9,
    )

    expect(prisma.inboxMessage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['inbox_route_1'] } },
      data: { queueId: 'queue_ops' },
    })
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_route' },
      data: expect.objectContaining({
        assignedToUserId: 15,
      }),
    })
    expect(prisma.conversationHandoffEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_route',
        type: 'ASSIGNED',
        actorUserId: 9,
        metadata: expect.objectContaining({
          queueSlug: 'ops',
          assignedToUserId: 15,
          assignmentSource: 'supervisor-manual',
        }),
      }),
    })
    expect(result).toMatchObject({
      id: 'conv_route',
      assignedToUser: {
        id: 15,
      },
    })
  })

  it('stores an operator reply and forces the conversation into human control', async () => {
    const createdAt = new Date('2026-03-25T02:00:00.000Z')
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_reply',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_INTERNAL',
        controlMode: 'AI',
        needsHuman: false,
        subject: 'Consulta',
        externalUserId: 'guest_13',
        externalThreadId: 'webchat:guest_13',
        externalChannelRef: '/shop',
        lastMessageAt: createdAt,
        lastInboundAt: createdAt,
        lastOutboundAt: null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: createdAt,
        customer: null,
        assignedToUser: null,
        inboxAccount: null,
        participants: [],
        messages: [],
      })
      .mockResolvedValueOnce({
        id: 'conv_reply',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_CUSTOMER',
        controlMode: 'HUMAN',
        subject: 'Consulta',
        externalUserId: 'guest_13',
        externalThreadId: 'webchat:guest_13',
        externalChannelRef: '/shop',
        lastMessageAt: createdAt,
        lastInboundAt: null,
        lastOutboundAt: createdAt,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: createdAt,
        customer: null,
        assignedToUser: {
          id: 9,
          name: 'Operador',
          email: 'operador@example.com',
        },
        inboxAccount: null,
        participants: [],
        messages: [
          {
            id: 'msg_reply',
            authorType: 'OPERATOR',
            kind: 'TEXT',
            body: 'Te comparto la respuesta',
            normalizedText: 'Te comparto la respuesta',
            payload: null,
            metadata: { source: 'admin-reply' },
            sentAt: createdAt,
            receivedAt: null,
            createdAt,
          },
        ],
        handoffEvents: [],
      })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_agent_reply',
      createdAt,
    })

    const result = await service.replyAsOperator(
      'conv_reply',
      { body: 'Te comparto la respuesta', kind: 'text' },
      9,
    )

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_reply',
        authorType: 'OPERATOR',
        authorUserId: 9,
        body: 'Te comparto la respuesta',
        metadata: {
          source: 'admin-reply',
          channel: 'webchat',
          deliveryStatus: 'internal_only',
        },
      }),
      select: {
        createdAt: true,
      },
    })
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_reply' },
      data: {
        controlMode: 'HUMAN',
        assignedToUserId: 9,
        lastMessageAt: createdAt,
        lastOutboundAt: createdAt,
        status: 'WAITING_CUSTOMER',
      },
    })
    expect(result).toMatchObject({
      id: 'conv_reply',
      controlMode: 'human',
      status: 'waiting_customer',
      latestMessage: {
        authorType: 'operator',
        body: 'Te comparto la respuesta',
      },
    })
  })

  it('stores an agent reply and keeps the conversation under AI control', async () => {
    const createdAt = new Date('2026-03-25T03:00:00.000Z')
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_agent_reply',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_INTERNAL',
        controlMode: 'AI',
        subject: 'Consulta',
        externalUserId: 'guest_14',
        externalThreadId: 'webchat:guest_14',
        externalChannelRef: '/shop',
        lastMessageAt: createdAt,
        lastInboundAt: createdAt,
        lastOutboundAt: null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: createdAt,
        customer: null,
        assignedToUser: null,
        inboxAccount: null,
        participants: [],
        messages: [],
      })
      .mockResolvedValueOnce({
        id: 'conv_agent_reply',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_CUSTOMER',
        controlMode: 'AI',
        needsHuman: false,
        subject: 'Consulta',
        externalUserId: 'guest_14',
        externalThreadId: 'webchat:guest_14',
        externalChannelRef: '/shop',
        metadata: {
          aiState: {
            needsHuman: false,
            grounded: false,
            fallbackReason: null,
            sourceCount: 0,
            sources: [],
            updatedAt: createdAt.toISOString(),
          },
        },
        lastMessageAt: createdAt,
        lastInboundAt: null,
        lastOutboundAt: createdAt,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: createdAt,
        customer: null,
        assignedToUser: null,
        inboxAccount: null,
        participants: [],
        messages: [
          {
            id: 'msg_agent_reply',
            authorType: 'AGENT',
            kind: 'TEXT',
            body: 'Estas son las opciones encontradas',
            normalizedText: 'Estas son las opciones encontradas',
            payload: null,
            metadata: { source: 'ai-agent-service', provider: 'mock' },
            sentAt: createdAt,
            receivedAt: null,
            createdAt,
          },
        ],
        handoffEvents: [],
    })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_agent_reply',
      createdAt,
    })

    const result = await service.replyAsAgent('conv_agent_reply', {
      body: 'Estas son las opciones encontradas',
      metadata: { provider: 'mock' },
    })

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_agent_reply',
        authorType: 'AGENT',
        body: 'Estas son las opciones encontradas',
        metadata: expect.objectContaining({
          source: 'ai-agent-service',
          provider: 'mock',
          channel: 'webchat',
          deliveryStatus: 'internal_only',
          ai: expect.objectContaining({
            needsHuman: false,
            grounded: false,
          }),
        }),
      }),
      select: {
        id: true,
        createdAt: true,
      },
    })
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_agent_reply' },
      data: expect.objectContaining({
        controlMode: 'AI',
        needsHuman: false,
        lastMessageAt: createdAt,
        lastOutboundAt: createdAt,
        status: 'WAITING_CUSTOMER',
      }),
    })
    expect(result).toMatchObject({
      id: 'conv_agent_reply',
      controlMode: 'ai',
      aiState: {
        grounded: false,
        needsHuman: false,
      },
      latestMessage: {
        authorType: 'agent',
        body: 'Estas son las opciones encontradas',
      },
    })
  })

  it('persists tool call audit entries together with an agent reply', async () => {
    const createdAt = new Date('2026-03-25T03:30:00.000Z')
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_tools',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_INTERNAL',
        controlMode: 'AI',
        subject: 'Consulta',
        externalUserId: 'guest_15',
        externalThreadId: 'webchat:guest_15',
        externalChannelRef: '/shop',
        lastMessageAt: createdAt,
        lastInboundAt: createdAt,
        lastOutboundAt: null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: createdAt,
        customer: null,
        assignedToUser: null,
        inboxAccount: null,
        participants: [],
        messages: [],
      })
      .mockResolvedValueOnce({
        id: 'conv_tools',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_CUSTOMER',
        controlMode: 'AI',
        subject: 'Consulta',
        externalUserId: 'guest_15',
        externalThreadId: 'webchat:guest_15',
        externalChannelRef: '/shop',
        lastMessageAt: createdAt,
        lastInboundAt: null,
        lastOutboundAt: createdAt,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: createdAt,
        customer: null,
        assignedToUser: null,
        inboxAccount: null,
        participants: [],
        messages: [],
        handoffEvents: [],
        toolCalls: [
          {
            id: 'tool_1',
            toolName: 'search_products',
            status: 'EXECUTED',
            validatedPayload: { query: 'roller' },
            resultPayload: [{ id: 10, name: 'Roller' }],
            errorCode: null,
            errorMessage: null,
            createdAt,
            updatedAt: createdAt,
            messageId: 'msg_tool',
          },
        ],
      })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_tool',
      createdAt,
    })

    const result = await service.replyAsAgent('conv_tools', {
      body: 'Encontré una opción',
      metadata: { provider: 'mock' },
      toolCalls: [
        {
          name: 'search_products',
          arguments: { query: 'roller' },
          result: [{ id: 10, name: 'Roller' }],
          status: 'executed',
        },
      ],
    })

    expect(prisma.conversationToolCall.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          conversationId: 'conv_tools',
          messageId: 'msg_tool',
          toolName: 'search_products',
          status: 'EXECUTED',
          validatedPayload: { query: 'roller' },
        }),
      ],
    })
    expect(result).toMatchObject({
      id: 'conv_tools',
      toolCalls: [
        {
          toolName: 'search_products',
          status: 'executed',
        },
      ],
    })
  })

  it('persists needsHuman fallback and switches public conversations to human control', async () => {
    const createdAt = new Date('2026-03-25T03:45:00.000Z')
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_handoff',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_INTERNAL',
        controlMode: 'AI',
        subject: 'Consulta compleja',
        externalUserId: 'guest_16',
        externalThreadId: 'webchat:guest_16',
        externalChannelRef: '/shop',
        metadata: {},
        lastMessageAt: createdAt,
        lastInboundAt: createdAt,
        lastOutboundAt: null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: createdAt,
        customer: null,
        assignedToUser: null,
        inboxAccount: null,
        participants: [],
        messages: [],
      })
      .mockResolvedValueOnce({
        id: 'conv_handoff',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_INTERNAL',
        controlMode: 'HUMAN',
        subject: 'Consulta compleja',
        externalUserId: 'guest_16',
        externalThreadId: 'webchat:guest_16',
        externalChannelRef: '/shop',
        metadata: {
          aiState: {
            needsHuman: true,
            grounded: false,
            fallbackReason: 'missing_approved_context',
            sourceCount: 0,
            sources: [],
            updatedAt: createdAt.toISOString(),
          },
        },
        lastMessageAt: createdAt,
        lastInboundAt: createdAt,
        lastOutboundAt: createdAt,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: createdAt,
        customer: null,
        assignedToUser: null,
        inboxAccount: null,
        participants: [],
        messages: [
          {
            id: 'msg_handoff',
            authorType: 'AGENT',
            kind: 'TEXT',
            body: 'No tengo información confirmada suficiente.',
            normalizedText: 'No tengo información confirmada suficiente.',
            payload: null,
            metadata: {
              source: 'ai-agent-service',
              ai: {
                needsHuman: true,
                grounded: false,
                fallbackReason: 'missing_approved_context',
                sourceCount: 0,
                sources: [],
              },
            },
            sentAt: createdAt,
            receivedAt: null,
            createdAt,
          },
        ],
        handoffEvents: [
          {
            id: 'handoff_1',
            type: 'AI_SUGGEST_ONLY',
            previousMode: 'AI',
            nextMode: 'HUMAN',
            notes: 'missing_approved_context',
            actorUser: null,
            createdAt,
          },
        ],
        toolCalls: [],
      })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_handoff',
      createdAt,
    })

    const result = await service.replyAsAgent('conv_handoff', {
      body: 'No tengo información confirmada suficiente.',
      metadata: { provider: 'openai', model: 'gpt-4o-mini' },
      needsHuman: true,
      grounding: {
        grounded: false,
        fallbackReason: 'missing_approved_context',
        sourceCount: 0,
        sources: [],
      },
    })

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_handoff' },
        data: expect.objectContaining({
          controlMode: 'HUMAN',
          needsHuman: true,
          status: 'WAITING_INTERNAL',
          metadata: expect.objectContaining({
            aiState: expect.objectContaining({
            needsHuman: true,
            grounded: false,
            fallbackReason: 'missing_approved_context',
          }),
        }),
      }),
    })
    expect(prisma.conversationHandoffEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_handoff',
        type: 'AI_SUGGEST_ONLY',
        nextMode: 'HUMAN',
      }),
    })
    expect(result).toMatchObject({
      id: 'conv_handoff',
      controlMode: 'human',
      needsHuman: true,
      aiState: {
        needsHuman: true,
        grounded: false,
      },
    })
  })

  it('ingests an inbound email into inbox and conversation hub', async () => {
    const createdAt = new Date('2026-03-25T04:00:00.000Z')
    prisma.inboxAccount.upsert.mockResolvedValue({
      id: 'acc_email',
      displayName: 'ventas@urucortinas.com',
      address: 'ventas@urucortinas.com',
    })
    prisma.inboxQueue.upsert.mockResolvedValue({
      id: 'queue_support',
      slug: 'support',
      name: 'Support',
      assignmentMode: 'MANUAL',
      maxAssignedConversations: null,
      slaTargetMinutes: 30,
      assignments: [],
    })
    prisma.customer.findFirst.mockResolvedValue(null)
    prisma.conversation.findFirst.mockResolvedValue(null)
    prisma.conversation.create.mockResolvedValue({
      id: 'conv_email',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'EMAIL',
      status: 'OPEN',
      controlMode: 'AI',
      subject: 'Consulta por presupuesto',
      customerId: null,
      inboxAccountId: 'acc_email',
      externalUserId: 'cliente@example.com',
      externalThreadId: 'thread-1',
      externalChannelRef: null,
      metadata: {},
    })
    prisma.conversationParticipant.findFirst.mockResolvedValue(null)
    prisma.conversationParticipant.create.mockResolvedValue({
      id: 'part_email',
    })
    prisma.conversationMessage.findFirst.mockResolvedValue(null)
    prisma.inboxMessage.create.mockResolvedValue({
      id: 'inbox_msg_1',
    })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'conv_msg_1',
      createdAt,
    })

    const result = await service.ingestInboundMessage({
      tenantKey: 'urucortinas',
      channel: 'email',
      userId: 'cliente@example.com',
      inboxAddress: 'ventas@urucortinas.com',
      subject: 'Consulta por presupuesto',
      threadId: 'thread-1',
      externalMessageId: 'remote-1',
      text: 'Necesito un presupuesto',
      metadata: { provider: 'imap' },
    })

    expect(prisma.inboxMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'acc_email',
        queueId: 'queue_support',
        subject: 'Consulta por presupuesto',
        direction: 'INBOUND',
      }),
    })
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_email',
        externalMessageId: 'remote-1',
        body: 'Necesito un presupuesto',
      }),
      select: {
        id: true,
        createdAt: true,
      },
    })
  expect(result).toMatchObject({
      conversationId: 'conv_email',
      channel: 'email',
      queue: {
        slug: 'support',
      },
    })
  })

  it('auto-assigns inbound conversations to the least loaded queue operator', async () => {
    const createdAt = new Date('2026-03-25T02:00:00.000Z')
    prisma.inboxAccount.upsert.mockResolvedValue({
      id: 'acc_whatsapp',
      channel: 'WHATSAPP',
      displayName: 'WhatsApp',
      address: 'wameta',
    })
    prisma.inboxQueue.upsert.mockResolvedValue({
      id: 'queue_social',
      slug: 'social',
      name: 'Social',
      assignmentMode: 'LEAST_LOADED',
      maxAssignedConversations: 4,
      slaTargetMinutes: 20,
      assignments: [
        {
          id: 'assign_1',
          isPrimary: true,
          maxOpenConversations: 2,
          userId: 9,
        },
        {
          id: 'assign_2',
          isPrimary: false,
          maxOpenConversations: 4,
          userId: 10,
        },
      ],
    })
    prisma.customer.findFirst.mockResolvedValue(null)
    prisma.conversation.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
    prisma.conversation.findFirst.mockResolvedValue(null)
    prisma.conversation.create.mockResolvedValue({
      id: 'conv_whatsapp',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WHATSAPP',
      status: 'WAITING_INTERNAL',
      controlMode: 'AI',
      subject: 'Inbound whatsapp',
      customerId: null,
      inboxAccountId: 'acc_whatsapp',
      assignedToUserId: 10,
      externalUserId: '59890000001',
      externalThreadId: 'thread-wa-1',
      externalChannelRef: null,
      metadata: {},
    })
    prisma.conversationParticipant.findFirst.mockResolvedValue(null)
    prisma.conversationParticipant.create.mockResolvedValue({
      id: 'part_wa',
    })
    prisma.conversationMessage.findFirst.mockResolvedValue(null)
    prisma.inboxMessage.create.mockResolvedValue({
      id: 'inbox_msg_wa',
    })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'conv_msg_wa',
      createdAt,
    })

    await service.ingestInboundMessage({
      tenantKey: 'urucortinas',
      channel: 'whatsapp',
      userId: '59890000001',
      threadId: 'thread-wa-1',
      externalMessageId: 'wa-remote-1',
      text: 'Hola desde WhatsApp',
      metadata: { provider: 'meta' },
    })

    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedToUserId: 10,
        }),
      }),
    )
    expect(prisma.conversationHandoffEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_whatsapp',
        type: 'ASSIGNED',
        metadata: expect.objectContaining({
          assignedToUserId: 10,
          assignmentSource: 'queue-auto-assign',
          queueSlug: 'social',
        }),
      }),
    })
  })

  it('lists messaging contacts including the internal assistant contact', async () => {
    prisma.customer.findMany.mockResolvedValue([
      {
        id: 22,
        name: 'Cliente Demo',
        email: 'cliente@example.com',
        phoneNumber: '+59899111222',
      },
    ])
    prisma.conversation.findFirst
      .mockResolvedValueOnce({
        id: 'conv_internal',
        updatedAt: new Date('2026-03-25T12:00:00.000Z'),
      })
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: 'conv_customer',
        customerId: 22,
        channel: 'EMAIL',
        lastMessageAt: new Date('2026-03-25T12:30:00.000Z'),
        updatedAt: new Date('2026-03-25T12:30:00.000Z'),
      },
    ])

    const result = await service.listContacts(
      { limit: 10 },
      7,
    )

    expect(result.items[0]).toMatchObject({
      key: 'internal:assistant',
      kind: 'internal',
      label: 'Asistente interno',
      conversationId: 'conv_internal',
    })
    expect(result.items[1]).toMatchObject({
      key: 'customer:22',
      kind: 'customer',
      customerId: 22,
      label: 'Cliente Demo',
      conversationId: 'conv_customer',
      hasDeliveryChannel: true,
      channel: 'email',
    })
  })

  it('opens the internal assistant conversation and sends the first message', async () => {
    const replyAsOperatorSpy = vi
      .spyOn(service, 'replyAsOperator')
      .mockResolvedValue({ id: 'conv_internal' } as never)

    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv_internal',
    })

    await service.startConversationFromContact(
      {
        contactType: 'internal',
        message: 'Necesito ayuda con un presupuesto',
      },
      9,
    )

    expect(replyAsOperatorSpy).toHaveBeenCalledWith(
      'conv_internal',
      {
        body: 'Necesito ayuda con un presupuesto',
        kind: 'text',
      },
      9,
    )
  })

  it('defaults admin internal sessions to CLIENT_SLUG when tenantKey is omitted', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'CLIENT_SLUG') {
        return 'urucortinas'
      }
      return undefined
    })

    const createConversationSpy = vi
      .spyOn(service as any, 'createAdminInternalConversationRecord')
      .mockResolvedValue({ id: 'conv_internal' })
    const replyAsOperatorSpy = vi
      .spyOn(service, 'replyAsOperator')
      .mockResolvedValue({ id: 'conv_internal' } as never)

    await service.createAdminInternalSession(
      {
        subject: 'Alta de abertura',
        message: 'Necesito agregar una abertura',
      },
      9,
    )

    expect(createConversationSpy).toHaveBeenCalledWith({
      tenantKey: 'urucortinas',
      actorUserId: 9,
      subject: 'Alta de abertura',
    })
    expect(replyAsOperatorSpy).toHaveBeenCalledWith(
      'conv_internal',
      {
        body: 'Necesito agregar una abertura',
        kind: 'text',
      },
      9,
    )
  })
})

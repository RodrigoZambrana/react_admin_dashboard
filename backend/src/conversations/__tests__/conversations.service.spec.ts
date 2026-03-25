import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConversationsService } from '../conversations.service'

const createPrisma = () => ({
  $transaction: vi.fn(),
  customer: {
    findFirst: vi.fn(),
  },
  conversation: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  conversationMessage: {
    create: vi.fn(),
  },
  conversationHandoffEvent: {
    create: vi.fn(),
  },
  inboxAccount: {
    findMany: vi.fn(),
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
        },
      ],
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
    })
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
      data: {
        controlMode: 'AI',
        assignedToUserId: null,
      },
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

  it('stores an operator reply and forces the conversation into human control', async () => {
    const createdAt = new Date('2026-03-25T02:00:00.000Z')
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_reply',
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
      })
      .mockResolvedValueOnce({
        id: 'conv_agent_reply',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_CUSTOMER',
        controlMode: 'AI',
        subject: 'Consulta',
        externalUserId: 'guest_14',
        externalThreadId: 'webchat:guest_14',
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
        metadata: {
          source: 'ai-agent-service',
          provider: 'mock',
        },
      }),
      select: {
        createdAt: true,
      },
    })
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_agent_reply' },
      data: {
        controlMode: 'AI',
        lastMessageAt: createdAt,
        lastOutboundAt: createdAt,
        status: 'WAITING_CUSTOMER',
      },
    })
    expect(result).toMatchObject({
      id: 'conv_agent_reply',
      controlMode: 'ai',
      latestMessage: {
        authorType: 'agent',
        body: 'Estas son las opciones encontradas',
      },
    })
  })
})

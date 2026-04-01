import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    delete: vi.fn(),
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
    update: vi.fn(),
  },
  conversationHandoffEvent: {
    create: vi.fn(),
  },
  conversationToolCall: {
    createMany: vi.fn(),
  },
  conversationExternalIdentity: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  inboxAccount: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
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

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('persists operator replies with attachments and canonical message elements', async () => {
    const createdAt = new Date('2026-03-27T15:00:00.000Z')
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_reply_attachment',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_CUSTOMER',
        controlMode: 'HUMAN',
        subject: 'Consulta',
        externalUserId: 'guest_99',
        externalThreadId: 'webchat:guest_99',
        externalChannelRef: '/shop',
        lastMessageAt: createdAt,
        lastInboundAt: null,
        lastOutboundAt: createdAt,
        createdAt,
        updatedAt: createdAt,
        customer: null,
        assignedToUser: {
          id: 9,
          name: 'Operador',
          email: 'operador@example.com',
        },
        inboxAccount: null,
        participants: [],
        messages: [],
      })
      .mockResolvedValueOnce({
        id: 'conv_reply_attachment',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_CUSTOMER',
        controlMode: 'HUMAN',
        subject: 'Consulta',
        externalUserId: 'guest_99',
        externalThreadId: 'webchat:guest_99',
        externalChannelRef: '/shop',
        lastMessageAt: createdAt,
        lastInboundAt: null,
        lastOutboundAt: createdAt,
        createdAt,
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
            id: 'msg_reply_attachment',
            authorType: 'OPERATOR',
            kind: 'TEXT',
          body: 'plano.pdf · Incluye medidas y observaciones.',
          normalizedText: 'plano.pdf · Incluye medidas y observaciones.',
          payload: {
            attachments: [
                {
                  assetType: 'pdf',
                  fileName: 'plano.pdf',
                  contentType: 'application/pdf',
                  textContent: 'Incluye medidas y observaciones.',
                },
              ],
            },
            metadata: { source: 'admin-reply' },
            sentAt: createdAt,
            receivedAt: null,
            createdAt,
          },
        ],
        handoffEvents: [],
      })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_operator_attachment',
      createdAt,
    })

    await service.replyAsOperator(
      'conv_reply_attachment',
      {
        body: '',
        kind: 'text',
        attachments: [
          {
            assetType: 'pdf',
            fileName: 'plano.pdf',
            contentType: 'application/pdf',
            content: 'data:application/pdf;base64,JVBERi0xLjQ=',
            textContent: 'Incluye medidas y observaciones.',
          },
        ],
      },
      9,
    )

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: '[Adjunto: plano.pdf] Incluye medidas y observaciones.',
          normalizedText: '[Adjunto: plano.pdf] Incluye medidas y observaciones.',
          metadata: expect.objectContaining({
            source: 'admin-reply',
            channel: 'webchat',
            deliveryStatus: 'internal_only',
            attachments: [
              expect.objectContaining({
                assetType: 'pdf',
                fileName: 'plano.pdf',
              }),
            ],
          }),
          payload: expect.objectContaining({
            attachments: [
              expect.objectContaining({
                assetType: 'pdf',
                fileName: 'plano.pdf',
              }),
            ],
            messageElements: expect.arrayContaining([
              expect.objectContaining({
                kind: 'text',
                source: 'message',
              }),
              expect.objectContaining({
                kind: 'document',
                label: 'plano.pdf',
                source: 'attachment',
              }),
            ]),
          }),
        }),
      }),
    )
  })

  it('lists persisted conversations with normalized summary fields', async () => {
    prisma.conversation.findMany
      .mockResolvedValueOnce([
        {
          id: 'conv_1',
          channel: 'WEBCHAT',
          metadata: null,
        },
      ])
      .mockResolvedValueOnce([
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

    const result = await service.listConversations({
      page: 1,
      pageSize: 25,
      scope: 'customer_public',
      channel: 'webchat',
      controlMode: 'ai',
      status: 'open',
      assignedToMe: true,
      search: 'roller',
    })

    expect(prisma.conversation.findMany).toHaveBeenCalledTimes(2)
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
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

  it('builds admin debug turns from persisted customer and ai-agent messages', async () => {
    const createdAt = new Date('2026-03-30T12:00:00.000Z')
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_debug_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WEBCHAT',
      status: 'WAITING_CUSTOMER',
      controlMode: 'AI',
      subject: 'Consulta roller blackout',
      externalUserId: 'guest_debug',
      externalThreadId: 'webchat:guest_debug',
      externalChannelRef: '/shop',
      lastMessageAt: createdAt,
      lastInboundAt: createdAt,
      lastOutboundAt: createdAt,
      createdAt,
      updatedAt: createdAt,
      metadata: {},
      customer: null,
      assignedToUser: null,
      inboxAccount: null,
      participants: [],
      messages: [
        {
          id: 'msg_customer_debug',
          authorType: 'CUSTOMER',
          authorUser: null,
          kind: 'TEXT',
          body: 'necesito roller blackout',
          normalizedText: 'necesito roller blackout',
          payload: {},
          metadata: { authorKind: 'customer_human' },
          sentAt: createdAt,
          receivedAt: createdAt,
          createdAt,
          inboxMessage: null,
        },
        {
          id: 'msg_agent_debug',
          authorType: 'AGENT',
          authorUser: null,
          kind: 'TEXT',
          body: 'Sí, tenemos roller blackout. Para cotizarte, decime las medidas y la cantidad.',
          normalizedText:
            'Sí, tenemos roller blackout. Para cotizarte, decime las medidas y la cantidad.',
          payload: {},
          metadata: {
            authorKind: 'agent_runtime',
            aiResponse: {
              finalUserText:
                'Sí, tenemos roller blackout. Para cotizarte, decime las medidas y la cantidad.',
              debugSummary: '[debug] stage=deterministic_decision',
              auditPayload: {
                input: 'necesito roller blackout',
                intentKey: 'customer.quote',
                intentConfidence: 0.88,
                intentSource: 'rule',
                decisionPath: ['lane:information_first', 'next:collect_quote_fields'],
                blockedTools: ['create_quote'],
                toolCalls: [
                  {
                    name: 'search_products',
                    status: 'executed',
                    target: 'roller blackout',
                  },
                  {
                    name: 'create_quote',
                    status: 'rejected',
                    target: null,
                  },
                ],
                aiExchange: {
                  request: {
                    mode: 'llm_conversational',
                    contextBlock: 'Resumen operativo: cliente pide roller blackout.',
                    taskSummary: 'Orientar y luego pedir medidas/cantidad.',
                    systemPrompt: 'Prompt conversacional controlado.',
                    promptInput:
                      'Borrador aprobado por backend: Sí, tenemos roller blackout.',
                    promptHistory: [
                      {
                        role: 'customer',
                        text: 'necesito roller blackout',
                      },
                    ],
                    currentTask: {
                      intentKey: 'customer.quote',
                      status: 'collecting_info',
                    },
                    approvedFacts: ['Sí, trabajamos con roller blackout.'],
                  },
                  response: {
                    source: 'llm_conversational',
                    text: 'Sí, tenemos roller blackout. Para cotizarte, decime las medidas y la cantidad.',
                    toolCalls: [],
                  },
                },
                turnInterpretation: {
                  conversationContext: {
                    quoteStage: 'information',
                    waitForMore: false,
                  },
                },
                rewriteExchange: {
                  request: {
                    mode: 'llm_rewrite',
                    systemPrompt: 'Prompt final de reescritura.',
                    promptInput:
                      'Consulta original: necesito roller blackout\n\nBorrador aprobado: Sí, tenemos roller blackout.',
                    promptHistory: [],
                  },
                  response: {
                    source: 'llm_rewrite',
                    text: 'Sí, tenemos roller blackout. Para cotizarte, decime las medidas y la cantidad.',
                    toolCalls: [],
                  },
                },
              },
            },
            ai: {
              grounded: true,
              fallbackReason: null,
              sourceCount: 1,
              sources: [
                {
                  id: 'doc_blackout',
                  title: 'Dato web · Producto · blackout',
                  scope: 'customer_public',
                  sourceType: 'web_url',
                  score: 12.4,
                },
              ],
            },
          },
          sentAt: createdAt,
          receivedAt: null,
          createdAt,
          inboxMessage: null,
        },
      ],
      handoffEvents: [],
      toolCalls: [],
    })

    const result = await service.getConversationDebug('conv_debug_1', 7)

    expect(result).toMatchObject({
      conversation: {
        id: 'conv_debug_1',
        channel: 'webchat',
      },
    })
    expect(result?.turns).toHaveLength(1)
    expect(result?.turns?.[0]).toMatchObject({
      originalUserInput: 'necesito roller blackout',
      processedInput: 'necesito roller blackout',
      finalResponse:
        'Sí, tenemos roller blackout. Para cotizarte, decime las medidas y la cantidad.',
      intent: {
        key: 'customer.quote',
      },
      actions: {
        evaluated: ['lane:information_first', 'next:collect_quote_fields'],
        discarded: ['create_quote'],
      },
      contextSent: {
        mode: 'llm_conversational',
      },
      promptSent: {
        mode: 'llm_rewrite',
        systemPrompt: 'Prompt final de reescritura.',
      },
      rawAiResponse: {
        source: 'llm_rewrite',
      },
      grounding: {
        grounded: true,
        sourceCount: 1,
      },
    })
  })

  it('runs debug simulations by creating a webchat session and dispatching the same webchat path used by real users', async () => {
    vi.spyOn(service, 'createWebchatSession').mockResolvedValue({
      conversationId: 'conv_debug_run',
      sessionId: 'conv_debug_run',
      tenantKey: 'urucortinas',
      scope: 'customer_authenticated',
      participant: {
        guestId: 'guest_debug_run',
        name: 'Cliente debug',
        email: 'cliente@example.com',
        locale: 'es-UY',
        currency: 'UYU',
      },
      context: {
        page: '/shop',
      },
      messages: [],
    } as never)
    const dispatchSpy = vi
      .spyOn(service, 'dispatchWebchatMessage')
      .mockResolvedValue({
        status: 'queued',
        queued: true,
      } as never)
    const getDebugSpy = vi
      .spyOn(service, 'getConversationDebug')
      .mockResolvedValue({
        conversation: {
          id: 'conv_debug_run',
          channel: 'webchat',
        },
        turns: [
          {
            pending: false,
            finalResponse: 'Perfecto, tomo la medida.',
          },
        ],
      } as never)

    const result = await service.runConversationDebug(
      'new',
      {
        simulateAs: 'authenticated',
        email: 'cliente@example.com',
        page: '/shop',
        waitTimeoutMs: 0,
        messages: [
          {
            text: 'Necesito roller blackout',
          },
          {
            text: 'de 2x2',
            delayMs: 150,
          },
        ],
      },
      7,
    )

    expect(dispatchSpy).toHaveBeenCalledTimes(2)
    expect(dispatchSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        conversationId: 'conv_debug_run',
        guestId: 'guest_debug_run',
        text: 'Necesito roller blackout',
        metadata: expect.objectContaining({
          debugSimulation: true,
          authenticated: true,
          debugOptions: expect.objectContaining({
            knowledgeMode: 'full',
            disableKnowledge: false,
          }),
        }),
      }),
    )
    expect(result).toMatchObject({
      conversation: {
        id: 'conv_debug_run',
      },
      execution: {
        created: true,
        reset: false,
        messagesDispatched: 2,
        settled: true,
        options: {
          knowledgeMode: 'full',
          disableKnowledge: false,
        },
      },
    })
    expect(getDebugSpy).toHaveBeenCalled()
  })

  it('resets an existing webchat debug session by recreating it with the same simulation seed', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_existing_debug',
      metadata: {
        debugSession: true,
      },
    })
    vi.spyOn(service, 'getWebchatSession').mockResolvedValue({
      conversationId: 'conv_existing_debug',
      sessionId: 'conv_existing_debug',
      tenantKey: 'urucortinas',
      scope: 'customer_public',
      participant: {
        guestId: 'guest_existing',
        name: 'Invitado',
        email: null,
        locale: 'es-UY',
        currency: 'UYU',
      },
      context: {
        page: '/contacto',
      },
      messages: [],
    } as never)
    const deleteSpy = vi
      .spyOn(service, 'deleteConversationDebug')
      .mockResolvedValue({
        ok: true,
        deleted: true,
        conversationId: 'conv_existing_debug',
      } as never)
    const createSessionSpy = vi
      .spyOn(service, 'createWebchatSession')
      .mockResolvedValue({
        conversationId: 'conv_recreated_debug',
        sessionId: 'conv_recreated_debug',
        tenantKey: 'urucortinas',
        scope: 'customer_public',
        participant: {
          guestId: 'guest_existing',
          name: 'Invitado',
          email: null,
          locale: 'es-UY',
          currency: 'UYU',
        },
        context: {
          page: '/contacto',
        },
        messages: [],
      } as never)
    vi.spyOn(service, 'getConversationDebug').mockResolvedValue({
      conversation: {
        id: 'conv_recreated_debug',
        channel: 'webchat',
      },
      turns: [],
    } as never)

    const result = await service.runConversationDebug(
      'conv_existing_debug',
      {
        reset: true,
      },
      11,
    )

    expect(deleteSpy).toHaveBeenCalledWith('conv_existing_debug', 11)
    expect(createSessionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        guestId: 'guest_existing',
        page: '/contacto',
        authenticated: false,
      }),
    )
    expect(result).toMatchObject({
      conversation: {
        id: 'conv_recreated_debug',
      },
      execution: {
        created: true,
        reset: true,
        messagesDispatched: 0,
      },
    })
  })

  it('deletes debug conversations explicitly', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_delete_debug',
      channel: 'WEBCHAT',
      metadata: {
        debugSession: true,
      },
    })
    prisma.conversation.delete.mockResolvedValue({
      id: 'conv_delete_debug',
    })

    const result = await service.deleteConversationDebug('conv_delete_debug', 9)

    expect(prisma.conversation.delete).toHaveBeenCalledWith({
      where: { id: 'conv_delete_debug' },
    })
    expect(result).toEqual({
      ok: true,
      deleted: true,
      conversationId: 'conv_delete_debug',
      channel: 'webchat',
    })
  })

  it('does not allow mutating existing non-debug conversations through the debug runner', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_protected',
      metadata: {
        debugSession: false,
      },
    })

    await expect(
      service.runConversationDebug(
        'conv_protected',
        {
          messages: [{ text: 'hola' }],
        },
        9,
      ),
    ).rejects.toThrow('conversation.debugReadonly')
  })

  it('scopes internal assistant channel listings to the current operator and assistant contact', async () => {
    prisma.conversation.findMany
      .mockResolvedValueOnce([
        {
          id: 'conv_assistant_latest',
          channel: 'ADMIN_CHAT',
          metadata: {
            contactKey: 'internal:assistant',
          },
        },
        {
          id: 'conv_assistant_old',
          channel: 'ADMIN_CHAT',
          metadata: {
            contactKey: 'internal:assistant',
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'conv_assistant_latest',
          tenantKey: 'urucortinas',
          scope: 'ADMIN_INTERNAL',
          channel: 'ADMIN_CHAT',
          status: 'OPEN',
          controlMode: 'AI',
          subject: 'Agente IA',
          externalUserId: 'admin:42',
          externalThreadId: null,
          externalChannelRef: null,
          lastMessageAt: new Date('2026-03-26T00:10:00.000Z'),
          lastInboundAt: null,
          lastOutboundAt: new Date('2026-03-26T00:10:00.000Z'),
          createdAt: new Date('2026-03-26T00:00:00.000Z'),
          updatedAt: new Date('2026-03-26T00:10:00.000Z'),
          customer: null,
          assignedToUser: null,
          inboxAccount: null,
          participants: [],
          messages: [],
          toolCalls: [],
        },
      ])

    const result = await service.listConversations(
      {
        page: 1,
        pageSize: 20,
        channel: 'admin_chat',
      },
      42,
    )

    expect(prisma.conversation.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          channel: 'ADMIN_CHAT',
          scope: 'ADMIN_INTERNAL',
          externalUserId: 'admin:42',
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { scope: { not: 'ADMIN_INTERNAL' } },
                { externalUserId: 'admin:42' },
              ]),
            }),
            expect.objectContaining({
              metadata: {
                path: ['contactKey'],
                equals: 'internal:assistant',
              },
            }),
          ]),
        }),
      }),
    )
    expect(prisma.conversation.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            in: ['conv_assistant_latest'],
          },
        }),
      }),
    )
    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBe('conv_assistant_latest')
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

  it('derives a consistent latestMessage preview for multimodal attachment-only messages', async () => {
    prisma.conversation.findMany
      .mockResolvedValueOnce([
        {
          id: 'conv_multimodal_preview',
          channel: 'WEBCHAT',
          metadata: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'conv_multimodal_preview',
          tenantKey: 'urucortinas',
          scope: 'CUSTOMER_PUBLIC',
          channel: 'WEBCHAT',
          status: 'WAITING_CUSTOMER',
          controlMode: 'HYBRID',
          subject: 'Seguimiento multimodal',
          externalUserId: 'guest_preview',
          externalThreadId: 'webchat:guest_preview',
          externalChannelRef: '/shop',
          pinnedAt: null,
          lastMessageAt: new Date('2026-03-27T16:00:00.000Z'),
          lastInboundAt: new Date('2026-03-27T15:58:00.000Z'),
          lastOutboundAt: new Date('2026-03-27T16:00:00.000Z'),
          createdAt: new Date('2026-03-27T15:00:00.000Z'),
          updatedAt: new Date('2026-03-27T16:00:00.000Z'),
          needsHuman: false,
          metadata: null,
          customer: {
            id: 77,
            name: 'Cliente preview',
            email: 'preview@example.com',
            phoneNumber: '+59890000077',
          },
          assignedToUser: {
            id: 5,
            name: 'Operador',
            email: 'operador@example.com',
          },
          inboxAccount: null,
          participants: [],
          messages: [
            {
              id: 'msg_preview_latest',
              authorType: 'OPERATOR',
              authorUser: {
                id: 5,
                name: 'Operador',
                email: 'operador@example.com',
              },
              kind: 'TEXT',
              body: '[Adjunto: plano.txt] Plano con medidas finales.',
              normalizedText: '[Adjunto: plano.txt] Plano con medidas finales.',
              metadata: {
                attachments: [
                  {
                    assetType: 'text',
                    fileName: 'plano.txt',
                    contentType: 'text/plain',
                    textContent: 'Plano con medidas finales.',
                  },
                  {
                    assetType: 'audio',
                    fileName: 'respuesta.webm',
                    contentType: 'audio/webm',
                  },
                ],
              },
              createdAt: new Date('2026-03-27T16:00:00.000Z'),
              inboxMessage: {
                queue: null,
              },
            },
          ],
          toolCalls: [],
        },
      ])

    const result = await service.listConversations({ page: 1, pageSize: 20 })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'conv_multimodal_preview',
      latestMessage: {
        preview: 'plano.txt · Plano con medidas finales.',
        previewKind: 'text',
      },
    })
  })

  it('filters deleted webchat conversations before pagination and totals', async () => {
    prisma.conversation.findMany
      .mockResolvedValueOnce([
        {
          id: 'conv_deleted',
          channel: 'WEBCHAT',
          metadata: {
            webchatChatState: {
              deleted: true,
            },
          },
        },
        {
          id: 'conv_visible',
          channel: 'WEBCHAT',
          metadata: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'conv_visible',
          tenantKey: 'urucortinas',
          scope: 'CUSTOMER_PUBLIC',
          channel: 'WEBCHAT',
          status: 'OPEN',
          controlMode: 'AI',
          subject: '/shop',
          externalUserId: 'guest_visible',
          externalThreadId: 'webchat:guest_visible',
          externalChannelRef: '/shop',
          pinnedAt: null,
          lastMessageAt: new Date('2026-03-27T16:05:00.000Z'),
          lastInboundAt: new Date('2026-03-27T16:05:00.000Z'),
          lastOutboundAt: null,
          createdAt: new Date('2026-03-27T16:00:00.000Z'),
          updatedAt: new Date('2026-03-27T16:05:00.000Z'),
          needsHuman: false,
          metadata: null,
          customer: null,
          assignedToUser: null,
          inboxAccount: null,
          participants: [],
          messages: [],
          toolCalls: [],
        },
      ])

    const result = await service.listConversations({ page: 1, pageSize: 20 })

    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBe('conv_visible')
    expect(prisma.conversation.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: {
            in: ['conv_visible'],
          },
        },
      }),
    )
  })

  it('includes approved reply suggestions in conversation detail when knowledge is available', async () => {
    const knowledge = {
      suggestApprovedRepliesForConversation: vi.fn().mockResolvedValue({
        conversationId: 'conv_knowledge_1',
        targetMessageId: 'msg_customer_1',
        targetMessageText: 'Necesito ayuda con mi pedido',
        items: [
          {
            id: 'cand_approved_1',
            title: 'Seguimiento aprobado',
            summary: 'Respuesta validada por operación',
            responseText:
              'Perfecto, reviso el estado del pedido y te confirmo enseguida.',
            detectedIntent: 'order.status',
            confidence: 0.9,
            score: 187,
            matchedBy: ['dedupe', 'intent'],
            version: 2,
            source: {
              type: 'approved_candidate',
              candidateId: 'cand_approved_1',
              observationId: 'raw_1',
              reviewedAt: '2026-03-26T20:00:00.000Z',
            },
          },
        ],
      }),
    }
    const serviceWithKnowledge = new ConversationsService(
      prisma as never,
      config as never,
      undefined,
      knowledge as never,
    )

    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_knowledge_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WEBCHAT',
      status: 'OPEN',
      controlMode: 'AI',
      subject: 'Seguimiento',
      externalUserId: 'guest_9',
      externalThreadId: 'webchat:guest_9',
      externalChannelRef: '/orders',
      lastMessageAt: new Date('2026-03-26T20:05:00.000Z'),
      lastInboundAt: new Date('2026-03-26T20:00:00.000Z'),
      lastOutboundAt: null,
      createdAt: new Date('2026-03-26T19:00:00.000Z'),
      updatedAt: new Date('2026-03-26T20:05:00.000Z'),
      customer: null,
      assignedToUser: null,
      inboxAccount: null,
      participants: [],
      messages: [
        {
          id: 'msg_customer_1',
          authorType: 'CUSTOMER',
          kind: 'TEXT',
          body: 'Necesito ayuda con mi pedido',
          normalizedText: 'Necesito ayuda con mi pedido',
          payload: null,
          metadata: null,
          sentAt: null,
          receivedAt: null,
          createdAt: new Date('2026-03-26T20:00:00.000Z'),
          inboxMessage: {
            queue: null,
            events: [],
          },
        },
      ],
      handoffEvents: [],
      toolCalls: [],
    })

    const result = await serviceWithKnowledge.getConversation(
      'conv_knowledge_1',
      7,
    )

    expect(knowledge.suggestApprovedRepliesForConversation).toHaveBeenCalledWith({
      conversationId: 'conv_knowledge_1',
    })
    expect(result?.aiSuggestions).toMatchObject({
      conversationId: 'conv_knowledge_1',
      targetMessageId: 'msg_customer_1',
      targetMessageText: 'Necesito ayuda con mi pedido',
      items: [
        expect.objectContaining({
          id: 'cand_approved_1',
          responseText:
            'Perfecto, reviso el estado del pedido y te confirmo enseguida.',
        }),
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
        preferredLocale: true,
        preferredCurrency: true,
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
      role: 'customer_public',
      channel: 'webchat',
      controlMode: 'ai',
      needsHuman: false,
      participant: {
        guestId: 'guest_web_1',
        name: 'Rodrigo',
        email: 'rodrigo@example.com',
        locale: 'es-UY',
        currency: 'UYU',
      },
      context: {
        page: '/shop',
        currency: 'UYU',
      },
      aiState: null,
      messages: [],
    })
  })

  it('persists customer_authenticated scope for authenticated webchat sessions', async () => {
    config.get.mockReturnValue('urucortinas')
    prisma.customer.findFirst.mockResolvedValue({
      id: 91,
      name: 'Cliente logueado',
      email: 'cliente@ejemplo.com',
      phoneNumber: null,
    })
    prisma.conversation.create.mockResolvedValue({
      id: 'conv_webchat_auth_1',
    })

    const result = await service.createWebchatSession({
      guestId: 'guest_auth_1',
      name: 'Cliente logueado',
      email: 'cliente@ejemplo.com',
      authenticated: true,
      locale: 'es-UY',
      page: '/mi-cuenta',
    })

    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: 'CUSTOMER_AUTHENTICATED',
        }),
      }),
    )
    expect(result.scope).toBe('customer_authenticated')
  })

  it('appends a customer webchat message and updates conversation timestamps', async () => {
    const createdAt = new Date('2026-03-25T05:00:00.000Z')
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_webchat_2',
      channel: 'WEBCHAT',
      scope: 'CUSTOMER_PUBLIC',
      customerId: null,
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
        metadata: expect.objectContaining({
          messageElements: [
            {
              kind: 'text',
              source: 'message',
              label: 'mensaje',
              preview: 'Necesito ayuda con una cortina',
            },
          ],
          messageContextOrigin: ['message_text', 'message_element:text'],
        }),
        payload: expect.objectContaining({
          messageElements: [
            {
              kind: 'text',
              source: 'message',
              label: 'mensaje',
              preview: 'Necesito ayuda con una cortina',
            },
          ],
          messageContextOrigin: ['message_text', 'message_element:text'],
        }),
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
        metadata: {
          locale: 'es-UY',
          currency: 'UYU',
        },
      },
    })
    expect(result).toEqual({
      ok: true,
      conversationId: 'conv_webchat_2',
      conversation: {
        scope: 'customer_public',
        customerId: null,
      },
      message: {
        id: 'msg_webchat_2',
        body: 'Necesito ayuda con una cortina',
        createdAt,
      },
    })
  })

  it('persists interpreted message elements for attachment-based webchat messages', async () => {
    const createdAt = new Date('2026-03-25T05:05:00.000Z')
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_webchat_elements',
      channel: 'WEBCHAT',
      externalUserId: 'guest_elements',
    })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_webchat_elements',
      body: 'Registralo según el audio adjunto',
      createdAt,
    })

    await service.createWebchatMessage({
      conversationId: 'conv_webchat_elements',
      guestId: 'guest_elements',
      text: 'Registralo según el audio adjunto',
      attachments: [
        {
          assetType: 'audio',
          fileName: 'nota.webm',
          contentType: 'audio/webm',
          textContent:
            'Registrar cliente Carlos Rodriguez con correo carlos@example.com',
        },
      ],
    })

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_webchat_elements',
        metadata: expect.objectContaining({
          messageElements: [
            {
              kind: 'text',
              source: 'message',
              label: 'mensaje',
              preview: 'Registralo según el audio adjunto',
            },
            {
              kind: 'audio',
              source: 'attachment',
              label: 'nota.webm',
              preview:
                'Registrar cliente Carlos Rodriguez con correo carlos@example.com',
            },
          ],
          messageContextOrigin: ['message_text', 'message_element:text', 'message_element:audio'],
        }),
      }),
      select: {
        id: true,
        body: true,
        createdAt: true,
      },
    })
  })

  it('rejects webchat attachments with mismatched content types before persisting the message', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_webchat_invalid_attachment',
      channel: 'WEBCHAT',
      externalUserId: 'guest_invalid',
    })

    await expect(
      service.createWebchatMessage({
        conversationId: 'conv_webchat_invalid_attachment',
        guestId: 'guest_invalid',
        text: 'Te paso el archivo',
        attachments: [
          {
            assetType: 'pdf',
            fileName: 'malicioso.pdf',
            contentType: 'application/x-msdownload',
            content: 'data:application/x-msdownload;base64,TVo=',
          },
        ],
      }),
    ).rejects.toThrow('conversation.attachmentContentTypeMismatch')

    expect(prisma.conversationMessage.create).not.toHaveBeenCalled()
  })

  it('rejects binary attachments whose content signature does not match the declared format', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_webchat_invalid_signature',
      channel: 'WEBCHAT',
      externalUserId: 'guest_invalid_signature',
    })

    await expect(
      service.createWebchatMessage({
        conversationId: 'conv_webchat_invalid_signature',
        guestId: 'guest_invalid_signature',
        text: 'Te paso una imagen',
        attachments: [
          {
            assetType: 'image',
            fileName: 'captura.png',
            contentType: 'image/png',
            content: 'data:image/png;base64,aGVsbG8=',
          },
        ],
      }),
    ).rejects.toThrow('conversation.attachmentContentSignatureMismatch')

    expect(prisma.conversationMessage.create).not.toHaveBeenCalled()
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

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: 'conv_reply',
          authorType: 'OPERATOR',
          authorUserId: 9,
          body: 'Te comparto la respuesta',
          normalizedText: 'Te comparto la respuesta',
          metadata: expect.objectContaining({
            source: 'admin-reply',
            channel: 'webchat',
            deliveryStatus: 'internal_only',
            attachments: null,
            messageElements: [
              {
                kind: 'text',
                label: 'mensaje',
                source: 'message',
                preview: 'Te comparto la respuesta',
              },
            ],
            messageContextOrigin: ['message_text', 'message_element:text'],
          }),
          payload: expect.objectContaining({
            attachments: null,
            messageElements: [
              {
                kind: 'text',
                label: 'mensaje',
                source: 'message',
                preview: 'Te comparto la respuesta',
              },
            ],
            messageContextOrigin: ['message_text', 'message_element:text'],
          }),
        }),
        select: {
          id: true,
          createdAt: true,
        },
      }),
    )
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
            audit: {
              role: 'customer_public',
              intentKey: 'customer.light',
              actionKey: null,
              stage: 'deterministic_decision',
              stageHistory: ['intent_detection', 'deterministic_decision'],
              blockedTools: [],
              executedTools: [],
              toolCalls: [],
              referencedMessages: [
                {
                  messageId: 'msg_customer_1',
                  createdAt: createdAt.toISOString(),
                  preview: 'Hola',
                },
              ],
              detail: 'saludo simple resuelto localmente',
              input: 'Hola',
              grounded: false,
              needsHuman: false,
              fallbackReason: null,
              fallbackActivated: false,
              taskChanged: false,
              createdAt: createdAt.toISOString(),
            },
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
            metadata: {
              source: 'ai-agent-service',
              provider: 'mock',
              aiResponse: {
                finalUserText: 'Estas son las opciones encontradas',
                debugSummary: '[debug]\netapa=deterministic_decision',
                auditPayload: {
                  stage: 'deterministic_decision',
                },
              },
            },
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
      body: 'Estas son las opciones encontradas\n\n[debug]\netapa=deterministic_decision',
      finalUserText: 'Estas son las opciones encontradas',
      debugSummary: '[debug]\netapa=deterministic_decision',
      auditPayload: {
        stage: 'deterministic_decision',
        stageHistory: ['intent_detection', 'deterministic_decision'],
        intentSource: 'hybrid',
        intentConfidence: 0.84,
        decisionPath: ['message:direct_rule', 'context:message_element'],
        referencedMessages: [
          {
            messageId: 'msg_customer_1',
            createdAt: createdAt.toISOString(),
            preview: 'Hola',
          },
        ],
        messageElementsUsed: ['audio'],
        messageElements: [
          {
            kind: 'audio',
            source: 'openai_audio',
            label: 'nota.webm',
            preview: 'Registrar cliente Carlos...',
          },
        ],
        messageContextOrigin: ['message_text', 'message_element:audio'],
      },
      metadata: {
        provider: 'mock',
        aiMemory: {
          taskId: 'conv_agent_reply:1',
          intentKey: 'customers.create',
          state: 'WAITING_CONFIRMATION',
          stateHistory: [
            'IDLE',
            'INTENT_DETECTED',
            'DRAFT_CREATED',
            'WAITING_CONFIRMATION',
          ],
          lastTransitionAt: createdAt.toISOString(),
        },
      },
    })

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_agent_reply',
        authorType: 'AGENT',
        body: 'Estas son las opciones encontradas',
        normalizedText: 'Estas son las opciones encontradas',
        metadata: expect.objectContaining({
          source: 'ai-agent-service',
          provider: 'mock',
          channel: 'webchat',
          deliveryStatus: 'internal_only',
          aiResponse: expect.objectContaining({
            finalUserText: 'Estas son las opciones encontradas',
            debugSummary: '[debug]\netapa=deterministic_decision',
            auditPayload: expect.objectContaining({
              stage: 'deterministic_decision',
            }),
          }),
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
        metadata: expect.objectContaining({
          aiState: expect.objectContaining({
            memory: expect.objectContaining({
              state: 'WAITING_CONFIRMATION',
              stateHistory: [
                'IDLE',
                'INTENT_DETECTED',
                'DRAFT_CREATED',
                'WAITING_CONFIRMATION',
              ],
              lastTransitionAt: createdAt.toISOString(),
            }),
            audit: expect.objectContaining({
              intentSource: 'hybrid',
              intentConfidence: 0.84,
              decisionPath: ['message:direct_rule', 'context:message_element'],
              messageElementsUsed: ['audio'],
              messageContextOrigin: ['message_text', 'message_element:audio'],
              messageElements: [
                {
                  kind: 'audio',
                  source: 'openai_audio',
                  label: 'nota.webm',
                  preview: 'Registrar cliente Carlos...',
                },
              ],
            }),
          }),
        }),
      }),
    })
    expect(result).toMatchObject({
      id: 'conv_agent_reply',
      controlMode: 'ai',
      aiState: {
        grounded: false,
        needsHuman: false,
        audit: {
          stage: 'deterministic_decision',
          detail: 'saludo simple resuelto localmente',
          referencedMessages: [
            {
              preview: 'Hola',
            },
          ],
        },
      },
      latestMessage: {
        authorType: 'agent',
        body: 'Estas son las opciones encontradas',
      },
    })
  })

  it('records approved suggestion feedback when an operator replies from a suggested answer', async () => {
    const createdAt = new Date('2026-03-26T23:55:00.000Z')
    const knowledge = {
      recordSuggestionFeedback: vi.fn().mockResolvedValue({
        id: 'feedback_1',
        outcome: 'edited',
        candidateId: 'cand_approved_1',
        conversationId: 'conv_reply_feedback',
        operatorMessageId: 'msg_operator_feedback',
        createdAt,
      }),
      captureConversationMessage: vi.fn().mockResolvedValue({
        status: 'attached',
      }),
      suggestApprovedRepliesForConversation: vi.fn().mockResolvedValue({
        conversationId: 'conv_reply_feedback',
        targetMessageId: null,
        items: [],
      }),
    }
    const serviceWithKnowledge = new ConversationsService(
      prisma as never,
      config as never,
      undefined,
      knowledge as never,
    )

    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_reply_feedback',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'OPEN',
        controlMode: 'HUMAN',
        subject: 'Consulta',
        externalUserId: 'guest_77',
        externalThreadId: 'webchat:guest_77',
        externalChannelRef: '/shop',
        metadata: null,
        createdAt,
        updatedAt: createdAt,
        customer: null,
        assignedToUser: {
          id: 9,
          name: 'Operador',
          email: 'operador@example.com',
        },
        inboxAccount: null,
        participants: [],
        messages: [],
        handoffEvents: [],
        toolCalls: [],
      })
      .mockResolvedValueOnce({
        id: 'conv_reply_feedback',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        status: 'WAITING_CUSTOMER',
        controlMode: 'HUMAN',
        needsHuman: false,
        subject: 'Consulta',
        externalUserId: 'guest_77',
        externalThreadId: 'webchat:guest_77',
        externalChannelRef: '/shop',
        metadata: null,
        createdAt,
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
            id: 'msg_operator_feedback',
            authorType: 'OPERATOR',
            kind: 'TEXT',
            body: 'Perfecto, reviso el estado y te confirmo hoy mismo.',
            normalizedText: 'Perfecto, reviso el estado y te confirmo hoy mismo.',
            payload: null,
            metadata: { source: 'admin-reply' },
            sentAt: createdAt,
            receivedAt: null,
            createdAt,
            inboxMessage: {
              queue: null,
              events: [],
            },
          },
        ],
        handoffEvents: [],
        toolCalls: [],
      })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_operator_feedback',
      createdAt,
    })

    await serviceWithKnowledge.replyAsOperator(
      'conv_reply_feedback',
      {
        body: 'Perfecto, reviso el estado y te confirmo hoy mismo.',
        kind: 'text',
        aiSuggestionFeedback: {
          candidateId: 'cand_approved_1',
          targetMessageId: 'msg_customer_1',
          targetMessageText: 'Necesito ayuda con mi pedido',
          suggestedText:
            'Perfecto, reviso el estado y te confirmo enseguida.',
          outcome: 'edited',
        },
      },
      9,
    )

    expect(knowledge.recordSuggestionFeedback).toHaveBeenCalledWith({
      conversationId: 'conv_reply_feedback',
      candidateId: 'cand_approved_1',
      actorUserId: 9,
      outcome: 'edited',
      targetMessageId: 'msg_customer_1',
      targetMessageText: 'Necesito ayuda con mi pedido',
      suggestedText: 'Perfecto, reviso el estado y te confirmo enseguida.',
      finalText: 'Perfecto, reviso el estado y te confirmo hoy mismo.',
      operatorMessageId: 'msg_operator_feedback',
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

  it('persists an operator email reply as failed delivery when external dispatch fails', async () => {
    const createdAt = new Date('2026-03-27T18:10:00.000Z')
    const inboxService = {
      sendMessage: vi
        .fn()
        .mockRejectedValue(
          new Error(
            'Email channel adapter credentials are not configured. Review INBOX_EMAIL_* environment variables.',
          ),
        ),
    }
    const serviceWithInbox = new ConversationsService(
      prisma as never,
      config as never,
      inboxService as never,
    )

    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_email_failed_reply',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'EMAIL',
        status: 'WAITING_INTERNAL',
        controlMode: 'HUMAN',
        subject: 'Consulta email',
        inboxAccountId: 'acc_email',
        externalUserId: 'cliente@example.com',
        externalThreadId: 'thread-email-1',
        externalChannelRef: 'cliente@example.com',
        lastMessageAt: createdAt,
        lastInboundAt: createdAt,
        lastOutboundAt: null,
        createdAt,
        updatedAt: createdAt,
        customer: {
          id: 44,
          name: 'Cliente Email',
          email: 'cliente@example.com',
          phoneNumber: null,
        },
        assignedToUser: {
          id: 9,
          name: 'Operador',
          email: 'operador@example.com',
        },
        inboxAccount: {
          id: 'acc_email',
          displayName: 'Desarrollo Software-Strategy',
          address: 'desarrollo@software-strategy.com',
          channel: 'EMAIL',
        },
        participants: [],
        messages: [],
      })
      .mockResolvedValueOnce({
        id: 'conv_email_failed_reply',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'EMAIL',
        status: 'WAITING_INTERNAL',
        controlMode: 'HUMAN',
        needsHuman: false,
        subject: 'Consulta email',
        inboxAccountId: 'acc_email',
        externalUserId: 'cliente@example.com',
        externalThreadId: 'thread-email-1',
        externalChannelRef: 'cliente@example.com',
        metadata: null,
        createdAt,
        updatedAt: createdAt,
        customer: {
          id: 44,
          name: 'Cliente Email',
          email: 'cliente@example.com',
          phoneNumber: null,
        },
        assignedToUser: {
          id: 9,
          name: 'Operador',
          email: 'operador@example.com',
        },
        inboxAccount: {
          id: 'acc_email',
          displayName: 'Desarrollo Software-Strategy',
          address: 'desarrollo@software-strategy.com',
          channel: 'EMAIL',
        },
        participants: [],
        messages: [
          {
            id: 'msg_email_failed_reply',
            authorType: 'OPERATOR',
            kind: 'EMAIL',
            body: 'Te respondo por este medio.',
            normalizedText: 'Te respondo por este medio.',
            payload: null,
            metadata: {
              source: 'admin-reply',
              channel: 'email',
              deliveryStatus: 'failed',
              errorCode: 'dispatch_failed',
              errorMessage:
                'Email channel adapter credentials are not configured. Review INBOX_EMAIL_* environment variables.',
            },
            sentAt: createdAt,
            receivedAt: null,
            createdAt,
            inboxMessage: {
              queue: null,
              events: [],
            },
          },
        ],
        handoffEvents: [],
        toolCalls: [],
      })

    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_email_failed_reply',
      createdAt,
    })

    const result = await serviceWithInbox.replyAsOperator(
      'conv_email_failed_reply',
      {
        body: 'Te respondo por este medio.',
        kind: 'text',
      },
      9,
    )

    expect(inboxService.sendMessage).toHaveBeenCalled()
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'EMAIL',
          metadata: expect.objectContaining({
            channel: 'email',
            deliveryStatus: 'failed',
            errorCode: 'dispatch_failed',
            errorMessage:
              'Email channel adapter credentials are not configured. Review INBOX_EMAIL_* environment variables.',
          }),
        }),
      }),
    )
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_email_failed_reply' },
      data: {
        controlMode: 'HUMAN',
        assignedToUserId: 9,
        lastMessageAt: createdAt,
        lastOutboundAt: createdAt,
        status: 'WAITING_INTERNAL',
      },
    })
    expect(result).toMatchObject({
      id: 'conv_email_failed_reply',
      latestMessage: {
        authorType: 'operator',
        kind: 'email',
        preview: 'Te respondo por este medio.',
      },
    })
  })

  it('forces handoff when an agent reply cannot be delivered through email', async () => {
    const createdAt = new Date('2026-03-27T18:20:00.000Z')
    const inboxService = {
      sendMessage: vi
        .fn()
        .mockRejectedValue(
          new Error(
            'Email channel adapter credentials are not configured. Review INBOX_EMAIL_* environment variables.',
          ),
        ),
    }
    const serviceWithInbox = new ConversationsService(
      prisma as never,
      config as never,
      inboxService as never,
    )

    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_agent_email_failed',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'EMAIL',
        status: 'WAITING_INTERNAL',
        controlMode: 'AI',
        subject: 'Consulta email',
        inboxAccountId: 'acc_email',
        externalUserId: 'cliente@example.com',
        externalThreadId: 'thread-email-2',
        externalChannelRef: 'cliente@example.com',
        lastMessageAt: createdAt,
        lastInboundAt: createdAt,
        lastOutboundAt: null,
        createdAt,
        updatedAt: createdAt,
        metadata: null,
        customer: {
          id: 45,
          name: 'Cliente Email',
          email: 'cliente@example.com',
          phoneNumber: null,
        },
        assignedToUser: null,
        inboxAccount: {
          id: 'acc_email',
          displayName: 'Desarrollo Software-Strategy',
          address: 'desarrollo@software-strategy.com',
          channel: 'EMAIL',
        },
        participants: [],
        messages: [],
      })
      .mockResolvedValueOnce({
        id: 'conv_agent_email_failed',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'EMAIL',
        status: 'WAITING_INTERNAL',
        controlMode: 'HUMAN',
        needsHuman: true,
        subject: 'Consulta email',
        inboxAccountId: 'acc_email',
        externalUserId: 'cliente@example.com',
        externalThreadId: 'thread-email-2',
        externalChannelRef: 'cliente@example.com',
        metadata: {
          aiState: {
            needsHuman: true,
            grounded: false,
            fallbackReason: 'outbound_dispatch_failed',
            sourceCount: 0,
            sources: [],
            updatedAt: createdAt.toISOString(),
          },
        },
        createdAt,
        updatedAt: createdAt,
        customer: {
          id: 45,
          name: 'Cliente Email',
          email: 'cliente@example.com',
          phoneNumber: null,
        },
        assignedToUser: null,
        inboxAccount: {
          id: 'acc_email',
          displayName: 'Desarrollo Software-Strategy',
          address: 'desarrollo@software-strategy.com',
          channel: 'EMAIL',
        },
        participants: [],
        messages: [
          {
            id: 'msg_agent_email_failed',
            authorType: 'AGENT',
            kind: 'EMAIL',
            body: 'Te comparto la respuesta automática.',
            normalizedText: 'Te comparto la respuesta automática.',
            payload: null,
            metadata: {
              source: 'ai-agent-service',
              channel: 'email',
              deliveryStatus: 'failed',
              errorCode: 'dispatch_failed',
              errorMessage:
                'Email channel adapter credentials are not configured. Review INBOX_EMAIL_* environment variables.',
              ai: {
                needsHuman: true,
                fallbackReason: 'outbound_dispatch_failed',
              },
            },
            sentAt: createdAt,
            receivedAt: null,
            createdAt,
            inboxMessage: {
              queue: null,
              events: [],
            },
          },
        ],
        handoffEvents: [],
        toolCalls: [],
      })

    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_agent_email_failed',
      createdAt,
    })

    await serviceWithInbox.replyAsAgent('conv_agent_email_failed', {
      body: 'Te comparto la respuesta automática.',
      finalUserText: 'Te comparto la respuesta automática.',
      metadata: {
        provider: 'mock',
        channel: 'email',
      },
      auditPayload: {
        stage: 'deterministic_answer',
      },
    })

    expect(inboxService.sendMessage).toHaveBeenCalled()
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_agent_email_failed' },
      data: expect.objectContaining({
        controlMode: 'HUMAN',
        needsHuman: true,
        status: 'WAITING_INTERNAL',
        metadata: expect.objectContaining({
          aiState: expect.objectContaining({
            needsHuman: true,
            fallbackReason: 'outbound_dispatch_failed',
          }),
        }),
      }),
    })
    expect(prisma.conversationHandoffEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_agent_email_failed',
        notes:
          'Email channel adapter credentials are not configured. Review INBOX_EMAIL_* environment variables.',
        metadata: expect.objectContaining({
          reason: 'outbound_dispatch_failed',
        }),
      }),
    })
  })

  it('dispatches WhatsApp QR outbound replies through the QR adapter route', async () => {
    const createdAt = new Date('2026-03-28T18:00:00.000Z')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          provider: 'whatsapp-qr',
          remoteId: 'waqr-remote-1',
          providerMessageId: 'waqr-provider-1',
          threadRemoteId: 'thread-waqr-1',
          deliveryStatus: 'sent',
        }),
    })

    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(service, 'getConversation').mockResolvedValue({
      id: 'conv_whatsapp_qr',
    } as never)
    vi.spyOn(service as any, 'captureKnowledgeMessage').mockResolvedValue(undefined)

    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_whatsapp_qr',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WHATSAPP',
      status: 'WAITING_CUSTOMER',
      controlMode: 'HUMAN',
      subject: 'Consulta QR',
      inboxAccountId: 'acc_whatsapp_qr',
      externalUserId: '59890000001',
      externalThreadId: '59890000001@lid',
      externalChannelRef: null,
      lastMessageAt: createdAt,
      lastInboundAt: createdAt,
      lastOutboundAt: null,
      createdAt,
      updatedAt: createdAt,
      customer: null,
      assignedToUser: {
        id: 9,
        name: 'Operador',
        email: 'operador@example.com',
      },
      inboxAccount: {
        id: 'acc_whatsapp_qr',
        displayName: 'WhatsApp QR',
        address: '59890000099',
        channel: 'WHATSAPP',
        metadata: {
          transport: 'whatsapp_qr',
        },
      },
      participants: [],
      messages: [
        {
          id: 'latest_msg_waqr',
          inboxMessageId: 'inbox_inbound_waqr',
          inboxMessage: {
            id: 'inbox_inbound_waqr',
            threadRemoteId: '59890000001@lid',
            queueId: 'queue_social',
            queue: {
              id: 'queue_social',
              slug: 'social',
              name: 'Social',
            },
          },
        },
      ],
    })
    prisma.inboxMessage.create.mockResolvedValue({ id: 'inbox_msg_waqr' })
    prisma.inboxMessageEvent.create.mockResolvedValue({ id: 'evt_waqr' })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'conv_msg_waqr',
      createdAt,
    })

    await service.replyAsOperator(
      'conv_whatsapp_qr',
      {
        body: 'Te respondo por WhatsApp QR.',
        kind: 'text',
      },
      9,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'http://channel-adapter:4200/dispatch/whatsapp-qr',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-ai-internal-token': 'local-ai-internal-token',
        }),
      }),
    )
    const dispatchPayload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(dispatchPayload).toMatchObject({
      recipientId: '59890000001',
      threadId: '59890000001@lid',
    })
    expect(prisma.inboxMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'acc_whatsapp_qr',
        provider: 'whatsapp-qr',
        toAddresses: ['59890000001'],
        queueId: 'queue_social',
      }),
      select: {
        id: true,
      },
    })
  })

  it('replies to a webchat message with quoted context and stores the operator response', async () => {
    const createdAt = new Date('2026-03-28T18:30:00.000Z')
    vi.spyOn(service as any, 'captureKnowledgeMessage').mockResolvedValue(undefined)

    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_webchat_quote',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WEBCHAT',
      status: 'WAITING_INTERNAL',
      controlMode: 'HUMAN',
      subject: 'Consulta webchat',
      inboxAccountId: null,
      externalUserId: 'guest_quoted',
      externalThreadId: 'webchat:guest_quoted',
      externalChannelRef: '/shop',
      lastMessageAt: createdAt,
      lastInboundAt: createdAt,
      lastOutboundAt: null,
      createdAt,
      updatedAt: createdAt,
      customer: null,
      inboxAccount: null,
      participants: [],
      messages: [],
    })
    prisma.conversationMessage.findFirst.mockResolvedValue({
      id: 'msg_webchat_source',
      conversationId: 'conv_webchat_quote',
      inboxMessageId: null,
      externalMessageId: null,
      authorType: 'CUSTOMER',
      kind: 'TEXT',
      body: 'Necesito más info',
      normalizedText: 'Necesito más info',
      payload: null,
      metadata: null,
      createdAt,
    })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_webchat_reply',
      createdAt,
    })
    prisma.conversation.update.mockResolvedValue({ id: 'conv_webchat_quote' })

    const result = await service.replyToWebchatMessage(
      'conv_webchat_quote',
      'msg_webchat_source',
      { body: 'Claro, te paso opciones.' },
      9,
    )

    expect(result).toMatchObject({
      ok: true,
      conversationId: 'conv_webchat_quote',
      messageId: 'msg_webchat_reply',
      quotedMessageId: 'msg_webchat_source',
    })
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_webchat_quote',
        authorType: 'OPERATOR',
        body: 'Claro, te paso opciones.',
        metadata: expect.objectContaining({
          quotedMessageId: 'msg_webchat_source',
          quotedMessagePreview: 'Necesito más info',
        }),
        payload: expect.objectContaining({
          quotedMessageId: 'msg_webchat_source',
          quotedMessagePreview: 'Necesito más info',
        }),
      }),
      select: {
        id: true,
        createdAt: true,
      },
    })
  })

  it('edits and deletes operator webchat messages without channel dispatch', async () => {
    const createdAt = new Date('2026-03-28T18:40:00.000Z')

    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_webchat_manage',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WEBCHAT',
      status: 'WAITING_CUSTOMER',
      controlMode: 'HUMAN',
      subject: 'Consulta webchat',
      inboxAccountId: null,
      externalUserId: 'guest_manage',
      externalThreadId: 'webchat:guest_manage',
      externalChannelRef: '/shop',
      lastMessageAt: createdAt,
      lastInboundAt: createdAt,
      lastOutboundAt: createdAt,
      createdAt,
      updatedAt: createdAt,
      customer: null,
      inboxAccount: null,
      participants: [],
      messages: [],
    })
    prisma.conversationMessage.findFirst.mockResolvedValue({
      id: 'msg_webchat_manage',
      conversationId: 'conv_webchat_manage',
      inboxMessageId: null,
      externalMessageId: null,
      authorType: 'OPERATOR',
      kind: 'TEXT',
      body: 'Mensaje original',
      normalizedText: 'Mensaje original',
      payload: { authorKind: 'operator_human', messageKind: 'human_message' },
      metadata: { source: 'admin-reply' },
      createdAt,
    })
    prisma.conversationMessage.update.mockResolvedValue({
      id: 'msg_webchat_manage',
    })

    const editResult = await service.editWebchatMessage(
      'conv_webchat_manage',
      'msg_webchat_manage',
      { body: 'Mensaje corregido' },
      9,
    )
    expect(editResult).toMatchObject({
      ok: true,
      messageId: 'msg_webchat_manage',
      body: 'Mensaje corregido',
    })
    expect(prisma.conversationMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg_webchat_manage' },
      data: expect.objectContaining({
        body: 'Mensaje corregido',
        normalizedText: 'Mensaje corregido',
        metadata: expect.objectContaining({
          source: 'admin-reply',
          editedByUserId: 9,
        }),
      }),
    })

    const deleteResult = await service.deleteWebchatMessage(
      'conv_webchat_manage',
      'msg_webchat_manage',
      9,
    )
    expect(deleteResult).toMatchObject({
      ok: true,
      messageId: 'msg_webchat_manage',
      deleted: true,
    })
    expect(prisma.conversationMessage.update).toHaveBeenLastCalledWith({
      where: { id: 'msg_webchat_manage' },
      data: expect.objectContaining({
        body: 'Mensaje eliminado',
        normalizedText: 'Mensaje eliminado',
        payload: expect.objectContaining({
          deleted: true,
        }),
        metadata: expect.objectContaining({
          source: 'admin-reply',
          deleted: true,
          deletedByUserId: 9,
        }),
      }),
    })
  })

  it('keeps Meta outbound dispatch for standard WhatsApp conversations', async () => {
    const createdAt = new Date('2026-03-28T18:10:00.000Z')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          provider: 'meta-graph',
          remoteId: 'meta-remote-1',
          providerMessageId: 'meta-provider-1',
          threadRemoteId: 'thread-meta-1',
          deliveryStatus: 'sent',
        }),
    })

    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(service, 'getConversation').mockResolvedValue({
      id: 'conv_whatsapp_meta',
    } as never)
    vi.spyOn(service as any, 'captureKnowledgeMessage').mockResolvedValue(undefined)

    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_whatsapp_meta',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WHATSAPP',
      status: 'WAITING_CUSTOMER',
      controlMode: 'HUMAN',
      subject: 'Consulta Meta',
      inboxAccountId: 'acc_whatsapp_meta',
      externalUserId: '59890000002',
      externalThreadId: 'thread-meta-1',
      externalChannelRef: null,
      lastMessageAt: createdAt,
      lastInboundAt: createdAt,
      lastOutboundAt: null,
      createdAt,
      updatedAt: createdAt,
      customer: null,
      assignedToUser: {
        id: 9,
        name: 'Operador',
        email: 'operador@example.com',
      },
      inboxAccount: {
        id: 'acc_whatsapp_meta',
        displayName: 'WhatsApp Meta',
        address: 'wameta',
        channel: 'WHATSAPP',
        metadata: {
          transport: 'meta',
        },
      },
      participants: [],
      messages: [],
    })
    prisma.inboxMessage.create.mockResolvedValue({ id: 'inbox_msg_meta' })
    prisma.inboxMessageEvent.create.mockResolvedValue({ id: 'evt_meta' })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'conv_msg_meta',
      createdAt,
    })

    await service.replyAsOperator(
      'conv_whatsapp_meta',
      {
        body: 'Te respondo por Meta.',
        kind: 'text',
      },
      9,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'http://channel-adapter:4200/dispatch/meta',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(prisma.inboxMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'acc_whatsapp_meta',
        provider: 'meta-graph',
        toAddresses: ['59890000002'],
      }),
      select: {
        id: true,
      },
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
    config.get.mockImplementation((key: string) => {
      if (key === 'INBOX_EMAIL_DEFAULT_FROM') {
        return 'desarrollo@software-strategy.com'
      }
      return undefined
    })
    prisma.inboxAccount.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
      id: 'acc_email',
      displayName: 'Desarrollo Software-Strategy',
      address: 'desarrollo@software-strategy.com',
      channel: 'EMAIL',
      metadata: {
        defaults: {
          fromAddress: 'desarrollo@software-strategy.com',
        },
        imap: { host: 'mail.software-strategy.com' },
        smtp: { host: 'mail.software-strategy.com' },
        validation: {
          smtpTlsVerifiedAt: '2026-03-27T20:00:00.000Z',
          imapTlsVerifiedAt: '2026-03-27T20:00:00.000Z',
          smtpVerifyVerifiedAt: '2026-03-27T20:00:00.000Z',
          verifiedAt: '2026-03-27T20:00:00.000Z',
        },
      },
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
    expect(prisma.inboxAccount.upsert).not.toHaveBeenCalled()
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

  it('creates a logical inbox account for inbound email when no operational inbox is configured', async () => {
    const createdAt = new Date('2026-03-25T04:05:00.000Z')
    prisma.inboxAccount.findUnique.mockResolvedValue(null)
    prisma.inboxAccount.upsert.mockResolvedValue({
      id: 'acc_email_fallback',
      displayName: 'ventas@test.local',
      address: 'ventas@test.local',
      channel: 'EMAIL',
      active: true,
      metadata: {
        source: 'conversation-hub',
        operational: false,
      },
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
      id: 'conv_email_fallback',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'EMAIL',
      status: 'OPEN',
      controlMode: 'AI',
      subject: 'Consulta fallback',
      customerId: null,
      inboxAccountId: 'acc_email_fallback',
      externalUserId: 'cliente@example.com',
      externalThreadId: 'thread-fallback-1',
      externalChannelRef: null,
      metadata: {},
    })
    prisma.conversationParticipant.findFirst.mockResolvedValue(null)
    prisma.conversationParticipant.create.mockResolvedValue({
      id: 'part_email_fallback',
    })
    prisma.conversationMessage.findFirst.mockResolvedValue(null)
    prisma.inboxMessage.create.mockResolvedValue({
      id: 'inbox_msg_fallback_1',
    })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'conv_msg_fallback_1',
      createdAt,
    })

    const result = await service.ingestInboundMessage({
      tenantKey: 'urucortinas',
      channel: 'email',
      userId: 'cliente@example.com',
      inboxAddress: 'ventas@test.local',
      subject: 'Consulta fallback',
      threadId: 'thread-fallback-1',
      externalMessageId: 'remote-fallback-1',
      text: 'Necesito respuesta por correo',
      metadata: { provider: 'imap-test' },
    })

    expect(prisma.inboxAccount.upsert).toHaveBeenCalledWith({
      where: {
        channel_address: {
          channel: 'EMAIL',
          address: 'ventas@test.local',
        },
      },
      update: {
        displayName: 'ventas@test.local',
        active: true,
        metadata: {
          source: 'conversation-hub',
          operational: false,
        },
      },
      create: {
        channel: 'EMAIL',
        address: 'ventas@test.local',
        displayName: 'ventas@test.local',
        active: true,
        metadata: {
          source: 'conversation-hub',
          operational: false,
        },
      },
    })
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inboxAccountId: 'acc_email_fallback',
        }),
      }),
    )
    expect(result).toMatchObject({
      conversationId: 'conv_email_fallback',
      channel: 'email',
      queue: {
        slug: 'support',
      },
    })
  })

  it('routes inbound WhatsApp QR messages into the QR inbox instead of the meta fallback inbox', async () => {
    const createdAt = new Date('2026-03-28T20:50:00.000Z')
    prisma.inboxAccount.findFirst.mockResolvedValue({
      id: 'acc_whatsapp_qr',
      channel: 'WHATSAPP',
      displayName: 'WhatsApp QR',
      address: '59891234567',
      metadata: { transport: 'whatsapp_qr' },
    })
    prisma.inboxAccount.update.mockResolvedValue({
      id: 'acc_whatsapp_qr',
      channel: 'WHATSAPP',
      displayName: 'WhatsApp QR',
      address: '59891234567',
      metadata: { transport: 'whatsapp_qr', source: 'conversation-hub' },
    })
    prisma.inboxQueue.upsert.mockResolvedValue({
      id: 'queue_social',
      slug: 'social',
      name: 'Social',
      assignmentMode: 'MANUAL',
      maxAssignedConversations: 10,
      slaTargetMinutes: 20,
      assignments: [],
    })
    prisma.customer.findFirst.mockResolvedValue(null)
    prisma.conversation.findFirst.mockResolvedValue(null)
    prisma.conversation.create.mockResolvedValue({
      id: 'conv_whatsapp_qr',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WHATSAPP',
      status: 'WAITING_INTERNAL',
      controlMode: 'AI',
      subject: 'Inbound whatsapp',
      customerId: null,
      inboxAccountId: 'acc_whatsapp_qr',
      assignedToUserId: null,
      externalUserId: '59890000002',
      externalThreadId: '59890000002@s.whatsapp.net',
      externalChannelRef: null,
      metadata: {},
    })
    prisma.conversationParticipant.findFirst.mockResolvedValue(null)
    prisma.conversationParticipant.create.mockResolvedValue({
      id: 'part_wa_qr',
    })
    prisma.conversationMessage.findFirst.mockResolvedValue(null)
    prisma.inboxMessage.create.mockResolvedValue({
      id: 'inbox_msg_wa_qr',
    })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'conv_msg_wa_qr',
      createdAt,
    })

    await service.ingestInboundMessage({
      tenantKey: 'urucortinas',
      channel: 'whatsapp',
      userId: '59890000002',
      inboxAddress: '59891234567',
      threadId: '59890000002@s.whatsapp.net',
      externalMessageId: 'wa-qr-1',
      text: 'Hola desde WhatsApp QR',
      metadata: { transport: 'whatsapp_qr' },
    })

    expect(prisma.inboxAccount.upsert).not.toHaveBeenCalled()
    expect(prisma.inboxAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc_whatsapp_qr' },
      data: {
        displayName: 'WhatsApp QR',
        address: '59891234567',
        active: true,
        metadata: {
          transport: 'whatsapp_qr',
          source: 'conversation-hub',
        },
      },
    })
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inboxAccountId: 'acc_whatsapp_qr',
        }),
      }),
    )
  })

  it('reacts to a WhatsApp QR message through the adapter route', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          provider: 'whatsapp-qr',
          threadRemoteId: '59890000001@lid',
          messageId: 'wamid.msg-1',
          emoji: '👍',
        }),
    })

    vi.stubGlobal('fetch', fetchMock)

    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_whatsapp_qr',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WHATSAPP',
      status: 'WAITING_CUSTOMER',
      controlMode: 'HUMAN',
      subject: 'Consulta QR',
      inboxAccountId: 'acc_whatsapp_qr',
      externalUserId: '59890000001',
      externalThreadId: '59890000001@lid',
      externalChannelRef: null,
      customer: null,
      inboxAccount: {
        id: 'acc_whatsapp_qr',
        displayName: 'WhatsApp QR',
        address: '59890000099',
        channel: 'WHATSAPP',
        metadata: {
          transport: 'whatsapp_qr',
        },
      },
      participants: [],
      messages: [],
    })
    prisma.conversationMessage.findFirst.mockResolvedValue({
      id: 'msg_source',
      conversationId: 'conv_whatsapp_qr',
      inboxMessageId: 'inbox_source',
      externalMessageId: 'wamid.msg-1',
      authorType: 'CUSTOMER',
      kind: 'TEXT',
      body: 'Hola',
      normalizedText: 'Hola',
      payload: null,
      metadata: {
        whatsapp: {
          messageKey: {
            remoteJid: '59890000001@lid',
            id: 'wamid.msg-1',
            fromMe: false,
          },
          messageSnapshot: {
            key: {
              remoteJid: '59890000001@lid',
              id: 'wamid.msg-1',
              fromMe: false,
            },
            message: {
              conversation: 'Hola',
            },
          },
        },
      },
      createdAt: new Date('2026-03-28T18:20:00.000Z'),
      inboxMessage: {
        id: 'inbox_source',
        remoteId: 'wamid.msg-1',
        threadRemoteId: '59890000001@lid',
        metadata: null,
      },
    })
    prisma.inboxMessageEvent.create.mockResolvedValue({ id: 'evt_reaction' })

    const result = await service.reactToWhatsappMessage(
      'conv_whatsapp_qr',
      'msg_source',
      { emoji: '👍' },
      9,
    )

    expect(result).toMatchObject({
      ok: true,
      conversationId: 'conv_whatsapp_qr',
      messageId: 'msg_source',
      emoji: '👍',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://channel-adapter:4200/channels/whatsapp-qr/message/reaction',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload).toMatchObject({
      threadId: '59890000001@lid',
      messageId: 'wamid.msg-1',
      emoji: '👍',
    })
    expect(prisma.inboxMessageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        messageId: 'inbox_source',
        type: 'SYNCED',
        payload: expect.objectContaining({
          action: 'reaction_sent',
          emoji: '👍',
        }),
      }),
    })
  })

  it('forwards a WhatsApp QR message into another WhatsApp QR conversation', async () => {
    const createdAt = new Date('2026-03-28T18:30:00.000Z')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          provider: 'whatsapp-qr',
          remoteId: 'waqr-forward-1',
          providerMessageId: 'waqr-forward-provider-1',
          threadRemoteId: '59890000002@lid',
          deliveryStatus: 'accepted',
          metadata: {
            whatsapp: {
              messageKey: {
                remoteJid: '59890000002@lid',
                id: 'waqr-forward-1',
                fromMe: true,
              },
            },
          },
        }),
    })

    vi.stubGlobal('fetch', fetchMock)
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conv_source',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WHATSAPP',
        status: 'WAITING_CUSTOMER',
        controlMode: 'HUMAN',
        subject: 'Origen',
        inboxAccountId: 'acc_whatsapp_qr',
        externalUserId: '59890000001',
        externalThreadId: '59890000001@lid',
        customer: null,
        inboxAccount: {
          id: 'acc_whatsapp_qr',
          displayName: 'WhatsApp QR',
          address: '59890000099',
          channel: 'WHATSAPP',
          metadata: { transport: 'whatsapp_qr' },
        },
        participants: [],
        messages: [],
      })
      .mockResolvedValueOnce({
        id: 'conv_target',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WHATSAPP',
        status: 'WAITING_CUSTOMER',
        controlMode: 'HUMAN',
        subject: 'Destino',
        inboxAccountId: 'acc_whatsapp_qr',
        externalUserId: '59890000002',
        externalThreadId: '59890000002@lid',
        customer: null,
        inboxAccount: {
          id: 'acc_whatsapp_qr',
          displayName: 'WhatsApp QR',
          address: '59890000099',
          channel: 'WHATSAPP',
          metadata: { transport: 'whatsapp_qr' },
        },
        participants: [],
        messages: [
          {
            id: 'latest_msg',
            inboxMessageId: 'inbox_latest',
            inboxMessage: {
              id: 'inbox_latest',
              threadRemoteId: '59890000002@lid',
              queueId: 'queue_social',
              queue: {
                id: 'queue_social',
                slug: 'social',
                name: 'Social',
              },
            },
          },
        ],
      })

    prisma.conversationMessage.findFirst.mockResolvedValue({
      id: 'msg_source',
      conversationId: 'conv_source',
      inboxMessageId: 'inbox_source',
      externalMessageId: 'wamid.msg-1',
      authorType: 'CUSTOMER',
      kind: 'TEXT',
      body: 'Fotos y detalles',
      normalizedText: 'Fotos y detalles',
      payload: {
        attachments: [
          {
            assetType: 'image',
            fileName: 'producto.jpg',
            contentType: 'image/jpeg',
            metadata: {
              transport: 'whatsapp_qr',
              downloadable: true,
            },
          },
        ],
      },
      metadata: {
        attachments: [
          {
            assetType: 'image',
            fileName: 'producto.jpg',
            contentType: 'image/jpeg',
            metadata: {
              transport: 'whatsapp_qr',
              downloadable: true,
            },
          },
        ],
        whatsapp: {
          messageKey: {
            remoteJid: '59890000001@lid',
            id: 'wamid.msg-1',
            fromMe: false,
          },
          messageSnapshot: {
            key: {
              remoteJid: '59890000001@lid',
              id: 'wamid.msg-1',
              fromMe: false,
            },
            message: {
              conversation: 'Fotos y detalles',
            },
          },
        },
      },
      createdAt,
      inboxMessage: {
        id: 'inbox_source',
        remoteId: 'wamid.msg-1',
        threadRemoteId: '59890000001@lid',
        metadata: null,
      },
    })

    prisma.inboxMessage.create.mockResolvedValue({ id: 'inbox_forwarded' })
    prisma.inboxMessageEvent.create.mockResolvedValue({ id: 'evt_forwarded' })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_forwarded',
      createdAt,
    })
    prisma.conversation.update.mockResolvedValue({ id: 'conv_target' })

    const result = await service.forwardWhatsappMessage(
      'conv_source',
      'msg_source',
      { targetConversationId: 'conv_target' },
      9,
    )

    expect(result).toMatchObject({
      ok: true,
      targetConversationId: 'conv_target',
      forwardedMessageId: 'msg_forwarded',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://channel-adapter:4200/channels/whatsapp-qr/message/forward',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload).toMatchObject({
      targetConversationId: 'conv_target',
      targetRecipientId: '59890000002',
      targetThreadId: '59890000002@lid',
      text: 'Fotos y detalles',
    })
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_target',
        authorType: 'OPERATOR',
        body: 'Fotos y detalles',
        metadata: expect.objectContaining({
          source: 'admin-forward',
          forwardedFromConversationId: 'conv_source',
          forwardedFromMessageId: 'msg_source',
        }),
      }),
      select: {
        id: true,
        createdAt: true,
      },
    })
  })

  it('imports WhatsApp QR history messages as outbound operator messages without redispatching them', async () => {
    const occurredAt = new Date('2026-03-28T21:10:00.000Z')
    prisma.inboxAccount.findFirst.mockResolvedValue({
      id: 'acc_whatsapp_qr',
      channel: 'WHATSAPP',
      displayName: 'WhatsApp QR',
      address: '59891234567',
      metadata: { transport: 'whatsapp_qr' },
    })
    prisma.inboxAccount.update.mockResolvedValue({
      id: 'acc_whatsapp_qr',
      channel: 'WHATSAPP',
      displayName: 'WhatsApp QR',
      address: '59891234567',
      metadata: { transport: 'whatsapp_qr', source: 'conversation-hub' },
    })
    prisma.customer.findFirst.mockResolvedValue(null)
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv_whatsapp_qr_existing',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WHATSAPP',
      status: 'WAITING_INTERNAL',
      controlMode: 'AI',
      subject: 'Consulta WhatsApp',
      customerId: null,
      inboxAccountId: 'acc_whatsapp_qr',
      assignedToUserId: null,
      externalUserId: '59890000001',
      externalThreadId: '59890000001@lid',
      externalChannelRef: null,
      metadata: {},
    })
    prisma.conversation.update.mockResolvedValue({
      id: 'conv_whatsapp_qr_existing',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WHATSAPP',
      status: 'WAITING_INTERNAL',
      controlMode: 'AI',
      subject: 'Consulta WhatsApp',
      customerId: null,
      inboxAccountId: 'acc_whatsapp_qr',
      assignedToUserId: null,
      externalUserId: '59890000001',
      externalThreadId: '59890000001@lid',
      externalChannelRef: null,
      metadata: {},
    })
    prisma.conversationParticipant.findFirst.mockResolvedValue(null)
    prisma.conversationParticipant.create.mockResolvedValue({
      id: 'part_history_qr',
    })
    prisma.conversationMessage.findFirst.mockResolvedValue(null)
    prisma.inboxMessage.create.mockResolvedValue({
      id: 'inbox_msg_history_qr',
    })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'conv_msg_history_qr',
      createdAt: occurredAt,
    })

    const result = await service.importChannelHistoryMessage({
      tenantKey: 'urucortinas',
      channel: 'whatsapp',
      userId: '59890000001',
      direction: 'outbound',
      inboxAddress: '59891234567',
      threadId: '59890000001@lid',
      externalMessageId: 'wa-history-1',
      text: 'Respuesta histórica',
      authorKind: 'operator_human',
      occurredAt,
      metadata: {
        transport: 'whatsapp_qr',
        historyImport: true,
      },
    })

    expect(prisma.inboxMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'acc_whatsapp_qr',
        direction: 'OUTBOUND',
        folder: 'sent',
        fromAddress: '59891234567',
        toAddresses: ['59890000001'],
        sentAt: occurredAt,
        receivedAt: null,
      }),
    })
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_whatsapp_qr_existing',
        authorType: 'OPERATOR',
        externalMessageId: 'wa-history-1',
        body: 'Respuesta histórica',
        sentAt: occurredAt,
        receivedAt: null,
      }),
      select: {
        id: true,
        createdAt: true,
      },
    })
    expect(prisma.conversation.update).toHaveBeenLastCalledWith({
      where: { id: 'conv_whatsapp_qr_existing' },
      data: {
        lastMessageAt: occurredAt,
        lastOutboundAt: occurredAt,
        status: 'WAITING_CUSTOMER',
      },
    })
    expect(result).toMatchObject({
      conversationId: 'conv_whatsapp_qr_existing',
      duplicate: false,
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

  it('persists business auto replies as non-reasoning system messages without reopening the queue', async () => {
    const createdAt = new Date('2026-03-27T22:00:00.000Z')
    const captureKnowledgeSpy = vi
      .spyOn(service as any, 'captureKnowledgeMessage')
      .mockResolvedValue(undefined)

    prisma.inboxAccount.upsert.mockResolvedValue({
      id: 'acc_whatsapp',
      channel: 'WHATSAPP',
      displayName: 'WhatsApp',
      address: 'wameta',
    })
    prisma.inboxQueue.upsert.mockResolvedValue({
      id: 'queue_support',
      slug: 'support',
      name: 'Support',
      assignmentMode: 'MANUAL',
      maxAssignedConversations: 10,
      slaTargetMinutes: 30,
    })
    prisma.inboxQueue.findMany.mockResolvedValue([
      {
        id: 'queue_support',
        slug: 'support',
        name: 'Support',
        assignmentMode: 'MANUAL',
        maxAssignedConversations: 10,
        slaTargetMinutes: 30,
        channels: ['WHATSAPP'],
      },
    ])
    const existingConversation = {
      id: 'conv_existing_auto',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WHATSAPP',
      status: 'WAITING_CUSTOMER',
      controlMode: 'AI',
      subject: 'Consulta por WhatsApp',
      customerId: null,
      inboxAccountId: 'acc_whatsapp',
      externalUserId: '+59899111222',
      externalThreadId: 'thread-auto',
      externalChannelRef: null,
      metadata: {},
      assignedToUserId: null,
    }
    prisma.conversation.findUnique.mockResolvedValue(existingConversation)
    prisma.conversation.update
      .mockResolvedValueOnce(existingConversation)
      .mockResolvedValueOnce(existingConversation)
    prisma.conversation.findFirst.mockResolvedValue(null)
    prisma.conversationParticipant.findFirst.mockResolvedValue({
      id: 'part_auto',
      customerId: null,
      externalUserId: '+59899111222',
      displayName: null,
      metadata: {
        email: null,
        locale: null,
        currency: null,
      },
    })
    prisma.conversationMessage.findFirst.mockResolvedValue(null)
    prisma.inboxMessage.create.mockResolvedValue({
      id: 'inbox_auto_1',
    })
    prisma.conversationMessage.create.mockResolvedValue({
      id: 'msg_auto_1',
      createdAt,
    })

    const result = await service.ingestInboundMessage({
      tenantKey: 'urucortinas',
      channel: 'whatsapp',
      conversationId: 'conv_existing_auto',
      userId: '+59899111222',
      inboxAddress: 'wameta',
      threadId: 'thread-auto',
      externalMessageId: 'wa-auto-1',
      text: 'Gracias por tu mensaje. Te responderemos en horario de atención.',
      authorKind: 'business_auto',
      messageKind: 'business_auto_reply',
      metadata: { provider: 'meta' },
    })

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_existing_auto',
        authorType: 'SYSTEM',
        kind: 'SYSTEM_EVENT',
        metadata: expect.objectContaining({
          authorKind: 'business_auto',
          messageKind: 'business_auto_reply',
        }),
      }),
      select: {
        id: true,
        createdAt: true,
      },
    })
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_existing_auto' },
      data: {
        lastMessageAt: createdAt,
      },
    })
    expect(captureKnowledgeSpy).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      conversationId: 'conv_existing_auto',
      status: 'waiting_customer',
      authorKind: 'business_auto',
      messageKind: 'business_auto_reply',
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

  it('matches the internal assistant contact with the Agente IA alias', async () => {
    prisma.customer.findMany.mockResolvedValue([])
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv_internal',
      updatedAt: new Date('2026-03-25T12:00:00.000Z'),
    })

    const result = await service.listContacts(
      { limit: 10, search: 'Agente IA' },
      7,
    )

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      key: 'internal:assistant',
      kind: 'internal',
      label: 'Asistente interno',
      conversationId: 'conv_internal',
    })
  })

  it('keeps the internal assistant visible even when the contact search targets customers', async () => {
    prisma.customer.findMany.mockResolvedValue([])
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv_internal',
      updatedAt: new Date('2026-03-25T12:00:00.000Z'),
    })

    const result = await service.listContacts(
      { limit: 10, search: 'cliente demo' },
      7,
    )

    expect(result.items[0]).toMatchObject({
      key: 'internal:assistant',
      kind: 'internal',
      label: 'Asistente interno',
      conversationId: 'conv_internal',
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
      conversationRole: 'admin_support',
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

  it('reuses the internal assistant conversation when the legacy admin session subject matches the IA assistant alias', async () => {
    const replyAsOperatorSpy = vi
      .spyOn(service, 'replyAsOperator')
      .mockResolvedValue({ id: 'conv_internal' } as never)
    const createConversationSpy = vi.spyOn(
      service as any,
      'createAdminInternalConversationRecord',
    )

    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv_internal',
    })

    await service.createAdminInternalSession(
      {
        subject: 'Agente IA',
        message: 'Necesito ayuda con un presupuesto',
      },
      9,
    )

    expect(createConversationSpy).not.toHaveBeenCalled()
    expect(replyAsOperatorSpy).toHaveBeenCalledWith(
      'conv_internal',
      {
        body: 'Necesito ayuda con un presupuesto',
        kind: 'text',
      },
      9,
    )
  })

  it('prefers explicit capability groups over the generic ADMIN auth role for internal sessions', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'CLIENT_SLUG') {
        return 'urucortinas'
      }
      return undefined
    })

    const createConversationSpy = vi
      .spyOn(service as any, 'createAdminInternalConversationRecord')
      .mockResolvedValue({ id: 'conv_internal_sales' })
    const replyAsOperatorSpy = vi
      .spyOn(service, 'replyAsOperator')
      .mockResolvedValue({ id: 'conv_internal_sales' } as never)

    await service.createAdminInternalSession(
      {
        subject: 'Confirmar cobro',
        message: 'Marcar pago 15 como confirmado',
      },
      12,
      {
        role: 'ADMIN',
        authority: ['ADMIN'],
        capabilityGroups: ['sales'],
      },
    )

    expect(createConversationSpy).toHaveBeenCalledWith({
      tenantKey: 'urucortinas',
      actorUserId: 12,
      conversationRole: 'admin_sales',
      subject: 'Confirmar cobro',
    })
    expect(replyAsOperatorSpy).toHaveBeenCalledWith(
      'conv_internal_sales',
      {
        body: 'Marcar pago 15 como confirmado',
        kind: 'text',
      },
      12,
    )
  })
})

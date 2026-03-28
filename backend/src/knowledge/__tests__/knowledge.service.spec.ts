import { beforeEach, describe, expect, it, vi } from 'vitest'
import { KnowledgeService } from '../knowledge.service'
import { KnowledgeEmbeddingsService } from '../knowledge-embeddings.service'

const knowledgeUploadMocks = vi.hoisted(() => ({
  persistKnowledgeSourceFile: vi.fn(),
  deleteKnowledgeSourceFile: vi.fn(),
  readKnowledgeSourceFile: vi.fn(),
}))

vi.mock('../../common/uploads/knowledge', () => ({
  persistKnowledgeSourceFile: knowledgeUploadMocks.persistKnowledgeSourceFile,
  deleteKnowledgeSourceFile: knowledgeUploadMocks.deleteKnowledgeSourceFile,
  readKnowledgeSourceFile: knowledgeUploadMocks.readKnowledgeSourceFile,
}))

const createPrisma = () => ({
  knowledgeDocument: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  knowledgeDocumentEmbedding: {
    upsert: vi.fn(),
  },
  knowledgeDerivedArtifact: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  knowledgeCandidate: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  knowledgeRawEvent: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  knowledgeIngestionRun: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  knowledgeSuggestionFeedback: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  knowledgeConversationBundle: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  knowledgeNegativeExample: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  knowledgeSnapshot: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  conversation: {
    findUnique: vi.fn(),
  },
  conversationMessage: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
  },
  customer: {
    findMany: vi.fn(),
  },
})

const createConfig = () => ({
  get: vi.fn((key: string) => {
    if (key === 'CLIENT_SLUG') {
      return 'urucortinas'
    }
    return undefined
  }),
})

const createEmbeddings = (): Partial<KnowledgeEmbeddingsService> => ({
    indexDocument: vi.fn(),
    indexDocuments: vi.fn(async (documents: Array<{ id: string }>) => ({
      indexed: documents.length,
    })),
    projectQuery: vi.fn(() => [1, 0, 0]),
    cosineSimilarity: vi.fn(() => 0.25),
  })

describe('KnowledgeService', () => {
  let prisma: ReturnType<typeof createPrisma>
  let config: ReturnType<typeof createConfig>
  let embeddings: ReturnType<typeof createEmbeddings>
  let service: KnowledgeService

  beforeEach(() => {
    prisma = createPrisma()
    config = createConfig()
    embeddings = createEmbeddings()
    knowledgeUploadMocks.persistKnowledgeSourceFile.mockReset()
    knowledgeUploadMocks.deleteKnowledgeSourceFile.mockReset()
    knowledgeUploadMocks.readKnowledgeSourceFile.mockReset()
    prisma.knowledgeDocument.findMany.mockResolvedValue([])
    prisma.knowledgeDocument.deleteMany.mockResolvedValue({ count: 0 })
    prisma.knowledgeDerivedArtifact.findMany.mockResolvedValue([])
    prisma.knowledgeDerivedArtifact.deleteMany.mockResolvedValue({ count: 0 })
    prisma.knowledgeDerivedArtifact.createMany.mockResolvedValue({ count: 0 })
    prisma.knowledgeSuggestionFeedback.groupBy.mockResolvedValue([])
    service = new KnowledgeService(
      prisma as never,
      config as never,
      embeddings as never,
    )
  })

  it('redacts PII when creating candidates from conversations', async () => {
    prisma.conversationMessage.findUnique.mockResolvedValue({
      id: 'msg_1',
      conversationId: 'conv_1',
      authorType: 'CUSTOMER',
      kind: 'TEXT',
      body: 'Escribir a persona@example.com o llamar al +598 91 234 567',
      normalizedText: null,
      metadata: null,
      payload: null,
      conversation: {
        id: 'conv_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        subject: 'Consulta comercial',
        channel: 'WEBCHAT',
      },
    })

    prisma.knowledgeRawEvent.findUnique.mockResolvedValue(null)
    prisma.knowledgeRawEvent.create.mockImplementation(async ({ data }) => ({
      id: 'raw_1',
      tenantKey: data.tenantKey,
      scope: data.scope,
      channel: data.channel,
      sourceAuthorType: data.sourceAuthorType,
      status: data.status,
      conversationId: data.conversationId,
      messageId: data.messageId,
      userMessage: data.userMessage,
      normalizedMessage: data.normalizedMessage,
      redactedMessage: data.redactedMessage ?? null,
      operatorReply: null,
      aiReply: null,
      detectedIntent: data.detectedIntent ?? null,
      problem: data.problem ?? null,
      contextSummary: data.contextSummary ?? null,
      suggestedResponse: data.suggestedResponse ?? null,
      confidence: data.confidence ?? null,
      relevanceScore: data.relevanceScore ?? null,
      dedupeHash: data.dedupeHash ?? null,
      clusterKey: data.clusterKey ?? null,
      metadata: data.metadata ?? null,
      createdAt: new Date('2026-03-25T12:00:00.000Z'),
      updatedAt: new Date('2026-03-25T12:00:00.000Z'),
    }))
    prisma.knowledgeCandidate.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const result = await service.createCandidateFromConversation(
      {
        conversationId: 'conv_1',
        messageId: 'msg_1',
      },
      7,
    )

    expect(result).toMatchObject({
      id: null,
      status: 'observation_only',
      piiDetected: false,
      rawEventId: expect.any(String),
    })
    expect(prisma.knowledgeCandidate.create).not.toHaveBeenCalled()
  })

  it('captures raw conversation events with multimodal context without materializing candidates before a reply exists', async () => {
    prisma.conversationMessage.findUnique.mockResolvedValue({
      id: 'msg_web_1',
      conversationId: 'conv_web_1',
      authorType: 'CUSTOMER',
      kind: 'TEXT',
      body: 'Necesito una corrediza probba 110 x 120',
      normalizedText: 'Necesito una corrediza probba 110 x 120',
      metadata: {
        messageElements: [{ type: 'text', text: 'Necesito una corrediza probba 110 x 120' }],
        messageContextOrigin: [{ type: 'message_text', source: 'body' }],
      },
      payload: {
        attachments: [{ kind: 'image', url: '/demo.png' }],
      },
      conversation: {
        id: 'conv_web_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        subject: 'Consulta desde webchat',
        channel: 'WEBCHAT',
      },
    })
    prisma.knowledgeRawEvent.findUnique.mockResolvedValue(null)
    prisma.knowledgeRawEvent.create.mockImplementation(async ({ data }) => ({
      id: 'raw_1',
      tenantKey: data.tenantKey,
      scope: data.scope,
      channel: data.channel,
      sourceAuthorType: data.sourceAuthorType,
      status: data.status,
      conversationId: data.conversationId,
      messageId: data.messageId,
      userMessage: data.userMessage,
      normalizedMessage: data.normalizedMessage,
      redactedMessage: data.redactedMessage ?? null,
      operatorReply: null,
      aiReply: null,
      detectedIntent: data.detectedIntent ?? null,
      problem: data.problem ?? null,
      contextSummary: data.contextSummary ?? null,
      suggestedResponse: null,
      confidence: data.confidence ?? null,
      relevanceScore: data.relevanceScore ?? null,
      dedupeHash: data.dedupeHash ?? null,
      clusterKey: data.clusterKey ?? null,
      metadata: data.metadata ?? null,
      createdAt: new Date('2026-03-26T20:00:00.000Z'),
      updatedAt: new Date('2026-03-26T20:00:00.000Z'),
    }))
    prisma.knowledgeCandidate.findUnique.mockResolvedValue(null)

    const result = await service.captureConversationMessage('msg_web_1', {
      actorUserId: 7,
    })

    expect(result).toMatchObject({
      status: 'created',
      rawEventId: 'raw_1',
      candidateId: null,
      candidateCreated: false,
    })
    expect(prisma.knowledgeRawEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          detectedIntent: 'aberturas.register',
          messageId: 'msg_web_1',
          attachments: expect.anything(),
          messageElements: expect.anything(),
        }),
      }),
    )
    expect(prisma.knowledgeCandidate.create).not.toHaveBeenCalled()
  })

  it('returns a single knowledge document by id for detail screens', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValue({
      id: 'doc_1',
      tenantKey: 'urucortinas',
      scope: 'ADMIN_INTERNAL',
      sourceType: 'ADMIN_CURATED',
      status: 'ACTIVE',
      sourceKey: 'manual:doc_1',
      title: 'Respuesta aprobada',
      summary: 'Resumen operativo',
      content: 'Contenido aprobado',
      sourceFileName: null,
      sourceFilePath: null,
      sourceFileMime: null,
      sourceFileSize: null,
      tags: ['operacion'],
      piiRiskLevel: 'low',
      metadata: { source: 'manual' },
      approvedAt: new Date('2026-03-27T12:00:00.000Z'),
      createdAt: new Date('2026-03-27T11:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:30:00.000Z'),
      embedding: null,
    })

    const result = await service.getDocument('doc_1')

    expect(result).toMatchObject({
      id: 'doc_1',
      title: 'Respuesta aprobada',
      scope: 'admin_internal',
      sourceType: 'admin_curated',
      originCategory: 'manual_entry',
      contentType: 'plain_text',
    })
  })

  it('returns a single knowledge candidate by id with feedback metrics for detail screens', async () => {
    prisma.knowledgeCandidate.findUnique.mockResolvedValue({
      id: 'cand_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      status: 'APPROVED',
      sourceType: 'CONVERSATION_DERIVED',
      title: 'Seguimiento de pedido',
      summary: 'Contexto resumido',
      excerpt: 'Necesito saber si ya salió mi pedido',
      redactedExcerpt: null,
      detectedIntent: 'order.status',
      problem: 'Consulta por estado',
      contextSummary: 'Cliente consulta por entrega',
      suggestedResponse: 'Ya revisamos tu pedido.',
      approvedResponse: 'Ya revisamos tu pedido y te confirmamos el estado.',
      confidence: 0.92,
      dedupeHash: 'abc',
      clusterKey: 'orders',
      version: 3,
      piiDetected: false,
      metadata: { source: 'conversation' },
      createdAt: new Date('2026-03-27T11:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:30:00.000Z'),
      conversation: {
        id: 'conv_1',
        subject: 'Seguimiento',
        channel: 'WEBCHAT',
      },
      observation: {
        id: 'raw_1',
        status: 'PROCESSED',
        channel: 'WEBCHAT',
        sourceAuthorType: 'CUSTOMER',
        userMessage: 'Necesito saber si ya salió mi pedido',
        operatorReply: 'Te confirmamos el estado enseguida.',
        aiReply: null,
        messageElements: null,
        createdAt: new Date('2026-03-27T10:00:00.000Z'),
        updatedAt: new Date('2026-03-27T10:10:00.000Z'),
      },
    })
    prisma.knowledgeSuggestionFeedback.groupBy.mockResolvedValue([
      { candidateId: 'cand_1', outcome: 'USED', _count: { _all: 2 } },
      { candidateId: 'cand_1', outcome: 'EDITED', _count: { _all: 1 } },
    ])

    const result = await service.getCandidate('cand_1')

    expect(result).toMatchObject({
      id: 'cand_1',
      status: 'approved',
      channel: 'webchat',
      detectedIntent: 'order.status',
      observation: {
        id: 'raw_1',
        status: 'processed',
      },
      feedback: {
        used: 2,
        edited: 1,
        discarded: 0,
        total: 3,
      },
    })
  })

  it('returns a single raw event by id for detail screens', async () => {
    prisma.knowledgeRawEvent.findUnique.mockResolvedValue({
      id: 'raw_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WEBCHAT',
      sourceAuthorType: 'CUSTOMER',
      status: 'NEW',
      userMessage: 'Quiero saber si ya salió mi pedido',
      normalizedMessage: 'Quiero saber si ya salió mi pedido',
      redactedMessage: null,
      operatorReply: null,
      aiReply: null,
      detectedIntent: 'order.status',
      problem: 'Consulta por estado',
      contextSummary: 'Consulta de seguimiento',
      suggestedResponse: 'Estamos revisando tu pedido.',
      confidence: 0.88,
      relevanceScore: 0.76,
      dedupeHash: 'dedupe',
      clusterKey: 'orders',
      messageElements: [{ type: 'text', text: 'Quiero saber si ya salió mi pedido' }],
      messageContextOrigin: [{ type: 'message_text', source: 'body' }],
      attachments: [],
      metadata: { source: 'webchat' },
      createdAt: new Date('2026-03-27T10:00:00.000Z'),
      updatedAt: new Date('2026-03-27T10:05:00.000Z'),
      conversation: {
        id: 'conv_1',
        subject: 'Consulta',
        channel: 'WEBCHAT',
        scope: 'CUSTOMER_PUBLIC',
      },
      message: {
        id: 'msg_1',
        authorType: 'CUSTOMER',
        kind: 'TEXT',
        body: 'Quiero saber si ya salió mi pedido',
        createdAt: new Date('2026-03-27T10:00:00.000Z'),
      },
      candidate: {
        id: 'cand_1',
        status: 'PENDING',
        confidence: 0.88,
        version: 1,
      },
    })

    const result = await service.getRawEvent('raw_1')

    expect(result).toMatchObject({
      id: 'raw_1',
      status: 'new',
      channel: 'webchat',
      detectedIntent: 'order.status',
      candidate: {
        id: 'cand_1',
        status: 'pending',
      },
      conversation: {
        id: 'conv_1',
        channel: 'webchat',
      },
    })
  })

  it('attaches operator replies to the latest observation and refreshes the linked candidate', async () => {
    prisma.conversationMessage.findUnique.mockResolvedValue({
      id: 'msg_reply_1',
      conversationId: 'conv_1',
      authorType: 'OPERATOR',
      kind: 'TEXT',
      body: 'Perfecto, te paso la cotización enseguida.',
      normalizedText: 'Perfecto, te paso la cotización enseguida.',
      metadata: {
        source: 'admin-reply',
      },
      payload: null,
      conversation: {
        id: 'conv_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        subject: 'Consulta comercial',
        channel: 'WHATSAPP',
      },
    })
    prisma.knowledgeRawEvent.findFirst.mockResolvedValue({
      id: 'raw_existing',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WHATSAPP',
      sourceAuthorType: 'CUSTOMER',
      status: 'NEW',
      conversationId: 'conv_1',
      messageId: 'msg_customer_1',
      userMessage: 'Quiero una cotización',
      normalizedMessage: 'quiero una cotizacion',
      redactedMessage: null,
      operatorReply: null,
      aiReply: null,
      detectedIntent: null,
      problem: 'Quiero una cotización',
      contextSummary: 'Asunto: Consulta comercial',
      suggestedResponse: null,
      confidence: 0.5,
      relevanceScore: 0.5,
      dedupeHash: 'dup',
      clusterKey: 'quote',
      metadata: null,
      ingestionRunId: null,
      createdAt: new Date('2026-03-26T19:00:00.000Z'),
      updatedAt: new Date('2026-03-26T19:00:00.000Z'),
    })
    prisma.knowledgeRawEvent.update.mockImplementation(async ({ data }) => ({
      id: 'raw_existing',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WHATSAPP',
      sourceAuthorType: 'CUSTOMER',
      status: data.status,
      conversationId: 'conv_1',
      messageId: 'msg_customer_1',
      userMessage: 'Quiero una cotización',
      normalizedMessage: 'quiero una cotizacion',
      redactedMessage: null,
      operatorReply: data.operatorReply ?? null,
      aiReply: data.aiReply ?? null,
      detectedIntent: data.detectedIntent ?? null,
      problem: 'Quiero una cotización',
      contextSummary: 'Asunto: Consulta comercial',
      suggestedResponse: data.suggestedResponse ?? null,
      confidence: data.confidence ?? 0.5,
      relevanceScore: 0.65,
      dedupeHash: 'dup',
      clusterKey: 'quote',
      metadata: data.metadata ?? null,
      createdAt: new Date('2026-03-26T19:00:00.000Z'),
      updatedAt: new Date('2026-03-26T20:05:00.000Z'),
    }))
    prisma.knowledgeCandidate.findUnique.mockResolvedValue({
      id: 'cand_existing',
      status: 'PENDING',
      title: 'Consulta comercial',
      summary: 'Asunto: Consulta comercial',
      excerpt: 'Quiero una cotización',
      redactedExcerpt: null,
      detectedIntent: null,
      problem: 'Quiero una cotización',
      contextSummary: 'Asunto: Consulta comercial',
      suggestedResponse: null,
      approvedResponse: null,
      confidence: 0.5,
      dedupeHash: 'dup',
      clusterKey: 'quote',
      piiDetected: false,
      metadata: null,
      createdByUserId: 7,
      version: 1,
    })
    prisma.knowledgeCandidate.update.mockImplementation(async ({ data }) => ({
      id: 'cand_existing',
      ...data,
    }))

    const result = await service.captureConversationMessage('msg_reply_1', {
      actorUserId: 7,
    })

    expect(result).toMatchObject({
      status: 'attached',
      rawEventId: 'raw_existing',
      candidateId: 'cand_existing',
      candidateCreated: false,
    })
    expect(prisma.knowledgeRawEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operatorReply: 'Perfecto, te paso la cotización enseguida.',
          suggestedResponse: 'Perfecto, te paso la cotización enseguida.',
        }),
      }),
    )
    expect(prisma.knowledgeCandidate.update).toHaveBeenCalled()
  })

  it('suggests only approved knowledge candidates for the latest customer message', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_suggestion_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      channel: 'WEBCHAT',
      subject: 'Seguimiento de pedido',
      messages: [
        {
          id: 'msg_old',
          authorType: 'CUSTOMER',
          body: 'Hola',
          normalizedText: 'hola',
          createdAt: new Date('2026-03-26T19:00:00.000Z'),
        },
        {
          id: 'msg_target',
          authorType: 'CUSTOMER',
          body: 'Quiero saber si ya salió mi pedido',
          normalizedText: 'quiero saber si ya salio mi pedido',
          createdAt: new Date('2026-03-26T19:05:00.000Z'),
        },
      ],
    })
    prisma.knowledgeRawEvent.findFirst.mockResolvedValue({
      id: 'raw_target',
      detectedIntent: 'order.status',
      problem: 'Seguimiento de pedido',
      contextSummary: 'Cliente consulta por estado del pedido',
      dedupeHash: 'dedupe-order-status',
      clusterKey: 'order-status',
    })
    prisma.knowledgeCandidate.findMany.mockResolvedValue([
      {
        id: 'cand_best',
        title: 'Seguimiento de pedido despachado',
        summary: 'Respuesta aprobada para pedidos en curso',
        excerpt: 'Quiero saber si ya salió mi pedido',
        redactedExcerpt: null,
        detectedIntent: 'order.status',
        problem: 'Seguimiento de pedido',
        contextSummary: 'Cliente consulta por estado del pedido',
        suggestedResponse: 'Tu pedido ya está en proceso de coordinación.',
        approvedResponse:
          'Perfecto, reviso el estado y te confirmo si ya salió a reparto.',
        confidence: 0.91,
        dedupeHash: 'dedupe-order-status',
        clusterKey: 'order-status',
        version: 3,
        reviewedAt: new Date('2026-03-26T18:00:00.000Z'),
        observationId: 'raw_prev_1',
      },
      {
        id: 'cand_secondary',
        title: 'Seguimiento genérico',
        summary: 'Respuesta reutilizable',
        excerpt: '¿Cómo va mi pedido?',
        redactedExcerpt: null,
        detectedIntent: 'order.status',
        problem: 'Consulta de pedido',
        contextSummary: 'Pedido en proceso',
        suggestedResponse: 'Tu pedido sigue en preparación.',
        approvedResponse: 'Tu pedido sigue en preparación y te avisamos cualquier novedad.',
        confidence: 0.74,
        dedupeHash: 'other-hash',
        clusterKey: 'order-status',
        version: 1,
        reviewedAt: new Date('2026-03-26T17:00:00.000Z'),
        observationId: 'raw_prev_2',
      },
    ])

    const result = await service.suggestApprovedRepliesForConversation({
      conversationId: 'conv_suggestion_1',
    })

    expect(prisma.knowledgeCandidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantKey: 'urucortinas',
          scope: 'CUSTOMER_PUBLIC',
          status: 'APPROVED',
        }),
      }),
    )
    expect(result.targetMessageId).toBe('msg_target')
    expect(result.targetMessageText).toBe('Quiero saber si ya salió mi pedido')
    expect(result.items[0]).toMatchObject({
      id: 'cand_best',
      responseText:
        'Perfecto, reviso el estado y te confirmo si ya salió a reparto.',
      matchedBy: expect.arrayContaining([
        'dedupe',
        'intent',
        'cluster',
        'lexical',
        'semantic',
      ]),
    })
    expect(result.items[1]).toMatchObject({
      id: 'cand_secondary',
      matchedBy: expect.arrayContaining(['intent', 'cluster', 'semantic']),
    })
    expect(result.items[0]?.feedback).toEqual({
      used: 0,
      edited: 0,
      discarded: 0,
    })
  })

  it('records knowledge suggestion feedback and classifies edited replies', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_feedback_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
    })
    prisma.knowledgeCandidate.findUnique.mockResolvedValue({
      id: 'cand_feedback_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      status: 'APPROVED',
    })
    prisma.knowledgeSuggestionFeedback.create.mockImplementation(async ({ data }) => ({
      id: 'feedback_1',
      outcome: data.outcome,
      candidateId: data.candidateId,
      conversationId: data.conversationId,
      operatorMessageId: data.operatorMessageId ?? null,
      createdAt: new Date('2026-03-26T23:45:00.000Z'),
    }))

    const result = await service.recordSuggestionFeedback({
      conversationId: 'conv_feedback_1',
      candidateId: 'cand_feedback_1',
      actorUserId: 9,
      targetMessageId: 'msg_customer_1',
      targetMessageText: 'Necesito ayuda con mi pedido',
      suggestedText: 'Perfecto, reviso el estado y te confirmo enseguida.',
      finalText: 'Perfecto, reviso el estado y te confirmo hoy mismo.',
      operatorMessageId: 'msg_operator_1',
    })

    expect(prisma.knowledgeSuggestionFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantKey: 'urucortinas',
          conversationId: 'conv_feedback_1',
          candidateId: 'cand_feedback_1',
          actorUserId: 9,
          targetMessageId: 'msg_customer_1',
          operatorMessageId: 'msg_operator_1',
          outcome: 'EDITED',
          suggestedText: 'Perfecto, reviso el estado y te confirmo enseguida.',
          finalText: 'Perfecto, reviso el estado y te confirmo hoy mismo.',
          metadata: expect.objectContaining({
            targetMessageText: 'Necesito ayuda con mi pedido',
            source: 'admin-inbox',
          }),
        }),
      }),
    )
    expect(result).toMatchObject({
      id: 'feedback_1',
      outcome: 'edited',
      candidateId: 'cand_feedback_1',
      conversationId: 'conv_feedback_1',
      operatorMessageId: 'msg_operator_1',
    })
  })

  it('returns aggregated suggestion feedback metrics in the overview', async () => {
    prisma.knowledgeDocument.groupBy.mockResolvedValue([
      {
        status: 'APPROVED',
        sourceType: 'DOCS',
        scope: 'ADMIN_INTERNAL',
        _count: { _all: 4 },
      },
    ])
    prisma.knowledgeCandidate.groupBy.mockResolvedValue([
      {
        status: 'PENDING',
        scope: 'CUSTOMER_PUBLIC',
        _count: { _all: 3 },
      },
    ])
    prisma.knowledgeRawEvent.groupBy.mockResolvedValue([
      {
        status: 'NEW',
        scope: 'CUSTOMER_PUBLIC',
        _count: { _all: 7 },
      },
    ])
    prisma.knowledgeIngestionRun.groupBy.mockResolvedValue([
      {
        status: 'COMPLETED',
        _count: { _all: 2 },
      },
    ])
    prisma.knowledgeSuggestionFeedback.groupBy.mockResolvedValue([
      {
        outcome: 'USED',
        _count: { _all: 5 },
      },
      {
        outcome: 'EDITED',
        _count: { _all: 2 },
      },
      {
        outcome: 'DISCARDED',
        _count: { _all: 1 },
      },
    ])

    const result = await service.getOverview()

    expect(result.feedback).toEqual({
      used: 5,
      edited: 2,
      discarded: 1,
      total: 8,
      applied: 7,
      adoptionRate: 0.875,
      discardRate: 0.125,
    })
  })

  it('includes feedback metrics on listed candidates', async () => {
    prisma.knowledgeCandidate.findMany.mockResolvedValue([
      {
        id: 'cand_approved_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        status: 'APPROVED',
        sourceType: 'CONVERSATION',
        title: 'Seguimiento aprobado',
        summary: 'Resumen',
        excerpt: '¿Cómo va mi pedido?',
        redactedExcerpt: null,
        detectedIntent: 'order.status',
        problem: 'Seguimiento de pedido',
        contextSummary: 'Cliente pide estado',
        suggestedResponse: 'Reviso el estado y te confirmo.',
        approvedResponse: 'Perfecto, reviso el estado y te confirmo enseguida.',
        confidence: 0.82,
        dedupeHash: 'hash-1',
        clusterKey: 'order-status',
        version: 2,
        piiDetected: false,
        metadata: null,
        observation: null,
        conversation: null,
        createdAt: new Date('2026-03-26T20:00:00.000Z'),
        updatedAt: new Date('2026-03-26T21:00:00.000Z'),
      },
    ])
    prisma.knowledgeSuggestionFeedback.groupBy.mockResolvedValue([
      {
        candidateId: 'cand_approved_1',
        outcome: 'USED',
        _count: { _all: 4 },
      },
      {
        candidateId: 'cand_approved_1',
        outcome: 'EDITED',
        _count: { _all: 1 },
      },
      {
        candidateId: 'cand_approved_1',
        outcome: 'DISCARDED',
        _count: { _all: 1 },
      },
    ])

    const result = await service.listCandidates({})

    expect(result.total).toBe(1)
    expect(result.items[0]).toMatchObject({
      id: 'cand_approved_1',
      feedback: {
        used: 4,
        edited: 1,
        discarded: 1,
        total: 6,
        applied: 5,
        adoptionRate: 0.8333,
        discardRate: 0.1667,
      },
    })
  })

  it('filters managed source documents explicitly when requested', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([])

    const result = await service.listDocuments({
      sourceFileOnly: 'true',
    })

    expect(result).toMatchObject({
      total: 0,
      page: 1,
      pageSize: 50,
      orderBy: 'updatedAt',
      orderDir: 'desc',
    })
    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantKey: 'urucortinas',
          sourceFilePath: { not: null },
        }),
      }),
    )
  })

  it('filters candidates by channel and feedback after mapping', async () => {
    prisma.knowledgeCandidate.findMany.mockResolvedValue([
      {
        id: 'cand_web_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        status: 'PENDING',
        sourceType: 'CONVERSATION_DERIVED',
        title: 'Consulta webchat',
        summary: null,
        excerpt: 'Necesito precio',
        redactedExcerpt: null,
        detectedIntent: 'customer.quote',
        problem: null,
        contextSummary: null,
        suggestedResponse: 'Te paso la info.',
        approvedResponse: null,
        confidence: 0.7,
        dedupeHash: null,
        clusterKey: null,
        version: 1,
        piiDetected: false,
        metadata: null,
        observation: {
          id: 'raw_web_1',
          status: 'NEW',
          channel: 'WEBCHAT',
          sourceAuthorType: 'CUSTOMER',
          userMessage: 'Necesito precio',
          operatorReply: null,
          aiReply: null,
          messageElements: [],
          createdAt: new Date('2026-03-26T20:00:00.000Z'),
          updatedAt: new Date('2026-03-26T20:05:00.000Z'),
        },
        conversation: null,
        createdAt: new Date('2026-03-26T20:00:00.000Z'),
        updatedAt: new Date('2026-03-26T20:05:00.000Z'),
      },
      {
        id: 'cand_email_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        status: 'APPROVED',
        sourceType: 'CONVERSATION_DERIVED',
        title: 'Consulta email',
        summary: null,
        excerpt: 'Estado del pedido',
        redactedExcerpt: null,
        detectedIntent: 'order.status',
        problem: null,
        contextSummary: null,
        suggestedResponse: 'Te confirmo el estado.',
        approvedResponse: 'Reviso el estado y te confirmo enseguida.',
        confidence: 0.9,
        dedupeHash: null,
        clusterKey: null,
        version: 2,
        piiDetected: false,
        metadata: null,
        observation: {
          id: 'raw_email_1',
          status: 'PROCESSED',
          channel: 'EMAIL',
          sourceAuthorType: 'CUSTOMER',
          userMessage: 'Estado del pedido',
          operatorReply: 'Respuesta operador',
          aiReply: null,
          messageElements: [],
          createdAt: new Date('2026-03-26T19:00:00.000Z'),
          updatedAt: new Date('2026-03-26T21:00:00.000Z'),
        },
        conversation: null,
        createdAt: new Date('2026-03-26T19:00:00.000Z'),
        updatedAt: new Date('2026-03-26T21:00:00.000Z'),
      },
    ])
    prisma.knowledgeSuggestionFeedback.groupBy.mockResolvedValue([
      {
        candidateId: 'cand_email_1',
        outcome: 'USED',
        _count: { _all: 2 },
      },
    ])

    const result = await service.listCandidates({
      channel: 'email',
      hasFeedback: 'true',
    })

    expect(result.total).toBe(1)
    expect(result.items[0]).toMatchObject({
      id: 'cand_email_1',
      channel: 'email',
      hasFeedback: true,
      originCategory: 'conversation_approved',
    })
  })

  it('maps and paginates documents with derived origin and embedding filters', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      {
        id: 'doc_uploaded_1',
        tenantKey: 'urucortinas',
        scope: 'ADMIN_INTERNAL',
        sourceType: 'DOCS',
        status: 'ACTIVE',
        sourceKey: 'uploaded:1',
        title: 'Documento subido',
        summary: 'Resumen',
        content: 'Contenido',
        sourceFileName: 'archivo.txt',
        sourceFilePath: '/uploads/knowledge/archivo.txt',
        sourceFileMime: 'text/plain',
        sourceFileSize: 120,
        tags: [],
        piiRiskLevel: 'low',
        metadata: null,
        approvedAt: new Date('2026-03-26T20:00:00.000Z'),
        createdAt: new Date('2026-03-26T19:00:00.000Z'),
        updatedAt: new Date('2026-03-26T21:00:00.000Z'),
        embedding: {
          provider: 'local',
          model: 'local-hash-v1',
          dimensions: 128,
          updatedAt: new Date('2026-03-26T21:05:00.000Z'),
        },
      },
      {
        id: 'doc_manual_1',
        tenantKey: 'urucortinas',
        scope: 'ADMIN_INTERNAL',
        sourceType: 'ADMIN_CURATED',
        status: 'ACTIVE',
        sourceKey: 'curated:1',
        title: 'Carga manual',
        summary: 'Manual',
        content: 'Contenido manual',
        sourceFileName: null,
        sourceFilePath: null,
        sourceFileMime: null,
        sourceFileSize: null,
        tags: [],
        piiRiskLevel: 'low',
        metadata: null,
        approvedAt: new Date('2026-03-26T18:00:00.000Z'),
        createdAt: new Date('2026-03-26T17:00:00.000Z'),
        updatedAt: new Date('2026-03-26T18:30:00.000Z'),
        embedding: null,
      },
    ])

    const result = await service.listDocuments({
      hasEmbedding: 'true',
      originCategory: 'uploaded_document',
      pageSize: 10,
    })

    expect(result.total).toBe(1)
    expect(result.items[0]).toMatchObject({
      id: 'doc_uploaded_1',
      originCategory: 'uploaded_document',
      contentType: 'document_file',
      hasEmbedding: true,
    })
  })

  it('ingests datasets without leaking raw customer email or phone into content', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 10,
        name: 'Producto demo',
        productCode: 'SKU-1',
        mode: 'SIMPLE',
        productType: 'PHYSICAL',
        currency: 'UYU',
        salePrice: 1200,
        costPrice: 800,
        stock: 3,
        description: 'Descripción pública',
        published: true,
        category: { id: 2, name: 'Cortinas' },
      },
    ])
    prisma.customer.findMany.mockResolvedValue([
      {
        id: 33,
        name: 'Cliente Demo',
        email: 'cliente@example.com',
        phoneNumber: '+59891234567',
        preferredLocale: 'es',
        status: { id: 1, name: 'Activo' },
        orders: [
          {
            id: 18,
            uuid: 'order-uuid-1',
            orderCurrency: 'UYU',
            grandTotal: 5500,
          },
        ],
      },
    ])

    prisma.knowledgeDocument.upsert.mockImplementation(async ({ create }) => ({
      id: create.sourceKey,
      tenantKey: create.tenantKey,
      scope: create.scope,
      sourceType: create.sourceType,
      status: create.status,
      sourceKey: create.sourceKey,
      title: create.title,
      summary: create.summary ?? null,
      content: create.content,
      tags: create.tags ?? [],
      piiRiskLevel: create.piiRiskLevel ?? 'low',
      metadata: create.metadata ?? null,
      approvedAt: create.approvedAt ?? null,
      createdAt: new Date('2026-03-25T12:00:00.000Z'),
      updatedAt: new Date('2026-03-25T12:00:00.000Z'),
    }))
    prisma.knowledgeDocument.findUnique.mockImplementation(async ({ where }) => ({
      id: where.id,
      tenantKey: 'urucortinas',
      scope: 'ADMIN_INTERNAL',
      sourceType: 'BACKEND_DATASET',
      status: 'ACTIVE',
      sourceKey: String(where.id),
      title: 'Doc',
      summary: null,
      content: 'Doc',
      tags: [],
      piiRiskLevel: 'low',
      metadata: null,
      approvedAt: new Date('2026-03-25T12:00:00.000Z'),
      createdAt: new Date('2026-03-25T12:00:00.000Z'),
      updatedAt: new Date('2026-03-25T12:00:00.000Z'),
      embedding: {
        provider: 'local',
        model: 'local-hash-v1',
        dimensions: 128,
        updatedAt: new Date('2026-03-25T12:00:00.000Z'),
      },
    }))

    const result = await service.ingestDatasets(5)

    expect(result.ingested).toBe(3)
    const customerCall = prisma.knowledgeDocument.upsert.mock.calls.find(
      ([input]) => input.create.sourceKey === 'customer:33',
    )
    expect(customerCall).toBeTruthy()
    const customerContent = customerCall?.[0].create.content as string
    expect(customerContent).toContain('Tiene email: sí')
    expect(customerContent).toContain('Tiene teléfono: sí')
    expect(customerContent).not.toContain('cliente@example.com')
    expect(customerContent).not.toContain('+59891234567')
  })

  it('promotes approved candidates into conversation-derived documents', async () => {
    prisma.knowledgeCandidate.findUnique.mockResolvedValue({
      id: 'cand_77',
      tenantKey: 'urucortinas',
      scope: 'ADMIN_INTERNAL',
      title: 'Regla detectada',
      summary: 'Resumen',
      excerpt: 'texto original',
      redactedExcerpt: 'texto redacted',
      piiDetected: true,
      createdByUserId: 9,
    })
    prisma.knowledgeCandidate.update.mockImplementation(async ({ data }) => ({
      id: 'cand_77',
      status: data.status,
    }))
    prisma.knowledgeDocument.create.mockImplementation(async ({ data }) => ({
      id: 'doc_77',
      tenantKey: data.tenantKey,
      scope: data.scope,
      sourceType: data.sourceType,
      status: data.status,
      sourceKey: data.sourceKey,
      title: data.title,
      summary: data.summary ?? null,
      content: data.content,
      tags: data.tags ?? [],
      piiRiskLevel: data.piiRiskLevel ?? 'low',
      metadata: data.metadata ?? null,
      approvedAt: data.approvedAt ?? null,
      createdAt: new Date('2026-03-25T12:00:00.000Z'),
      updatedAt: new Date('2026-03-25T12:00:00.000Z'),
    }))
    prisma.knowledgeDocument.findUnique.mockImplementation(async () => ({
      id: 'doc_77',
      tenantKey: 'urucortinas',
      scope: 'ADMIN_INTERNAL',
      sourceType: 'CONVERSATION_DERIVED',
      status: 'ACTIVE',
      sourceKey: 'candidate:cand_77',
      title: 'Regla detectada',
      summary: 'Resumen',
      content: 'texto redacted',
      tags: ['conversation-derived'],
      piiRiskLevel: 'medium',
      metadata: null,
      approvedAt: new Date('2026-03-25T12:00:00.000Z'),
      createdAt: new Date('2026-03-25T12:00:00.000Z'),
      updatedAt: new Date('2026-03-25T12:00:00.000Z'),
      embedding: {
        provider: 'local',
        model: 'local-hash-v1',
        dimensions: 128,
        updatedAt: new Date('2026-03-25T12:00:00.000Z'),
      },
    }))

    const result = await service.reviewCandidate(
      'cand_77',
      {
        action: 'approve',
        promoteToDocument: true,
      },
      11,
    )

    expect(result.candidate).toEqual({
      id: 'cand_77',
      status: 'approved',
    })
    expect(result.promotedDocument).toMatchObject({
      id: 'doc_77',
      sourceKey: 'candidate:cand_77',
      title: 'Regla detectada',
      content: 'texto redacted',
      sourceType: 'conversation_derived',
      piiRiskLevel: 'medium',
    })
  })

  it('retrieves only approved active knowledge documents for the requested scope', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      {
        id: 'doc_public',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        sourceType: 'ADMIN_CURATED',
        status: 'ACTIVE',
        sourceKey: 'curated:public',
        title: 'Envíos Montevideo',
        summary: 'Plazos de entrega',
        content: 'Los envíos en Montevideo se coordinan en 24 a 72 horas.',
        tags: ['envios', 'montevideo'],
        updatedAt: new Date('2026-03-25T12:00:00.000Z'),
        createdAt: new Date('2026-03-25T12:00:00.000Z'),
        embedding: {
          provider: 'local',
          model: 'local-hash-v1',
          dimensions: 128,
          vector: [1, 0, 0],
          updatedAt: new Date('2026-03-25T12:00:00.000Z'),
        },
      },
      {
        id: 'doc_internal',
        tenantKey: 'urucortinas',
        scope: 'ADMIN_INTERNAL',
        sourceType: 'DOCS',
        status: 'ACTIVE',
        sourceKey: 'docs:ops',
        title: 'Reglas de envíos',
        summary: 'Operativa interna',
        content: 'Montevideo requiere coordinación con agenda interna.',
        tags: ['envios', 'operativa'],
        updatedAt: new Date('2026-03-25T13:00:00.000Z'),
        createdAt: new Date('2026-03-25T13:00:00.000Z'),
        embedding: {
          provider: 'local',
          model: 'local-hash-v1',
          dimensions: 128,
          vector: [1, 0, 0],
          updatedAt: new Date('2026-03-25T13:00:00.000Z'),
        },
      },
      {
        id: 'doc_dataset_noise',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        sourceType: 'BACKEND_DATASET',
        status: 'ACTIVE',
        sourceKey: 'product:roller',
        title: 'Cortina Roller',
        summary: 'Producto publicado',
        content: 'Producto simple de cortina roller.',
        tags: ['product', 'roller'],
        updatedAt: new Date('2026-03-25T14:00:00.000Z'),
        createdAt: new Date('2026-03-25T14:00:00.000Z'),
        embedding: {
          provider: 'local',
          model: 'local-hash-v1',
          dimensions: 128,
          vector: [0.5, 0, 0],
          updatedAt: new Date('2026-03-25T14:00:00.000Z'),
        },
      },
    ])

    const result = await service.retrieve({
      query: 'montevideo envios',
      scope: 'customer_public',
      limit: 5,
    })

    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          approvedAt: { not: null },
          scope: { in: ['CUSTOMER_PUBLIC'] },
        }),
        take: 2000,
      }),
    )
    expect(result.items).toHaveLength(3)
    expect(result.items[0]).toMatchObject({
      id: 'doc_public',
      scope: 'customer_public',
      lexicalScore: expect.any(Number),
      vectorScore: expect.any(Number),
      embedding: {
        provider: 'local',
        model: 'local-hash-v1',
        dimensions: 128,
        indexedAt: new Date('2026-03-25T12:00:00.000Z'),
      },
    })
    expect(result.items[0].snippet).toContain('Montevideo')
  })

  it('prioritizes contact faq pages for business location queries over commercial pages', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      {
        id: 'doc_commercial_location',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        sourceType: 'WEB_URL',
        status: 'ACTIVE',
        sourceKey: 'web:https://urucortinas.com.uy/aberturas.html',
        title: 'Aberturas de aluminio | Urucortinas',
        summary:
          'Venta e instalación de aberturas en aluminio en Montevideo y todo Uruguay.',
        content:
          'Venta e instalación de aberturas en aluminio en Montevideo y todo Uruguay. Fabricación a medida con DVH y líneas de mayor prestación.',
        tags: ['aberturas', 'montevideo'],
        metadata: {
          url: 'https://urucortinas.com.uy/aberturas.html',
        },
        updatedAt: new Date('2026-03-25T14:00:00.000Z'),
        createdAt: new Date('2026-03-25T14:00:00.000Z'),
        embedding: {
          provider: 'local',
          model: 'local-hash-v1',
          dimensions: 128,
          vector: [1, 0, 0],
          updatedAt: new Date('2026-03-25T14:00:00.000Z'),
        },
      },
      {
        id: 'doc_contact_location',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        sourceType: 'WEB_URL',
        status: 'ACTIVE',
        sourceKey: 'web:https://urucortinas.com.uy/contacto.html',
        title: 'Contacto | Urucortinas',
        summary:
          'Contactanos para solicitar presupuestos, asesoramiento y compra de cortinas interiores, persianas y aberturas a medida. Atención personalizada en todo Uruguay.',
        content:
          'Contacto | Urucortinas\nHorario\nLun - Vie, 10:00 - 18:00\nSáb 10:00 - 13:00\nTeléfono\n097 365 931\nEmail\nventas@urucortinas.com.uy\nmenu\nInicio\nCortinas\nAberturas en Aluminio\nContactanos\nPreguntas Frecuentes\n¿Dónde están ubicados?\nNos encontramos en Montevideo, pero realizamos presupuestos en todo el país.\n¿Cuál es su número de contacto?\n097 365 931\n¿Cuál es su horario de atención?\nDe lunes a viernes de 9 a 18 horas y sábados de 9 a 14 horas.\n¿Cuentan con local comercial?\nActualmente nuestra atención es totalmente en línea, no contamos con local comercial.',
        tags: ['contacto', 'ubicacion'],
        metadata: {
          url: 'https://urucortinas.com.uy/contacto.html',
        },
        updatedAt: new Date('2026-03-25T15:00:00.000Z'),
        createdAt: new Date('2026-03-25T15:00:00.000Z'),
        embedding: {
          provider: 'local',
          model: 'local-hash-v1',
          dimensions: 128,
          vector: [1, 0, 0],
          updatedAt: new Date('2026-03-25T15:00:00.000Z'),
        },
      },
    ])

    const result = await service.retrieve({
      query: 'de donde son',
      scope: 'customer_public',
      limit: 5,
    })

    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({
      id: 'doc_contact_location',
      title: 'Contacto | Urucortinas',
    })
    expect(result.items[0].snippet.toLowerCase()).toContain(
      'nos encontramos en montevideo',
    )
    expect(result.items[1]).toMatchObject({
      id: 'doc_commercial_location',
    })
    expect(result.items[0].lexicalScore).toBeGreaterThan(
      result.items[1].lexicalScore,
    )
  })

  it('prioritizes derived web facts over the source page for business faq retrieval', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      {
        id: 'doc_contact_page',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        sourceType: 'WEB_URL',
        status: 'ACTIVE',
        sourceKey: 'web:page:contacto',
        title: 'Contacto | Urucortinas',
        summary:
          'Contactanos para solicitar presupuestos, asesoramiento y compra de cortinas interiores.',
        content:
          'Preguntas Frecuentes\n¿Dónde están ubicados?\nNos encontramos en Montevideo, pero realizamos presupuestos en todo el país.',
        tags: ['contacto'],
        metadata: {
          url: 'https://urucortinas.com.uy/contacto.html',
          documentKind: 'web_page',
          pageKinds: ['contact_page', 'faq_page'],
        },
        updatedAt: new Date('2026-03-27T12:00:00.000Z'),
        createdAt: new Date('2026-03-27T12:00:00.000Z'),
        embedding: {
          provider: 'local',
          model: 'local-hash-v1',
          dimensions: 128,
          vector: [1, 0, 0],
          updatedAt: new Date('2026-03-27T12:00:00.000Z'),
        },
      },
      {
        id: 'doc_contact_fact_location',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        sourceType: 'WEB_URL',
        status: 'ACTIVE',
        sourceKey: 'web:page:contacto:fact:location',
        title: 'Dato web · Ubicación',
        summary: 'Nos encontramos en Montevideo, pero realizamos presupuestos en todo el país.',
        content: 'Nos encontramos en Montevideo, pero realizamos presupuestos en todo el país.',
        tags: ['web_fact', 'location', 'contact_page'],
        metadata: {
          documentKind: 'derived_web_fact',
          factType: 'location',
          derivedFromUrl: 'https://urucortinas.com.uy/contacto.html',
          pageKinds: ['contact_page', 'faq_page'],
        },
        updatedAt: new Date('2026-03-27T12:05:00.000Z'),
        createdAt: new Date('2026-03-27T12:05:00.000Z'),
        embedding: {
          provider: 'local',
          model: 'local-hash-v1',
          dimensions: 128,
          vector: [1, 0, 0],
          updatedAt: new Date('2026-03-27T12:05:00.000Z'),
        },
      },
    ])

    const result = await service.retrieve({
      query: 'de donde son',
      scope: 'customer_public',
      limit: 5,
    })

    expect(result.items[0]).toMatchObject({
      id: 'doc_contact_fact_location',
      title: 'Dato web · Ubicación',
      metadata: {
        documentKind: 'derived_web_fact',
        factType: 'location',
        factValue: null,
        topicType: null,
        pageKinds: ['contact_page', 'faq_page'],
        url: 'https://urucortinas.com.uy/contacto.html',
      },
    })
    expect(result.items[0].snippet.toLowerCase()).toContain(
      'nos encontramos en montevideo',
    )
    expect(result.items[1]).toMatchObject({
      id: 'doc_contact_page',
    })
    expect(result.items[0].score).toBeGreaterThan(result.items[1].score)
  })

  it('prioritizes derived product facts over a generic product page for product retrieval', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      {
        id: 'doc_catalog_venecianas',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        sourceType: 'WEB_URL',
        status: 'ACTIVE',
        sourceKey: 'web:page:catalogo',
        title: 'Catálogo ampliado | Urucortinas',
        summary:
          'Catálogo ampliado con cortinas roller, bandas verticales, venecianas y persianas.',
        content:
          'Catálogo ampliado con cortinas roller, bandas verticales, venecianas y persianas. Opciones para hogar y oficina.',
        tags: ['catalogo', 'productos'],
        metadata: {
          url: 'https://urucortinas.com.uy/catalogo.html',
          documentKind: 'web_page',
          pageKinds: ['product_page'],
        },
        updatedAt: new Date('2026-03-27T12:00:00.000Z'),
        createdAt: new Date('2026-03-27T12:00:00.000Z'),
        embedding: {
          provider: 'local',
          model: 'local-hash-v1',
          dimensions: 128,
          vector: [1, 0, 0],
          updatedAt: new Date('2026-03-27T12:00:00.000Z'),
        },
      },
      {
        id: 'doc_fact_venecianas',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        sourceType: 'WEB_URL',
        status: 'ACTIVE',
        sourceKey: 'web:page:catalogo:fact:product_topic:cortinas-venecianas',
        title: 'Dato web · Producto · cortinas venecianas',
        summary: 'Trabajamos con cortinas venecianas para regular luz y privacidad.',
        content: 'Trabajamos con cortinas venecianas para regular luz y privacidad.',
        tags: ['web_fact', 'product_topic', 'venecianas'],
        metadata: {
          documentKind: 'derived_web_fact',
          factType: 'product_topic',
          factValue: 'cortinas venecianas',
          derivedFromUrl: 'https://urucortinas.com.uy/catalogo.html',
          pageKinds: ['product_page'],
        },
        updatedAt: new Date('2026-03-27T12:05:00.000Z'),
        createdAt: new Date('2026-03-27T12:05:00.000Z'),
        embedding: {
          provider: 'local',
          model: 'local-hash-v1',
          dimensions: 128,
          vector: [1, 0, 0],
          updatedAt: new Date('2026-03-27T12:05:00.000Z'),
        },
      },
    ])

    const result = await service.retrieve({
      query: 'venecianas',
      scope: 'customer_public',
      limit: 5,
    })

    expect(result.items[0]).toMatchObject({
      id: 'doc_fact_venecianas',
      title: 'Dato web · Producto · cortinas venecianas',
    })
    expect(result.items[1]).toMatchObject({
      id: 'doc_catalog_venecianas',
    })
    expect(result.items[0].score).toBeGreaterThan(result.items[1].score)
  })

  it('builds a relevant snippet from token matches when the full query is not present literally', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      {
        id: 'doc_report',
        tenantKey: 'urucortinas',
        scope: 'ADMIN_INTERNAL',
        sourceType: 'DOCS',
        status: 'ACTIVE',
        sourceKey: 'docs:report',
        title: 'Informe Analisis Datos UruCortinas',
        summary: 'Informe base de negocio y operativa para grounding interno de IA.',
        content:
          'Introducción general del informe. Hallazgos comerciales relevantes. Las lineas de negocio principales son cortinas roller, persianas, toldos y reparaciones. Los riesgos principales detectados incluyen dependencia de canales manuales, baja cobertura de seguimiento y necesidad de mejorar conversion y postventa.',
        tags: ['negocio', 'riesgos'],
        updatedAt: new Date('2026-03-25T13:00:00.000Z'),
        createdAt: new Date('2026-03-25T13:00:00.000Z'),
        embedding: {
          provider: 'local',
          model: 'local-hash-v1',
          dimensions: 128,
          vector: [1, 0, 0],
          updatedAt: new Date('2026-03-25T13:00:00.000Z'),
        },
      },
    ])

    const result = await service.retrieve({
      query: 'Segun el informe cargado, resumime lineas de negocio y riesgos principales de UruCortinas.',
      scope: 'admin_internal',
      limit: 3,
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].snippet).toContain('lineas de negocio principales')
    expect(result.items[0].snippet).toContain('riesgos principales')
  })

  it('indexes approved documents on demand', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      {
        id: 'doc_1',
        title: 'Entrega Montevideo',
        summary: 'Resumen',
        content: 'Contenido',
        tags: ['envios'],
      },
      {
        id: 'doc_2',
        title: 'Instalaciones',
        summary: null,
        content: 'Otro contenido',
        tags: ['instalacion'],
      },
    ])

    const result = await service.indexDocuments({}, 5)

    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          approvedAt: { not: null },
        }),
      }),
    )
    expect(embeddings.indexDocuments).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'doc_1' }),
      expect.objectContaining({ id: 'doc_2' }),
    ])
    expect(result).toEqual({
      tenantKey: 'urucortinas',
      indexed: 2,
      documentIds: ['doc_1', 'doc_2'],
    })
  })

  it('uploads a managed document with downloadable source metadata', async () => {
    knowledgeUploadMocks.persistKnowledgeSourceFile.mockResolvedValue({
      path: '/uploads/knowledge/informe-urucortinas.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 4096,
      name: 'Informe_Analisis_Datos.docx',
      content: 'Análisis comercial UruCortinas',
    })

    prisma.knowledgeDocument.upsert.mockImplementation(async ({ create }) => ({
      id: 'doc_upload',
      tenantKey: create.tenantKey,
      scope: create.scope,
      sourceType: create.sourceType,
      status: create.status,
      sourceKey: create.sourceKey,
      title: create.title,
      summary: create.summary ?? null,
      content: create.content,
      sourceFileName: create.sourceFileName ?? null,
      sourceFilePath: create.sourceFilePath ?? null,
      sourceFileMime: create.sourceFileMime ?? null,
      sourceFileSize: create.sourceFileSize ?? null,
      tags: create.tags ?? [],
      piiRiskLevel: create.piiRiskLevel ?? 'low',
      metadata: create.metadata ?? null,
      approvedAt: create.approvedAt ?? null,
      createdAt: new Date('2026-03-25T12:00:00.000Z'),
      updatedAt: new Date('2026-03-25T12:00:00.000Z'),
    }))
    prisma.knowledgeDocument.findUnique.mockResolvedValue({
      id: 'doc_upload',
      tenantKey: 'urucortinas',
      scope: 'ADMIN_INTERNAL',
      sourceType: 'DOCS',
      status: 'ACTIVE',
      sourceKey: 'uploaded:informe-urucortinas:1',
      title: 'Informe UruCortinas',
      summary: 'Resumen',
      content: 'Análisis comercial UruCortinas',
      sourceFileName: 'Informe_Analisis_Datos.docx',
      sourceFilePath: '/uploads/knowledge/informe-urucortinas.docx',
      sourceFileMime:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sourceFileSize: 4096,
      tags: ['urucortinas'],
      piiRiskLevel: 'low',
      metadata: null,
      approvedAt: new Date('2026-03-25T12:00:00.000Z'),
      createdAt: new Date('2026-03-25T12:00:00.000Z'),
      updatedAt: new Date('2026-03-25T12:00:00.000Z'),
      embedding: {
        provider: 'local',
        model: 'local-hash-v1',
        dimensions: 128,
        updatedAt: new Date('2026-03-25T12:00:00.000Z'),
      },
    })

    const result = await service.uploadSourceDocument(
      {
        scope: 'admin_internal',
        title: 'Informe UruCortinas',
        tags: ['urucortinas'],
      },
      {} as never,
      3,
    )

    expect(knowledgeUploadMocks.persistKnowledgeSourceFile).toHaveBeenCalledTimes(1)
    expect(result.sourceFile).toEqual({
      name: 'Informe_Analisis_Datos.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 4096,
      downloadUrl: '/api/ai/knowledge/documents/doc_upload/file',
    })
  })

  it('creates a configurable URL knowledge document with refresh metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi
        .fn()
        .mockResolvedValue(
          '<html><head><title>Horario</title><meta name="description" content="Horario de atención" /></head><body><h1>Horario</h1><p>Lunes a viernes de 9 a 18.</p></body></html>',
        ),
      headers: {
        get: vi.fn((key: string) => {
          if (key === 'content-type') return 'text/html; charset=utf-8'
          if (key === 'etag') return '"etag-1"'
          if (key === 'last-modified') return 'Wed, 27 Mar 2026 12:00:00 GMT'
          return null
        }),
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    prisma.knowledgeDocument.upsert.mockImplementation(async ({ create }) => ({
      id:
        String(create.sourceKey).includes(':fact:')
          ? 'doc_web_fact_1'
          : 'doc_web_1',
      tenantKey: create.tenantKey,
      scope: create.scope,
      sourceType: create.sourceType,
      status: create.status,
      sourceKey: create.sourceKey,
      title: create.title,
      summary: create.summary ?? null,
      content: create.content,
      sourceFileName: create.sourceFileName ?? null,
      sourceFilePath: create.sourceFilePath ?? null,
      sourceFileMime: create.sourceFileMime ?? null,
      sourceFileSize: create.sourceFileSize ?? null,
      tags: create.tags ?? [],
      piiRiskLevel: create.piiRiskLevel ?? 'low',
      metadata: create.metadata ?? null,
      approvedAt: create.approvedAt ?? null,
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:00:00.000Z'),
      embedding: null,
    }))
    prisma.knowledgeDocument.findUnique.mockResolvedValue({
      id: 'doc_web_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      sourceType: 'WEB_URL',
      status: 'ACTIVE',
      sourceKey: 'web:1234',
      title: 'Horario',
      summary: 'Horario de atención',
      content: 'Horario\nLunes a viernes de 9 a 18.',
      sourceFileName: null,
      sourceFilePath: null,
      sourceFileMime: null,
      sourceFileSize: null,
      tags: ['sitio'],
      piiRiskLevel: 'low',
      metadata: {
        url: 'https://urucortinas.com.uy/contacto.html',
        refreshPolicy: 'daily',
        lastFetchedAt: '2026-03-27T12:00:00.000Z',
        documentKind: 'web_page',
        pageKinds: ['hours_page'],
      },
      approvedAt: new Date('2026-03-27T12:00:00.000Z'),
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:00:00.000Z'),
      embedding: null,
    })

    const result = await service.createUrlDocument(
      {
        scope: 'customer_public',
        url: 'https://urucortinas.com.uy/contacto.html',
        tags: ['sitio'],
        refreshPolicy: 'daily',
      },
      9,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://urucortinas.com.uy/contacto.html',
      expect.objectContaining({ headers: {} }),
    )
    expect(prisma.knowledgeDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceType: 'WEB_URL',
        }),
      }),
    )
    expect(prisma.knowledgeDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceKey: expect.stringContaining(':fact:business_hours'),
          metadata: expect.objectContaining({
            documentKind: 'derived_web_fact',
            factType: 'business_hours',
            derivedFromUrl: 'https://urucortinas.com.uy/contacto.html',
          }),
        }),
      }),
    )
    expect(result).toMatchObject({
      sourceType: 'web_url',
      originCategory: 'website_url',
      contentType: 'web_page',
    })

    vi.unstubAllGlobals()
  })

  it('classifies product pages and derives product facts from URL ingestion', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi
        .fn()
        .mockResolvedValue(
          '<html><head><title>Aberturas de aluminio | Urucortinas</title><meta name="description" content="Aberturas de aluminio con lineas Probba, Gala, Summa y DVH." /></head><body><h1>Aberturas de aluminio</h1><p>Venta e instalación de aberturas en aluminio en Montevideo y todo Uruguay.</p><p>Líneas Probba, Gala y Summa con DVH y fabricación a medida.</p></body></html>',
        ),
      headers: {
        get: vi.fn((key: string) => {
          if (key === 'content-type') return 'text/html; charset=utf-8'
          if (key === 'etag') return '"etag-product-1"'
          if (key === 'last-modified') return 'Wed, 27 Mar 2026 12:00:00 GMT'
          return null
        }),
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    prisma.knowledgeDocument.upsert.mockImplementation(async ({ create }) => ({
      id:
        String(create.sourceKey).includes(':fact:')
          ? `doc_fact_${String(create.sourceKey).split(':').slice(-1)[0]}`
          : 'doc_web_product_1',
      tenantKey: create.tenantKey,
      scope: create.scope,
      sourceType: create.sourceType,
      status: create.status,
      sourceKey: create.sourceKey,
      title: create.title,
      summary: create.summary ?? null,
      content: create.content,
      sourceFileName: create.sourceFileName ?? null,
      sourceFilePath: create.sourceFilePath ?? null,
      sourceFileMime: create.sourceFileMime ?? null,
      sourceFileSize: create.sourceFileSize ?? null,
      tags: create.tags ?? [],
      piiRiskLevel: create.piiRiskLevel ?? 'low',
      metadata: create.metadata ?? null,
      approvedAt: create.approvedAt ?? null,
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:00:00.000Z'),
      embedding: null,
    }))
    prisma.knowledgeDocument.findUnique.mockResolvedValue({
      id: 'doc_web_product_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      sourceType: 'WEB_URL',
      status: 'ACTIVE',
      sourceKey: 'web:product',
      title: 'Aberturas de aluminio | Urucortinas',
      summary: 'Aberturas de aluminio con lineas Probba, Gala, Summa y DVH.',
      content:
        'Venta e instalación de aberturas en aluminio en Montevideo y todo Uruguay. Líneas Probba, Gala y Summa con DVH y fabricación a medida.',
      sourceFileName: null,
      sourceFilePath: null,
      sourceFileMime: null,
      sourceFileSize: null,
      tags: ['sitio'],
      piiRiskLevel: 'low',
      metadata: {
        url: 'https://urucortinas.com.uy/aberturas.html',
        refreshPolicy: 'daily',
        lastFetchedAt: '2026-03-27T12:00:00.000Z',
        documentKind: 'web_page',
        pageKinds: ['product_page'],
      },
      approvedAt: new Date('2026-03-27T12:00:00.000Z'),
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:00:00.000Z'),
      embedding: null,
    })

    await service.createUrlDocument(
      {
        scope: 'customer_public',
        url: 'https://urucortinas.com.uy/aberturas.html',
        tags: ['sitio'],
        refreshPolicy: 'daily',
      },
      7,
    )

    expect(prisma.knowledgeDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          metadata: expect.objectContaining({
            documentKind: 'web_page',
            pageKinds: expect.arrayContaining(['product_page']),
            structuredFacts: expect.arrayContaining([
              expect.objectContaining({
                factType: 'product_topic',
                factValue: 'aberturas de aluminio',
              }),
              expect.objectContaining({
                factType: 'product_variant',
                factValue: 'dvh',
              }),
            ]),
          }),
        }),
      }),
    )
    expect(prisma.knowledgeDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceKey: expect.stringContaining(':fact:product_topic:aberturas-de-aluminio'),
          metadata: expect.objectContaining({
            documentKind: 'derived_web_fact',
            factType: 'product_topic',
            factValue: 'aberturas de aluminio',
            topicType: 'product_topic',
          }),
        }),
      }),
    )
    expect(prisma.knowledgeDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceKey: expect.stringContaining(':fact:product_variant:dvh'),
          metadata: expect.objectContaining({
            documentKind: 'derived_web_fact',
            factType: 'product_variant',
            factValue: 'dvh',
            topicType: 'product_variant',
          }),
        }),
      }),
    )

    vi.unstubAllGlobals()
  })

  it('derives a tenant topic taxonomy from approved product knowledge facts', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      {
        id: 'doc_topic_aberturas',
        title: 'Dato web · Producto · Aberturas de aluminio',
        tags: ['product_topic', 'aberturas', 'aluminio'],
        metadata: {
          documentKind: 'derived_web_fact',
          factType: 'product_topic',
          factKey: 'aberturas-de-aluminio',
          factValue: 'aberturas de aluminio',
          topicType: 'product_topic',
          derivedFromDocumentId: 'doc_web_aberturas',
        },
      },
      {
        id: 'doc_variant_probba',
        title: 'Dato web · Variante · Probba',
        tags: ['product_variant', 'probba'],
        metadata: {
          documentKind: 'derived_web_fact',
          factType: 'product_variant',
          factKey: 'probba',
          factValue: 'probba',
          topicType: 'product_variant',
          derivedFromDocumentId: 'doc_web_aberturas',
        },
      },
      {
        id: 'doc_variant_dvh',
        title: 'Dato web · Variante · DVH',
        tags: ['product_variant', 'dvh'],
        metadata: {
          documentKind: 'derived_web_fact',
          factType: 'product_variant',
          factKey: 'dvh',
          factValue: 'dvh',
          topicType: 'product_variant',
          derivedFromDocumentId: 'doc_web_aberturas',
        },
      },
      {
        id: 'doc_taxonomy_curated_1',
        title: 'Taxonomía customer · Urucortinas',
        tags: ['taxonomy', 'customer_public'],
        metadata: {
          sourceKind: 'tenant_topic_taxonomy',
          topicTaxonomy: [
            {
              key: 'product_topic:cortinas-roller',
              kind: 'product_topic',
              label: 'cortinas roller',
              aliases: ['cortinas roller', 'roller', 'roler', 'rolller'],
              normalizationValue: 'roller',
              familyLabel: 'cortinas',
              parentKeys: ['product_family:cortina'],
              parentLabels: ['cortinas'],
              tags: ['roller', 'cortinas'],
            },
            {
              key: 'product_variant:blackout',
              kind: 'product_variant',
              label: 'blackout',
              aliases: ['blackout', 'black out', 'balckout'],
              normalizationValue: 'blackout',
              familyLabel: 'cortinas',
              parentKeys: [
                'product_topic:cortinas-roller',
                'product_family:cortina',
              ],
              parentLabels: ['cortinas roller', 'cortinas'],
              tags: ['blackout'],
            },
          ],
        },
      },
    ])

    const result = await service.getTopicTaxonomy({
      tenantKey: 'urucortinas',
      scope: 'customer_public',
    })

    expect(result).toMatchObject({
      tenantKey: 'urucortinas',
      scope: 'customer_public',
    })
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'product_family',
          label: 'aberturas',
          aliases: expect.arrayContaining(['aberturas', 'abertura']),
        }),
        expect.objectContaining({
          kind: 'product_topic',
          label: 'aberturas de aluminio',
          normalizationValue: null,
          familyLabel: 'aberturas',
          parentLabels: expect.arrayContaining(['aberturas']),
        }),
        expect.objectContaining({
          kind: 'product_variant',
          label: 'probba',
          parentLabels: expect.arrayContaining([
            'aberturas',
            'aberturas de aluminio',
          ]),
        }),
        expect.objectContaining({
          kind: 'product_topic',
          label: 'cortinas roller',
          normalizationValue: 'roller',
          aliases: expect.arrayContaining(['roller', 'roler']),
        }),
        expect.objectContaining({
          kind: 'product_variant',
          label: 'blackout',
          normalizationValue: 'blackout',
          aliases: expect.arrayContaining(['black out', 'balckout']),
        }),
      ]),
    )
  })

  it('derives tenant quote profiles from approved curated knowledge metadata', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      {
        id: 'doc_quote_profiles',
        metadata: {
          quoteProfiles: [
            {
              key: 'quote_profile:aberturas',
              label: 'Aberturas',
              appliesToTopicKeys: [
                'product_family:abertura',
                'product_topic:aberturas-de-aluminio',
              ],
              appliesToTopicLabels: ['aberturas', 'aberturas de aluminio'],
              familyLabel: 'aberturas',
              pricingStrategy: 'parametric_exact_or_handoff',
              closureMode: 'collect_then_price_or_handoff',
              measurementCarrierTerms: ['ventana', 'ventanas', 'vano', 'vanos'],
              attributes: [
                {
                  key: 'measurements',
                  label: 'las medidas aproximadas (ancho por alto)',
                  captureKind: 'measurements',
                  required: true,
                },
                {
                  key: 'quantity',
                  label: 'cuántas unidades necesitás',
                  captureKind: 'quantity',
                  required: true,
                },
                {
                  key: 'series',
                  label: 'la serie',
                  captureKind: 'taxonomy_tag',
                  taxonomyTag: 'quote_slot_series',
                  required: true,
                  subjectPrefix: 'serie',
                },
                {
                  key: 'glass',
                  label: 'el tipo de vidrio',
                  captureKind: 'enum',
                  required: true,
                  subjectPrefix: 'con',
                  options: [
                    {
                      value: 'dvh',
                      aliases: ['dvh', 'doble vidrio'],
                    },
                    {
                      value: '4mm',
                      aliases: ['v4mm', '4mm'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ])

    const result = await service.getQuoteProfiles({
      tenantKey: 'urucortinas',
      scope: 'customer_public',
    })

    expect(result).toMatchObject({
      tenantKey: 'urucortinas',
      scope: 'customer_public',
      items: [
        expect.objectContaining({
          key: 'quote_profile:aberturas',
          label: 'Aberturas',
          familyLabel: 'aberturas',
          pricingStrategy: 'parametric_exact_or_handoff',
          closureMode: 'collect_then_price_or_handoff',
          appliesToTopicKeys: expect.arrayContaining([
            'product_family:abertura',
            'product_topic:aberturas-de-aluminio',
          ]),
          measurementCarrierTerms: expect.arrayContaining([
            'ventana',
            'ventanas',
            'vano',
            'vanos',
          ]),
          attributes: expect.arrayContaining([
            expect.objectContaining({
              key: 'measurements',
              captureKind: 'measurements',
              required: true,
            }),
            expect.objectContaining({
              key: 'series',
              captureKind: 'taxonomy_tag',
              taxonomyTag: 'quote_slot_series',
              subjectPrefix: 'serie',
            }),
            expect.objectContaining({
              key: 'glass',
              captureKind: 'enum',
              options: expect.arrayContaining([
                expect.objectContaining({
                  value: 'dvh',
                  aliases: expect.arrayContaining(['dvh', 'doble vidrio']),
                }),
              ]),
            }),
          ]),
        }),
      ],
    })
  })

  it('merges active derived topic taxonomy artifacts into the effective taxonomy', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([])
    prisma.knowledgeDerivedArtifact.findMany.mockResolvedValue([
      {
        id: 'artifact_topic_roller',
        type: 'TOPIC_TAXONOMY',
        sourceDocumentId: 'doc_curated_taxonomy',
        content: {
          key: 'product_topic:cortinas-roller',
          kind: 'product_topic',
          label: 'cortinas roller',
          aliases: ['roller', 'roler'],
          familyLabel: 'cortinas',
          parentKeys: ['product_family:cortinas'],
          parentLabels: ['cortinas'],
          tags: ['roller', 'cortinas'],
        },
        metadata: null,
      },
      {
        id: 'artifact_lexicon_roller',
        type: 'KEYWORD_LEXICON',
        sourceDocumentId: 'doc_curated_taxonomy',
        content: {
          key: 'lexicon:product_topic:cortinas-roller',
          label: 'cortinas roller',
          aliases: ['roller blackout', 'roller screen'],
          topicKey: 'product_topic:cortinas-roller',
          quoteProfileKey: null,
          taxonomyTag: null,
          sourceDocumentIds: ['doc_curated_taxonomy'],
        },
        metadata: null,
      },
    ])

    const result = await service.getTopicTaxonomy({
      tenantKey: 'urucortinas',
      scope: 'customer_public',
    })

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'product_topic:cortinas-roller',
          label: 'cortinas roller',
          aliases: expect.arrayContaining([
            'roller',
            'roler',
            'roller blackout',
            'roller screen',
          ]),
        }),
      ]),
    )
  })

  it('merges active derived quote profile artifacts into the effective quote profiles', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([])
    prisma.knowledgeDerivedArtifact.findMany.mockResolvedValue([
      {
        id: 'artifact_quote_roller',
        type: 'QUOTE_PROFILE_HINTS',
        sourceDocumentId: 'doc_quote_playbook',
        content: {
          key: 'quote_profile:cortinas_roller',
          label: 'Cortinas roller',
          appliesToTopicKeys: ['product_topic:cortinas-roller'],
          appliesToTopicLabels: ['cortinas roller'],
          familyLabel: 'cortinas',
          pricingStrategy: 'handoff_only',
          closureMode: 'collect_then_handoff',
          measurementCarrierTerms: ['ventana'],
          attributes: [
            {
              key: 'measurements',
              label: 'las medidas aproximadas (ancho por alto)',
              required: true,
              captureKind: 'measurements',
              options: [],
              taxonomyTag: null,
              subjectPrefix: null,
            },
            {
              key: 'quantity',
              label: 'cuántas unidades necesitás',
              required: true,
              captureKind: 'quantity',
              options: [],
              taxonomyTag: null,
              subjectPrefix: null,
            },
          ],
        },
        metadata: null,
      },
      {
        id: 'artifact_carriers_roller',
        type: 'MEASUREMENT_CARRIER_TERMS',
        sourceDocumentId: 'doc_quote_playbook',
        content: {
          key: 'measurement_carriers:quote_profile:cortinas_roller',
          label: 'Cortinas roller',
          quoteProfileKey: 'quote_profile:cortinas_roller',
          appliesToTopicKeys: ['product_topic:cortinas-roller'],
          appliesToTopicLabels: ['cortinas roller'],
          measurementCarrierTerms: ['ventanas', 'vano'],
          sourceDocumentIds: ['doc_quote_playbook'],
        },
        metadata: null,
      },
    ])

    const result = await service.getQuoteProfiles({
      tenantKey: 'urucortinas',
      scope: 'customer_public',
    })

    expect(result.items).toEqual([
      expect.objectContaining({
        key: 'quote_profile:cortinas_roller',
        measurementCarrierTerms: expect.arrayContaining([
          'ventana',
          'ventanas',
          'vano',
        ]),
      }),
    ])
  })

  it('syncs derived artifacts when updating an approved document with structured quote rules', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce({
      id: 'doc_quote_rules',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      sourceType: 'ADMIN_CURATED',
      status: 'ACTIVE',
      sourceKey: 'curated:quote-rules:1',
      title: 'Reglas de cotización',
      summary: 'Resumen original',
      content: '# Documento',
      tags: ['quote-rules'],
      piiRiskLevel: 'low',
      metadata: { source: 'admin-ui' },
      approvedAt: new Date('2026-03-27T12:00:00.000Z'),
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:00:00.000Z'),
    })
    prisma.knowledgeDocument.update.mockImplementation(async ({ data }) => ({
      id: 'doc_quote_rules',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      sourceType: 'ADMIN_CURATED',
      status: 'ACTIVE',
      sourceKey: 'curated:quote-rules:1',
      title: data.title ?? 'Reglas de cotización',
      summary: data.summary ?? null,
      content: data.content,
      tags: data.tags ?? [],
      piiRiskLevel: 'low',
      metadata: data.metadata ?? null,
      approvedAt: new Date('2026-03-27T12:00:00.000Z'),
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-28T00:00:00.000Z'),
    }))
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce({
      id: 'doc_quote_rules',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      sourceType: 'ADMIN_CURATED',
      status: 'ACTIVE',
      sourceKey: 'curated:quote-rules:1',
      title: 'Reglas de cotización',
      summary: 'Resumen actualizado',
      content: [
        '# Perfiles de cotización',
        '',
        '## Aberturas',
        '- Key: quote_profile:aberturas',
        '- Familia: aberturas',
        '- Aplica a tópicos: aberturas de aluminio',
        '- Topic keys: product_topic:aberturas-de-aluminio',
        '- Estrategia de pricing: parametric_exact_or_handoff',
        '- Cierre operativo: collect_then_price_or_handoff',
        '- Términos portadores de medida: ventana, vano',
        '- Atributos:',
        '  - las medidas aproximadas (ancho por alto) · [measurements] · required · capture:measurements',
        '  - cuántas unidades necesitás · [quantity] · required · capture:quantity',
        '  - la serie · [series] · required · capture:taxonomy_tag · taxonomy:quote_slot_series · prefix:serie',
      ].join('\n'),
      tags: ['quote-rules'],
      piiRiskLevel: 'low',
      metadata: { source: 'admin-ui' },
      approvedAt: new Date('2026-03-27T12:00:00.000Z'),
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      embedding: null,
    })

    await service.updateDocument(
      'doc_quote_rules',
      {
        content: [
          '# Perfiles de cotización',
          '',
          '## Aberturas',
          '- Key: quote_profile:aberturas',
          '- Familia: aberturas',
          '- Aplica a tópicos: aberturas de aluminio',
          '- Topic keys: product_topic:aberturas-de-aluminio',
          '- Estrategia de pricing: parametric_exact_or_handoff',
          '- Cierre operativo: collect_then_price_or_handoff',
          '- Términos portadores de medida: ventana, vano',
          '- Atributos:',
          '  - las medidas aproximadas (ancho por alto) · [measurements] · required · capture:measurements',
          '  - cuántas unidades necesitás · [quantity] · required · capture:quantity',
          '  - la serie · [series] · required · capture:taxonomy_tag · taxonomy:quote_slot_series · prefix:serie',
        ].join('\n'),
        summary: 'Resumen actualizado',
      },
      7,
    )

    expect(prisma.knowledgeDerivedArtifact.deleteMany).toHaveBeenCalledWith({
      where: {
        sourceDocumentId: 'doc_quote_rules',
      },
    })
    expect(prisma.knowledgeDerivedArtifact.createMany).toHaveBeenCalledTimes(1)
    expect(prisma.knowledgeDerivedArtifact.createMany.mock.calls[0][0].data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'QUOTE_PROFILE_HINTS',
          sourceDocumentId: 'doc_quote_rules',
        }),
        expect.objectContaining({
          type: 'MEASUREMENT_CARRIER_TERMS',
          sourceDocumentId: 'doc_quote_rules',
        }),
        expect.objectContaining({
          type: 'KEYWORD_LEXICON',
          sourceDocumentId: 'doc_quote_rules',
        }),
      ]),
    )
  })

  it('does not derive topic taxonomy artifacts from tenant quote profile documents', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce({
      id: 'doc_managed_quote_profiles',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      sourceType: 'ADMIN_CURATED',
      status: 'ACTIVE',
      sourceKey: 'curated:quote-profiles:managed',
      title: 'Perfiles de cotización · Urucortinas',
      summary: 'Resumen original',
      content: '# Documento',
      tags: ['tenant-quote-profiles'],
      piiRiskLevel: 'low',
      metadata: {
        source: 'admin-ui',
        sourceKind: 'tenant_quote_profiles',
      },
      approvedAt: new Date('2026-03-27T12:00:00.000Z'),
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:00:00.000Z'),
    })
    prisma.knowledgeDocument.update.mockImplementation(async ({ data }) => ({
      id: 'doc_managed_quote_profiles',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      sourceType: 'ADMIN_CURATED',
      status: 'ACTIVE',
      sourceKey: 'curated:quote-profiles:managed',
      title: data.title ?? 'Perfiles de cotización · Urucortinas',
      summary: data.summary ?? null,
      content: data.content,
      tags: data.tags ?? [],
      piiRiskLevel: 'low',
      metadata: data.metadata ?? null,
      approvedAt: new Date('2026-03-27T12:00:00.000Z'),
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-28T00:00:00.000Z'),
    }))
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce({
      id: 'doc_managed_quote_profiles',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      sourceType: 'ADMIN_CURATED',
      status: 'ACTIVE',
      sourceKey: 'curated:quote-profiles:managed',
      title: 'Perfiles de cotización · Urucortinas',
      summary: 'Resumen actualizado',
      content: [
        '# Perfiles de cotización',
        '',
        '## Cortinas roller',
        '- Key: quote_profile:cortinas_roller',
        '- Familia: cortinas',
        '- Aplica a tópicos: cortinas roller',
        '- Topic keys: product_topic:cortinas-roller',
        '- Estrategia de pricing: immediate_square_meter',
        '- Cierre operativo: collect_then_price_or_handoff',
        '- Términos portadores de medida: ventana, vano',
        '- Atributos:',
        '  - las medidas aproximadas (ancho por alto) · [measurements] · required · capture:measurements',
        '  - cuántas unidades necesitás · [quantity] · required · capture:quantity',
        '  - el color · [color] · capture:enum · options:blanco, negro',
      ].join('\n'),
      tags: ['tenant-quote-profiles'],
      piiRiskLevel: 'low',
      metadata: {
        source: 'admin-ui',
        sourceKind: 'tenant_quote_profiles',
      },
      approvedAt: new Date('2026-03-27T12:00:00.000Z'),
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      embedding: null,
    })

    await service.updateDocument(
      'doc_managed_quote_profiles',
      {
        content: [
          '# Perfiles de cotización',
          '',
          '## Cortinas roller',
          '- Key: quote_profile:cortinas_roller',
          '- Familia: cortinas',
          '- Aplica a tópicos: cortinas roller',
          '- Topic keys: product_topic:cortinas-roller',
          '- Estrategia de pricing: immediate_square_meter',
          '- Cierre operativo: collect_then_price_or_handoff',
          '- Términos portadores de medida: ventana, vano',
          '- Atributos:',
          '  - las medidas aproximadas (ancho por alto) · [measurements] · required · capture:measurements',
          '  - cuántas unidades necesitás · [quantity] · required · capture:quantity',
          '  - el color · [color] · capture:enum · options:blanco, negro',
        ].join('\n'),
        summary: 'Resumen actualizado',
      },
      7,
    )

    const createManyPayload =
      prisma.knowledgeDerivedArtifact.createMany.mock.calls.at(-1)?.[0]?.data ?? []

    expect(createManyPayload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'QUOTE_PROFILE_HINTS',
          sourceDocumentId: 'doc_managed_quote_profiles',
        }),
        expect.objectContaining({
          type: 'MEASUREMENT_CARRIER_TERMS',
          sourceDocumentId: 'doc_managed_quote_profiles',
        }),
      ]),
    )
    expect(createManyPayload).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'TOPIC_TAXONOMY',
          sourceDocumentId: 'doc_managed_quote_profiles',
        }),
      ]),
    )
  })

  it('refreshes due URL knowledge documents only when policy is due', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      {
        id: 'doc_due',
        metadata: {
          url: 'https://urucortinas.com.uy/',
          refreshPolicy: 'daily',
          nextRefreshAt: '2026-03-20T00:00:00.000Z',
        },
      },
      {
        id: 'doc_manual',
        metadata: {
          url: 'https://urucortinas.com.uy/contacto.html',
          refreshPolicy: 'manual',
          nextRefreshAt: null,
        },
      },
    ])

    const refreshSpy = vi
      .spyOn(service, 'refreshUrlDocument')
      .mockResolvedValue({ id: 'doc_due' } as never)

    const result = await service.refreshDueUrlDocuments({}, 4)

    expect(refreshSpy).toHaveBeenCalledTimes(1)
    expect(refreshSpy).toHaveBeenCalledWith('doc_due', 4)
    expect(result).toMatchObject({
      refreshedCount: 1,
      refreshedIds: ['doc_due'],
    })
  })

  it('updates a knowledge document and reindexes active approved content', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce({
      id: 'doc_1',
      tenantKey: 'urucortinas',
      scope: 'ADMIN_INTERNAL',
      sourceType: 'ADMIN_CURATED',
      status: 'ACTIVE',
      sourceKey: 'curated:entrega:1',
      title: 'Entrega',
      summary: 'Resumen original',
      content: 'Contenido original',
      tags: ['ventas'],
      piiRiskLevel: 'low',
      metadata: { source: 'admin-ui' },
      approvedAt: new Date('2026-03-25T12:00:00.000Z'),
      createdAt: new Date('2026-03-25T12:00:00.000Z'),
      updatedAt: new Date('2026-03-25T12:00:00.000Z'),
    })
    prisma.knowledgeDocument.update.mockImplementation(async ({ data }) => ({
      id: 'doc_1',
      tenantKey: 'urucortinas',
      scope: data.scope ?? 'ADMIN_INTERNAL',
      sourceType: 'ADMIN_CURATED',
      status: data.status ?? 'ACTIVE',
      sourceKey: 'curated:entrega:1',
      title: data.title,
      summary: data.summary,
      content: data.content,
      tags: data.tags,
      piiRiskLevel: 'low',
      metadata: data.metadata,
      approvedAt: new Date('2026-03-25T12:00:00.000Z'),
      createdAt: new Date('2026-03-25T12:00:00.000Z'),
      updatedAt: new Date('2026-03-26T12:00:00.000Z'),
    }))
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce({
      id: 'doc_1',
      tenantKey: 'urucortinas',
      scope: 'ADMIN_INTERNAL',
      sourceType: 'ADMIN_CURATED',
      status: 'ACTIVE',
      sourceKey: 'curated:entrega:1',
      title: 'Entrega actualizada',
      summary: 'Resumen actualizado',
      content: 'Contenido actualizado',
      tags: ['ventas', 'faq'],
      piiRiskLevel: 'low',
      metadata: { source: 'admin-ui', lastEditedByUserId: 7 },
      approvedAt: new Date('2026-03-25T12:00:00.000Z'),
      createdAt: new Date('2026-03-25T12:00:00.000Z'),
      updatedAt: new Date('2026-03-26T12:00:00.000Z'),
      embedding: null,
    })

    const result = await service.updateDocument(
      'doc_1',
      {
        title: 'Entrega actualizada',
        summary: 'Resumen actualizado',
        content: 'Contenido actualizado',
        tags: ['ventas', 'faq'],
        status: 'active',
      },
      7,
    )

    expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc_1' },
        data: expect.objectContaining({
          title: 'Entrega actualizada',
          content: 'Contenido actualizado',
          tags: ['ventas', 'faq'],
          status: 'ACTIVE',
        }),
      }),
    )
    expect(embeddings.indexDocument).toHaveBeenCalled()
    expect(result).toMatchObject({
      id: 'doc_1',
      title: 'Entrega actualizada',
      summary: 'Resumen actualizado',
    })
  })

  it('lists suggestion feedback with candidate and conversation context', async () => {
    prisma.knowledgeSuggestionFeedback.findMany.mockResolvedValue([
      {
        id: 'feed_1',
        tenantKey: 'urucortinas',
        outcome: 'USED',
        suggestedText: 'Respuesta sugerida',
        finalText: 'Respuesta final',
        metadata: { source: 'admin-inbox' },
        createdAt: new Date('2026-03-26T12:00:00.000Z'),
        updatedAt: new Date('2026-03-26T12:10:00.000Z'),
        candidate: {
          id: 'cand_1',
          title: 'Estado de pedido',
          detectedIntent: 'order.status',
          status: 'APPROVED',
          scope: 'CUSTOMER_PUBLIC',
          sourceType: 'CONVERSATION_DERIVED',
          version: 2,
        },
        conversation: {
          id: 'conv_1',
          subject: 'Pedido atrasado',
          channel: 'WEBCHAT',
          scope: 'CUSTOMER_PUBLIC',
        },
        actorUser: {
          id: 11,
          name: 'Operador QA',
          email: 'qa@example.com',
        },
        targetMessage: {
          id: 'msg_target',
          body: '¿Ya salió mi pedido?',
          createdAt: new Date('2026-03-26T11:59:00.000Z'),
        },
        operatorMessage: {
          id: 'msg_operator',
          body: 'Respuesta final',
          createdAt: new Date('2026-03-26T12:00:00.000Z'),
        },
      },
    ])

    const result = await service.listFeedback({
      outcome: 'used',
      search: 'pedido',
    })

    expect(prisma.knowledgeSuggestionFeedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantKey: 'urucortinas',
          outcome: 'USED',
        }),
      }),
    )
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'feed_1',
      outcome: 'used',
      channel: 'webchat',
      candidate: {
        id: 'cand_1',
        title: 'Estado de pedido',
      },
      conversation: {
        id: 'conv_1',
        subject: 'Pedido atrasado',
      },
    })
  })

  it('builds and persists a deterministic latest knowledge snapshot when none exists', async () => {
    const now = new Date('2026-03-27T22:00:00.000Z')
    prisma.knowledgeSnapshot.findFirst.mockResolvedValue(null)
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      {
        id: 'doc_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        sourceType: 'ADMIN_CURATED',
        status: 'ACTIVE',
        sourceKey: 'manual:doc_1',
        title: 'Política de seguimiento',
        summary: 'Pedir identificador antes de confirmar estado.',
        content: 'Pedir identificador antes de confirmar estado.',
        tags: ['orders'],
        piiRiskLevel: 'low',
        metadata: null,
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
        embedding: null,
      },
    ])
    prisma.knowledgeCandidate.findMany.mockResolvedValue([
      {
        id: 'cand_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        sourceType: 'CONVERSATION_DERIVED',
        status: 'APPROVED',
        observationId: 'raw_approved',
        title: 'Estado de pedido',
        excerpt: 'Necesito saber si ya salió mi pedido',
        redactedExcerpt: null,
        summary: 'Respuesta aprobada para seguimiento',
        detectedIntent: 'order.status',
        problem: 'Seguimiento',
        contextSummary: 'Cliente consulta por su pedido',
        suggestedResponse: 'Ya revisamos tu pedido.',
        approvedResponse: 'Ya revisamos tu pedido y te confirmamos el estado.',
        confidence: 0.94,
        dedupeHash: 'cand_hash',
        clusterKey: 'orders',
        version: 2,
        piiDetected: false,
        metadata: null,
        conversationId: 'conv_1',
        messageId: 'msg_1',
        createdByUserId: 7,
        reviewedByUserId: 7,
        reviewedAt: now,
        createdAt: now,
        updatedAt: now,
        conversation: {
          id: 'conv_1',
          subject: 'Consulta pedido',
          channel: 'WEBCHAT',
        },
        observation: {
          id: 'raw_approved',
          status: 'PROCESSED',
          channel: 'WEBCHAT',
          sourceAuthorType: 'CUSTOMER',
          userMessage: '¿Ya salió mi pedido?',
          operatorReply: 'Te confirmamos el estado enseguida.',
          aiReply: null,
          createdAt: now,
          updatedAt: now,
        },
      },
    ])
    prisma.knowledgeRawEvent.findMany.mockResolvedValue([
      {
        id: 'raw_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        channel: 'WEBCHAT',
        sourceAuthorType: 'CUSTOMER',
        status: 'NEW',
        conversationId: 'conv_2',
        messageId: 'msg_2',
        userMessage: 'No sé cómo hacer una devolución',
        normalizedMessage: 'no se como hacer una devolucion',
        redactedMessage: null,
        operatorReply: null,
        aiReply: null,
        detectedIntent: 'returns.policy',
        problem: 'Consulta devolución',
        contextSummary: 'Cliente consulta proceso de devolución',
        suggestedResponse: null,
        confidence: 0.67,
        relevanceScore: 0.54,
        dedupeHash: 'raw_hash',
        clusterKey: 'returns',
        messageElements: null,
        messageContextOrigin: null,
        attachments: null,
        metadata: null,
        ingestionRunId: null,
        createdAt: now,
        updatedAt: now,
        conversation: {
          id: 'conv_2',
          subject: 'Devolución',
          channel: 'WEBCHAT',
          scope: 'CUSTOMER_PUBLIC',
        },
        candidate: null,
      },
    ])

    prisma.knowledgeSnapshot.create.mockImplementation(async ({ data }) => ({
      id: 'snap_1',
      tenantKey: data.tenantKey,
      scope: data.scope,
      status: data.status,
      version: data.version,
      generationReason: data.generationReason,
      summaryText: data.summaryText ?? null,
      metrics: data.metrics ?? null,
      coverageScore: data.coverageScore ?? null,
      metadata: data.metadata ?? null,
      generatedAt: data.generatedAt ?? now,
      createdAt: now,
      updatedAt: now,
      generatedByUser: null,
      entries: (data.entries?.create ?? []).map((entry: any, index: number) => ({
        id: `entry_${index + 1}`,
        entryType: entry.entryType,
        key: entry.key,
        title: entry.title,
        plainText: entry.plainText,
        normalizedIntent: entry.normalizedIntent ?? null,
        topicKey: entry.topicKey ?? null,
        confidence: entry.confidence ?? null,
        priority: entry.priority ?? null,
        appliesToChannels: entry.appliesToChannels ?? [],
        metadata: entry.metadata ?? null,
        createdAt: now,
        updatedAt: now,
        sources: (entry.sources?.create ?? []).map((source: any, sourceIndex: number) => ({
          id: `source_${index + 1}_${sourceIndex + 1}`,
          sourceKind: source.sourceKind,
          sourceId: source.sourceId,
          sourceVersion: source.sourceVersion ?? null,
          sourceStatus: source.sourceStatus ?? null,
          role: source.role,
          excerpt: source.excerpt ?? null,
          metadata: source.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        })),
      })),
    }))
    prisma.knowledgeSnapshot.update.mockImplementation(async ({ data }) => ({
      id: 'snap_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      status: 'READY',
      version: 1,
      generationReason: 'initial_build',
      summaryText: data.summaryText ?? null,
      metrics: {
        activeDocuments: 1,
        approvedCandidates: 1,
        pendingRawEvents: 1,
        activeEntries: 2,
        gapEntries: 1,
        totalEntries: 3,
      },
      coverageScore: 2 / 3,
      metadata: {
        generatedWithoutLlm: true,
      },
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
      generatedByUser: null,
      entries: [
        {
          id: 'entry_1',
          entryType: 'APPROVED_RULE',
          key: 'document:doc_1',
          title: 'Política de seguimiento',
          plainText: 'Pedir identificador antes de confirmar estado.',
          normalizedIntent: null,
          topicKey: 'orders',
          confidence: null,
          priority: 'medium',
          appliesToChannels: [],
          metadata: null,
          createdAt: now,
          updatedAt: now,
          sources: [
            {
              id: 'source_1',
              sourceKind: 'KNOWLEDGE_DOCUMENT',
              sourceId: 'doc_1',
              sourceVersion: null,
              sourceStatus: 'active',
              role: 'PRIMARY_SUPPORT',
              excerpt: 'Pedir identificador antes de confirmar estado.',
              metadata: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      ],
    }))

    const result = await service.getLatestSnapshot({
      tenantKey: 'urucortinas',
      scope: 'customer_public',
    })

    expect(prisma.knowledgeSnapshot.create).toHaveBeenCalled()
    expect(result).toMatchObject({
      id: 'snap_1',
      status: 'ready',
      scope: 'customer_public',
      version: 1,
    })
    expect(result.summaryText).toContain('Qué interpreta hoy el sistema')
    expect(result.summaryText).toContain('Vacíos detectados')
  })

  it('returns plain text from a persisted knowledge snapshot', async () => {
    const now = new Date('2026-03-27T22:00:00.000Z')
    prisma.knowledgeSnapshot.findUnique.mockResolvedValue({
      id: 'snap_2',
      tenantKey: 'urucortinas',
      scope: 'ADMIN_INTERNAL',
      status: 'READY',
      version: 2,
      generationReason: 'auto_refresh',
      summaryText: 'Scope: admin_internal\n\nQué interpreta hoy el sistema:\n- Operaciones',
      metrics: {
        activeDocuments: 2,
      },
      coverageScore: 1,
      metadata: null,
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
      generatedByUser: null,
      entries: [],
    })

    const result = await service.getSnapshotPlainText('snap_2')

    expect(result).toMatchObject({
      id: 'snap_2',
      scope: 'admin_internal',
      version: 2,
    })
    expect(result.plainText).toContain('Scope: admin_internal')
  })

  it('renders base runtime knowledge when there is no approved knowledge yet', async () => {
    const now = new Date('2026-03-27T22:00:00.000Z')
    prisma.knowledgeSnapshot.findFirst.mockResolvedValue(null)
    prisma.knowledgeDocument.findMany.mockResolvedValue([])
    prisma.knowledgeCandidate.findMany.mockResolvedValue([])
    prisma.knowledgeRawEvent.findMany.mockResolvedValue([])

    prisma.knowledgeSnapshot.create.mockImplementation(async ({ data }) => ({
      id: 'snap_base',
      tenantKey: data.tenantKey,
      scope: data.scope,
      status: data.status,
      version: data.version,
      generationReason: data.generationReason,
      summaryText: data.summaryText ?? null,
      metrics: data.metrics ?? null,
      coverageScore: data.coverageScore ?? null,
      metadata: data.metadata ?? null,
      generatedAt: data.generatedAt ?? now,
      createdAt: now,
      updatedAt: now,
      generatedByUser: null,
      entries: (data.entries?.create ?? []).map((entry: any, index: number) => ({
        id: `entry_base_${index + 1}`,
        entryType: entry.entryType,
        key: entry.key,
        title: entry.title,
        plainText: entry.plainText,
        normalizedIntent: entry.normalizedIntent ?? null,
        topicKey: entry.topicKey ?? null,
        confidence: entry.confidence ?? null,
        priority: entry.priority ?? null,
        appliesToChannels: entry.appliesToChannels ?? [],
        metadata: entry.metadata ?? null,
        createdAt: now,
        updatedAt: now,
        sources: (entry.sources?.create ?? []).map((source: any, sourceIndex: number) => ({
          id: `source_base_${index + 1}_${sourceIndex + 1}`,
          sourceKind: source.sourceKind,
          sourceId: source.sourceId,
          sourceVersion: source.sourceVersion ?? null,
          sourceStatus: source.sourceStatus ?? null,
          role: source.role,
          excerpt: source.excerpt ?? null,
          metadata: source.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        })),
      })),
    }))
    prisma.knowledgeSnapshot.update.mockImplementation(async ({ data }) => ({
      id: 'snap_base',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      status: 'READY',
      version: 1,
      generationReason: 'initial_build',
      summaryText: data.summaryText ?? null,
      metrics: data.metrics ?? null,
      coverageScore: 0,
      metadata: {
        generatedWithoutLlm: true,
      },
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
      generatedByUser: null,
      entries: [
        {
          id: 'entry_base_1',
          entryType: 'OPERATIONAL_NOTE',
          key: 'base:customer_public:natural_conversation',
          title: 'Conversación base con cliente',
          plainText:
            'El sistema debe responder de forma natural, breve y útil aun cuando no exista conocimiento específico aprobado para la consulta.',
          normalizedIntent: null,
          topicKey: 'customer.base_conversation',
          confidence: null,
          priority: 'medium',
          appliesToChannels: ['webchat', 'whatsapp', 'email', 'meta'],
          metadata: {
            synthetic: true,
            entryClass: 'default_runtime_rule',
          },
          createdAt: now,
          updatedAt: now,
          sources: [
            {
              id: 'source_base_1_1',
              sourceKind: 'KNOWLEDGE_DOCUMENT',
              sourceId:
                'system:default-runtime:customer_public:base:customer_public:natural_conversation',
              sourceVersion: null,
              sourceStatus: 'builtin',
              role: 'PRIMARY_SUPPORT',
              excerpt: 'El sistema debe responder de forma natural, breve y útil.',
              metadata: {
                synthetic: true,
                label: 'Reglas base del runtime',
              },
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      ],
    }))

    const result = await service.getLatestSnapshot({
      tenantKey: 'urucortinas',
      scope: 'customer_public',
    })

    expect(result.summaryText).toContain(
      'Todavía no hay conocimiento aprobado suficiente para este scope',
    )
    expect(result.summaryText).toContain(
      'Se mantiene la base operativa predeterminada',
    )
    expect(result.summaryText).toContain('Conversación base con cliente')
  })

  it('creates a pending negative example when a candidate is rejected', async () => {
    prisma.knowledgeCandidate.findUnique
      .mockResolvedValueOnce({
        id: 'cand_reject_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        status: 'PENDING',
        title: 'Seguimiento de pedido',
        approvedResponse: null,
        suggestedResponse: 'No veo tu pedido todavía.',
        redactedExcerpt: null,
        excerpt: 'No veo tu pedido todavía.',
        observationId: null,
        conversationId: null,
        metadata: null,
      })
      .mockResolvedValueOnce({
        id: 'cand_reject_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        status: 'REJECTED',
        title: 'Seguimiento de pedido',
        summary: null,
        detectedIntent: 'order.status',
        suggestedResponse: 'No veo tu pedido todavía.',
        approvedResponse: null,
        excerpt: 'No veo tu pedido todavía.',
        conversationId: null,
        conversation: null,
      })
    prisma.knowledgeCandidate.update.mockResolvedValue({
      id: 'cand_reject_1',
      status: 'REJECTED',
    })
    prisma.knowledgeNegativeExample.findFirst.mockResolvedValue(null)
    prisma.knowledgeNegativeExample.create.mockResolvedValue({
      id: 'neg_1',
    })

    const result = await service.reviewCandidate(
      'cand_reject_1',
      { action: 'reject' },
      7,
    )

    expect(result).toMatchObject({
      candidate: {
        id: 'cand_reject_1',
        status: 'rejected',
      },
      promotedDocument: null,
    })
    expect(prisma.knowledgeNegativeExample.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        status: 'PENDING',
        sourceKind: 'REJECTED_CANDIDATE',
        candidateId: 'cand_reject_1',
        title: 'Candidate rechazado: Seguimiento de pedido',
        disallowedText: 'No veo tu pedido todavía.',
        createdByUserId: 7,
      }),
    })
  })

  it('creates a pending negative example when approved feedback is discarded', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
    })
    prisma.knowledgeCandidate.findUnique.mockResolvedValue({
      id: 'cand_approved_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      status: 'APPROVED',
    })
    prisma.knowledgeSuggestionFeedback.create.mockResolvedValue({
      id: 'feedback_1',
      outcome: 'DISCARDED',
      candidateId: 'cand_approved_1',
      conversationId: 'conv_1',
      operatorMessageId: null,
      createdAt: new Date('2026-03-27T23:00:00.000Z'),
    })
    prisma.knowledgeSuggestionFeedback.findUnique.mockResolvedValue({
      id: 'feedback_1',
      outcome: 'DISCARDED',
      suggestedText: 'Tu pedido ya salió.',
      finalText: 'Necesito verificarlo antes de confirmarte.',
      conversation: {
        id: 'conv_1',
        tenantKey: 'urucortinas',
        channel: 'WEBCHAT',
        scope: 'CUSTOMER_PUBLIC',
        subject: 'Seguimiento',
      },
      candidate: {
        id: 'cand_approved_1',
        title: 'Seguimiento de pedido',
        detectedIntent: 'order.status',
        scope: 'CUSTOMER_PUBLIC',
      },
    })
    prisma.knowledgeNegativeExample.findUnique.mockResolvedValue(null)
    prisma.knowledgeNegativeExample.create.mockResolvedValue({
      id: 'neg_feedback_1',
    })

    const result = await service.recordSuggestionFeedback({
      conversationId: 'conv_1',
      candidateId: 'cand_approved_1',
      actorUserId: 9,
      outcome: 'discarded',
      suggestedText: 'Tu pedido ya salió.',
      finalText: 'Necesito verificarlo antes de confirmarte.',
    })

    expect(result).toMatchObject({
      id: 'feedback_1',
      outcome: 'discarded',
      candidateId: 'cand_approved_1',
      conversationId: 'conv_1',
    })
    expect(prisma.knowledgeNegativeExample.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        status: 'PENDING',
        sourceKind: 'DISCARDED_FEEDBACK',
        conversationId: 'conv_1',
        candidateId: 'cand_approved_1',
        feedbackId: 'feedback_1',
        title: 'Sugerencia descartada: Seguimiento de pedido',
        disallowedText: 'Tu pedido ya salió.',
        correctedText: 'Necesito verificarlo antes de confirmarte.',
        createdByUserId: 9,
      }),
    })
  })

  it('includes approved bundles and negative examples in the deterministic snapshot', async () => {
    const now = new Date('2026-03-27T23:30:00.000Z')
    prisma.knowledgeSnapshot.findFirst.mockResolvedValue(null)
    prisma.knowledgeDocument.findMany.mockResolvedValue([])
    prisma.knowledgeCandidate.findMany.mockResolvedValue([])
    prisma.knowledgeRawEvent.findMany.mockResolvedValue([])
    prisma.knowledgeConversationBundle.findMany.mockResolvedValue([
      {
        id: 'bundle_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        status: 'APPROVED',
        title: 'Bundle seguimiento',
        summary: 'Bundle multi-turno aprobado para seguimiento.',
        detectedIntents: ['order.status'],
        eventCount: 3,
        candidateCount: 1,
        approvedCount: 1,
        pendingCount: 0,
        previewQuestion: 'Necesito saber si ya salió mi pedido.',
        previewResponse: 'Necesito verificarlo antes de confirmarte.',
        metadata: null,
        reviewedAt: now,
        createdAt: now,
        updatedAt: now,
        conversationId: 'conv_1',
      },
    ])
    prisma.knowledgeNegativeExample.findMany.mockResolvedValue([
      {
        id: 'neg_approved_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        status: 'APPROVED',
        sourceKind: 'DISCARDED_FEEDBACK',
        title: 'No afirmar estados no verificados',
        summary: 'Evitar respuestas que confirmen el despacho sin chequeo.',
        detectedIntent: 'order.status',
        channel: 'WEBCHAT',
        disallowedText: 'Tu pedido ya salió.',
        correctedText: 'Necesito verificarlo antes de confirmarte.',
        metadata: null,
        reviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ])

    prisma.knowledgeSnapshot.create.mockImplementation(async ({ data }) => ({
      id: 'snap_bundle_neg_1',
      tenantKey: data.tenantKey,
      scope: data.scope,
      status: data.status,
      version: data.version,
      generationReason: data.generationReason,
      summaryText: null,
      metrics: data.metrics ?? null,
      coverageScore: data.coverageScore ?? null,
      metadata: data.metadata ?? null,
      generatedAt: data.generatedAt ?? now,
      createdAt: now,
      updatedAt: now,
      generatedByUser: null,
      entries: (data.entries?.create ?? []).map((entry: any, index: number) => ({
        id: `entry_snapshot_${index + 1}`,
        entryType: entry.entryType,
        key: entry.key,
        title: entry.title,
        plainText: entry.plainText,
        normalizedIntent: entry.normalizedIntent ?? null,
        topicKey: entry.topicKey ?? null,
        confidence: entry.confidence ?? null,
        priority: entry.priority ?? null,
        appliesToChannels: entry.appliesToChannels ?? [],
        metadata: entry.metadata ?? null,
        createdAt: now,
        updatedAt: now,
        sources: (entry.sources?.create ?? []).map((source: any, sourceIndex: number) => ({
          id: `source_snapshot_${index + 1}_${sourceIndex + 1}`,
          sourceKind: source.sourceKind,
          sourceId: source.sourceId,
          sourceVersion: source.sourceVersion ?? null,
          sourceStatus: source.sourceStatus ?? null,
          role: source.role,
          excerpt: source.excerpt ?? null,
          metadata: source.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        })),
      })),
    }))
    prisma.knowledgeSnapshot.update.mockImplementation(async ({ data }) => ({
      id: 'snap_bundle_neg_1',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      status: 'READY',
      version: 1,
      generationReason: 'initial_build',
      summaryText: data.summaryText ?? null,
      metrics: data.metrics ?? null,
      coverageScore: 1,
      metadata: {
        generatedWithoutLlm: true,
      },
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
      generatedByUser: null,
      entries: [
        {
          id: 'entry_bundle_1',
          entryType: 'TOPIC_SUMMARY',
          key: 'bundle:bundle_1',
          title: 'Bundle seguimiento',
          plainText: 'Bundle multi-turno aprobado para seguimiento.',
          normalizedIntent: 'order.status',
          topicKey: 'order.status',
          confidence: 0.75,
          priority: 'medium',
          appliesToChannels: ['webchat'],
          metadata: null,
          createdAt: now,
          updatedAt: now,
          sources: [
            {
              id: 'source_bundle_1',
              sourceKind: 'KNOWLEDGE_CONVERSATION_BUNDLE',
              sourceId: 'bundle_1',
              sourceVersion: null,
              sourceStatus: 'approved',
              role: 'SECONDARY_SUPPORT',
              excerpt: 'Necesito saber si ya salió mi pedido.',
              metadata: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
        {
          id: 'entry_neg_1',
          entryType: 'GUARDRAIL_NEGATIVE',
          key: 'negative-example:neg_approved_1',
          title: 'No afirmar estados no verificados',
          plainText: 'Evitar respuestas que confirmen el despacho sin chequeo.',
          normalizedIntent: 'order.status',
          topicKey: 'guardrails.order.status',
          confidence: 0.85,
          priority: 'high',
          appliesToChannels: ['webchat'],
          metadata: null,
          createdAt: now,
          updatedAt: now,
          sources: [
            {
              id: 'source_neg_1',
              sourceKind: 'KNOWLEDGE_NEGATIVE_EXAMPLE',
              sourceId: 'neg_approved_1',
              sourceVersion: null,
              sourceStatus: 'approved',
              role: 'GUARDRAIL',
              excerpt: 'Tu pedido ya salió.',
              metadata: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      ],
    }))

    const result = await service.getLatestSnapshot({
      tenantKey: 'urucortinas',
      scope: 'customer_public',
    })

    const createCall = prisma.knowledgeSnapshot.create.mock.calls[0]?.[0]
    expect(createCall?.data?.metrics).toMatchObject({
      approvedBundles: 1,
      approvedNegativeExamples: 1,
    })
    expect(createCall?.data?.entries?.create).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entryType: 'TOPIC_SUMMARY',
          key: 'bundle:bundle_1',
          sources: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                sourceKind: 'KNOWLEDGE_CONVERSATION_BUNDLE',
                sourceId: 'bundle_1',
              }),
            ]),
          }),
        }),
        expect.objectContaining({
          entryType: 'GUARDRAIL_NEGATIVE',
          key: 'negative:neg_approved_1',
          sources: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                sourceKind: 'KNOWLEDGE_NEGATIVE_EXAMPLE',
                sourceId: 'neg_approved_1',
              }),
            ]),
          }),
        }),
      ]),
    )
    expect(result.summaryText).toContain('Bundle seguimiento')
    expect(result.summaryText).toContain('Guardrails activos')
  })

  it('builds a diff against the previous snapshot version', async () => {
    const now = new Date('2026-03-27T22:00:00.000Z')
    prisma.knowledgeSnapshot.findUnique.mockResolvedValue({
      id: 'snap_current',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      status: 'READY',
      version: 3,
      generationReason: 'auto_refresh',
      summaryText: 'current',
      metrics: null,
      coverageScore: 0.8,
      metadata: null,
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
      generatedByUser: null,
      entries: [
        {
          id: 'entry_current_1',
          entryType: 'APPROVED_RULE',
          key: 'document:doc_1',
          title: 'Política de seguimiento',
          plainText: 'Pedir identificador y confirmar solo estados verificados.',
          normalizedIntent: 'order.status',
          topicKey: 'orders',
          confidence: null,
          priority: 'medium',
          appliesToChannels: ['webchat'],
          metadata: null,
          createdAt: now,
          updatedAt: now,
          sources: [
            {
              id: 'source_current_1',
              sourceKind: 'KNOWLEDGE_DOCUMENT',
              sourceId: 'doc_1',
              sourceVersion: null,
              sourceStatus: 'active',
              role: 'PRIMARY_SUPPORT',
              excerpt: 'Pedir identificador y confirmar solo estados verificados.',
              metadata: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
        {
          id: 'entry_current_2',
          entryType: 'KNOWN_GAP',
          key: 'gap:returns.policy',
          title: 'Vacío detectado: returns.policy',
          plainText: 'Hay observaciones recientes sobre devoluciones.',
          normalizedIntent: 'returns.policy',
          topicKey: 'returns',
          confidence: 0.7,
          priority: 'medium',
          appliesToChannels: ['webchat'],
          metadata: null,
          createdAt: now,
          updatedAt: now,
          sources: [],
        },
      ],
    })
    prisma.knowledgeSnapshot.findFirst.mockResolvedValue({
      id: 'snap_previous',
      tenantKey: 'urucortinas',
      scope: 'CUSTOMER_PUBLIC',
      status: 'READY',
      version: 2,
      generationReason: 'initial_build',
      summaryText: 'previous',
      metrics: null,
      coverageScore: 0.6,
      metadata: null,
      generatedAt: new Date('2026-03-26T22:00:00.000Z'),
      createdAt: now,
      updatedAt: now,
      generatedByUser: null,
      entries: [
        {
          id: 'entry_prev_1',
          entryType: 'APPROVED_RULE',
          key: 'document:doc_1',
          title: 'Política de seguimiento',
          plainText: 'Pedir identificador antes de confirmar estado.',
          normalizedIntent: 'order.status',
          topicKey: 'orders',
          confidence: null,
          priority: 'medium',
          appliesToChannels: ['webchat'],
          metadata: null,
          createdAt: now,
          updatedAt: now,
          sources: [
            {
              id: 'source_prev_1',
              sourceKind: 'KNOWLEDGE_DOCUMENT',
              sourceId: 'doc_1',
              sourceVersion: null,
              sourceStatus: 'active',
              role: 'PRIMARY_SUPPORT',
              excerpt: 'Pedir identificador antes de confirmar estado.',
              metadata: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
        {
          id: 'entry_prev_2',
          entryType: 'OPERATIONAL_NOTE',
          key: 'base:customer_public:natural_conversation',
          title: 'Conversación base con cliente',
          plainText: 'Base',
          normalizedIntent: null,
          topicKey: 'customer.base_conversation',
          confidence: null,
          priority: 'medium',
          appliesToChannels: ['webchat'],
          metadata: null,
          createdAt: now,
          updatedAt: now,
          sources: [],
        },
      ],
    })

    const result = await service.getSnapshotDiff('snap_current')

    expect(result.compareTo).toMatchObject({
      id: 'snap_previous',
      version: 2,
    })
    expect(result.summary).toMatchObject({
      added: 1,
      removed: 1,
      changed: 1,
    })
    expect(result.changed[0]).toMatchObject({
      key: 'document:doc_1',
      fields: expect.arrayContaining(['plainText', 'sources']),
    })
  })
})

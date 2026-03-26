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
    delete: vi.fn(),
  },
  knowledgeDocumentEmbedding: {
    upsert: vi.fn(),
  },
  knowledgeCandidate: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  conversationMessage: {
    findUnique: vi.fn(),
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
      body: 'Escribir a persona@example.com o llamar al +598 91 234 567',
      normalizedText: null,
      conversation: {
        id: 'conv_1',
        tenantKey: 'urucortinas',
        scope: 'CUSTOMER_PUBLIC',
        subject: 'Consulta comercial',
      },
    })

    prisma.knowledgeCandidate.create.mockImplementation(async ({ data }) => ({
      id: 'cand_1',
      status: data.status,
      piiDetected: data.piiDetected,
    }))

    const result = await service.createCandidateFromConversation(
      {
        conversationId: 'conv_1',
        messageId: 'msg_1',
      },
      7,
    )

    expect(result).toEqual({
      id: 'cand_1',
      status: 'pending',
      piiDetected: true,
    })
    expect(prisma.knowledgeCandidate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          excerpt: 'Escribir a persona@example.com o llamar al +598 91 234 567',
          redactedExcerpt:
            'Escribir a [redacted-email] o llamar al [redacted-phone]',
          piiDetected: true,
          createdByUserId: 7,
        }),
      }),
    )
  })

  it('filters managed source documents explicitly when requested', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([])

    await service.listDocuments({
      sourceFileOnly: 'true',
    })

    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantKey: 'urucortinas',
          sourceFilePath: { not: null },
        }),
        take: 250,
      }),
    )
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
})

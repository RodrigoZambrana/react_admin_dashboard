import { Injectable, NotFoundException } from '@nestjs/common'
import {
  KnowledgeCandidateStatus,
  KnowledgeDocumentScope,
  KnowledgeDocumentStatus,
  KnowledgeSourceType,
  Prisma,
} from '@prisma/client'
import fs from 'fs/promises'
import * as path from 'path'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { KnowledgeEmbeddingsService } from './knowledge-embeddings.service'
import {
  deleteKnowledgeSourceFile,
  persistKnowledgeSourceFile,
  readKnowledgeSourceFile,
} from '../common/uploads/knowledge'
import {
  getTenantKnowledgeSources,
  type TenantKnowledgeSource,
} from './tenant-knowledge-sources'
import { ListKnowledgeDocumentsDto } from './dto/list-knowledge-documents.dto'
import { ListKnowledgeCandidatesDto } from './dto/list-knowledge-candidates.dto'
import { CreateCuratedKnowledgeDto } from './dto/create-curated-knowledge.dto'
import { CreateKnowledgeCandidateDto } from './dto/create-knowledge-candidate.dto'
import { ReviewKnowledgeCandidateDto } from './dto/review-knowledge-candidate.dto'
import { RetrieveKnowledgeDto } from './dto/retrieve-knowledge.dto'
import { IndexKnowledgeDocumentsDto } from './dto/index-knowledge-documents.dto'

const DOC_SOURCES = [
  'product.md',
  'architecture.md',
  'decisions.md',
  'storefront.md',
  'notifications.md',
  'ai-knowledge-base-plan.md',
]

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly embeddings: KnowledgeEmbeddingsService,
  ) {}

  async getOverview(tenantKey?: string) {
    const resolvedTenantKey = this.resolveTenantKey(tenantKey)
    const [documentCounts, candidateCounts] = await Promise.all([
      this.prisma.knowledgeDocument.groupBy({
        by: ['status', 'sourceType', 'scope'],
        where: { tenantKey: resolvedTenantKey },
        _count: { _all: true },
      }),
      this.prisma.knowledgeCandidate.groupBy({
        by: ['status', 'scope'],
        where: { tenantKey: resolvedTenantKey },
        _count: { _all: true },
      }),
    ])

    return {
      tenantKey: resolvedTenantKey,
      documents: documentCounts.map((entry) => ({
        status: this.normalizeEnum(entry.status),
        sourceType: this.normalizeEnum(entry.sourceType),
        scope: this.normalizeEnum(entry.scope),
        count: entry._count._all,
      })),
      candidates: candidateCounts.map((entry) => ({
        status: this.normalizeEnum(entry.status),
        scope: this.normalizeEnum(entry.scope),
        count: entry._count._all,
      })),
    }
  }

  async listDocuments(query: ListKnowledgeDocumentsDto) {
    const tenantKey = this.resolveTenantKey(query.tenantKey)
    const where: Prisma.KnowledgeDocumentWhereInput = {
      tenantKey,
    }

    if (query.scope) {
      where.scope = this.mapScope(query.scope)
    }
    if (query.sourceType) {
      where.sourceType = this.mapSourceType(query.sourceType)
    }
    if (query.status) {
      where.status = this.mapDocumentStatus(query.status)
    }
    if (query.search?.trim()) {
      const search = query.search.trim()
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (query.sourceFileOnly === 'true') {
      where.sourceFilePath = { not: null }
    }

    const items = await this.prisma.knowledgeDocument.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.sourceFileOnly === 'true' ? 250 : 100,
      include: {
        embedding: {
          select: {
            provider: true,
            model: true,
            dimensions: true,
            updatedAt: true,
          },
        },
      },
    })

    return items.map((item) => this.mapDocument(item))
  }

  async listCandidates(query: ListKnowledgeCandidatesDto) {
    const tenantKey = this.resolveTenantKey(query.tenantKey)
    const where: Prisma.KnowledgeCandidateWhereInput = {
      tenantKey,
    }

    if (query.scope) {
      where.scope = this.mapScope(query.scope)
    }
    if (query.status) {
      where.status = this.mapCandidateStatus(query.status)
    }

    const items = await this.prisma.knowledgeCandidate.findMany({
      where,
      include: {
        conversation: {
          select: {
            id: true,
            subject: true,
            channel: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    })

    return items.map((item) => ({
      id: item.id,
      tenantKey: item.tenantKey,
      scope: this.normalizeEnum(item.scope),
      status: this.normalizeEnum(item.status),
      sourceType: this.normalizeEnum(item.sourceType),
      title: item.title,
      summary: item.summary ?? null,
      excerpt: item.excerpt,
      redactedExcerpt: item.redactedExcerpt ?? null,
      piiDetected: item.piiDetected,
      metadata: item.metadata ?? null,
      conversation: item.conversation
        ? {
            id: item.conversation.id,
            subject: item.conversation.subject ?? null,
            channel: this.normalizeEnum(item.conversation.channel),
          }
        : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))
  }

  async retrieve(query: RetrieveKnowledgeDto) {
    const tenantKey = this.resolveTenantKey(query.tenantKey)
    const search = query.query.trim()
    const limit = Math.min(Math.max(query.limit ?? 5, 1), 10)
    const scopes =
      query.scope?.trim() === 'customer_public'
        ? [KnowledgeDocumentScope.CUSTOMER_PUBLIC]
        : [KnowledgeDocumentScope.ADMIN_INTERNAL, KnowledgeDocumentScope.CUSTOMER_PUBLIC]

    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        tenantKey,
        status: KnowledgeDocumentStatus.ACTIVE,
        approvedAt: { not: null },
        scope: { in: scopes },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 2000,
      include: {
        embedding: {
          select: {
            provider: true,
            model: true,
            dimensions: true,
            vector: true,
            updatedAt: true,
          },
        },
      },
    })

    const queryVector = this.embeddings.projectQuery(search)
    const ranked = documents
      .map((document) => ({
        document,
        lexicalScore: this.scoreDocument(document, search),
        vectorScore: document.embedding?.vector
          ? this.embeddings.cosineSimilarity(
              queryVector,
              document.embedding.vector as number[],
            )
          : 0,
      }))
      .map((entry) => ({
        ...entry,
        score:
          entry.lexicalScore +
          entry.vectorScore * 8 +
          (entry.lexicalScore > 0 &&
          (entry.document.sourceType === KnowledgeSourceType.DOCS ||
            entry.document.sourceType === KnowledgeSourceType.ADMIN_CURATED)
            ? 2
            : 0),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (left.score !== right.score) {
          return right.score - left.score
        }
        return right.document.updatedAt.getTime() - left.document.updatedAt.getTime()
      })
      .slice(0, limit)

    return {
      tenantKey,
      query: search,
      scope:
        query.scope?.trim() === 'customer_public'
          ? 'customer_public'
          : 'admin_internal',
      items: ranked.map(({ document, score, lexicalScore, vectorScore }) => ({
        id: document.id,
        title: document.title,
        scope: this.normalizeEnum(document.scope),
        sourceType: this.normalizeEnum(document.sourceType),
        summary: document.summary ?? null,
        snippet: this.buildSnippet(document.content, search),
        tags: document.tags ?? [],
        score,
        lexicalScore,
        vectorScore,
        embedding:
          document.embedding != null
            ? {
                provider: document.embedding.provider,
                model: document.embedding.model,
                dimensions: document.embedding.dimensions,
                indexedAt: document.embedding.updatedAt,
              }
            : null,
        updatedAt: document.updatedAt,
      })),
    }
  }

  async createCuratedDocument(input: CreateCuratedKnowledgeDto, actorUserId: number) {
    const tenantKey = this.resolveTenantKey(input.tenantKey)
    const title = input.title.trim()
    const sourceKey = `curated:${this.slugify(title)}:${Date.now()}`

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        tenantKey,
        scope: this.mapScope(input.scope),
        sourceType: KnowledgeSourceType.ADMIN_CURATED,
        status: KnowledgeDocumentStatus.ACTIVE,
        sourceKey,
        title,
        summary: input.summary?.trim() || null,
        content: input.content.trim(),
        tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
        metadata: this.toJsonValue(input.metadata ?? { source: 'admin-ui' }),
        piiRiskLevel: 'low',
        authoredByUserId: actorUserId,
        approvedByUserId: actorUserId,
        approvedAt: new Date(),
      },
    })

    await this.embeddings.indexDocument(document)
    return this.getDocumentById(document.id)
  }

  async uploadSourceDocument(
    input: {
      tenantKey?: string
      scope: 'customer_public' | 'admin_internal'
      title?: string
      summary?: string
      tags?: string[]
      replaceDocumentId?: string
    },
    file: import('@fastify/multipart').MultipartFile,
    actorUserId: number,
  ) {
    const tenantKey = this.resolveTenantKey(input.tenantKey)
    const replaceDocument = (input.replaceDocumentId
      ? await this.prisma.knowledgeDocument.findUnique({
          where: { id: input.replaceDocumentId },
        })
      : null) as
      | {
          id: string
          title: string
          sourceKey: string
          sourceFilePath: string | null
        }
      | null

    const persisted = await persistKnowledgeSourceFile(
      file,
      replaceDocument?.sourceFilePath ?? null,
    )

    const title =
      input.title?.trim() ||
      replaceDocument?.title ||
      persisted.name.replace(/\.[^.]+$/, '')
    const summary = input.summary?.trim() || this.extractSummary(persisted.content)
    const sourceKey =
      replaceDocument?.sourceKey ||
      `uploaded:${this.slugify(title)}:${Date.now()}`

    const document = await this.upsertKnowledgeDocument({
      tenantKey,
      scope: this.mapScope(input.scope),
      sourceType: KnowledgeSourceType.DOCS,
      sourceKey,
      title,
      summary,
      content: persisted.content,
      tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      piiRiskLevel: 'low',
      metadata: {
        source: 'uploaded-document',
        originalFileName: persisted.name,
      },
      sourceFileName: persisted.name,
      sourceFilePath: persisted.path,
      sourceFileMime: persisted.mime,
      sourceFileSize: persisted.size,
      actorUserId,
    })

    return this.getDocumentById(document.id)
  }

  async deleteDocument(id: string) {
    const document = (await this.prisma.knowledgeDocument.findUnique({
      where: { id },
    })) as { id: string; sourceFilePath: string | null } | null

    if (!document) {
      throw new NotFoundException('knowledge.documentNotFound')
    }

    await deleteKnowledgeSourceFile(document.sourceFilePath)
    await this.prisma.knowledgeDocument.delete({
      where: { id },
    })

    return {
      id,
      deleted: true,
    }
  }

  async getDocumentSourceFile(id: string) {
    const document = (await this.prisma.knowledgeDocument.findUnique({
      where: { id },
    })) as
      | {
          sourceFileName: string | null
          sourceFilePath: string | null
          sourceFileMime: string | null
        }
      | null

    if (!document?.sourceFileName || !document.sourceFilePath) {
      throw new NotFoundException('knowledge.documentSourceNotFound')
    }

    const buffer = await readKnowledgeSourceFile(document.sourceFilePath)
    return {
      fileName: document.sourceFileName,
      mimeType: document.sourceFileMime || 'application/octet-stream',
      buffer,
    }
  }

  async ingestTrustedDocs(actorUserId: number, tenantKey?: string) {
    const resolvedTenantKey = this.resolveTenantKey(tenantKey)
    const results: ReturnType<KnowledgeService['mapDocument']>[] = []
    const docsDir = await this.resolveDocsDir()

    if (docsDir) {
      for (const fileName of DOC_SOURCES) {
        const filePath = path.join(docsDir, fileName)
        try {
          const content = await fs.readFile(filePath, 'utf8')
          const title = this.extractMarkdownTitle(content) ?? fileName
          const summary = this.extractSummary(content)
          const sourceKey = `docs:${fileName}`

          const document = await this.upsertKnowledgeDocument({
            tenantKey: resolvedTenantKey,
            scope: KnowledgeDocumentScope.ADMIN_INTERNAL,
            sourceType: KnowledgeSourceType.DOCS,
            sourceKey,
            title,
            summary,
            content,
            tags: ['docs', 'internal'],
            piiRiskLevel: 'low',
            metadata: {
              filePath: `docs/${fileName}`,
              source: 'docs-ingestion',
            },
            actorUserId,
          })

          results.push(await this.getDocumentById(document.id))
        } catch {
          continue
        }
      }
    }

    for (const source of getTenantKnowledgeSources(resolvedTenantKey)) {
      try {
        const document =
          source.kind === 'repo_markdown'
            ? await this.ingestTenantRepoSource(
                source,
                docsDir,
                resolvedTenantKey,
                actorUserId,
              )
            : await this.ingestTenantWebSource(
                source,
                resolvedTenantKey,
                actorUserId,
              )

        if (document) {
          results.push(await this.getDocumentById(document.id))
        }
      } catch {
        continue
      }
    }

    return {
      tenantKey: resolvedTenantKey,
      ingested: results.length,
      items: results,
    }
  }

  async ingestDatasets(actorUserId: number, tenantKey?: string) {
    const resolvedTenantKey = this.resolveTenantKey(tenantKey)
    const [products, customers] = await Promise.all([
      this.prisma.product.findMany({
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 250,
      }),
      this.prisma.customer.findMany({
        include: {
          status: {
            select: {
              id: true,
              name: true,
            },
          },
          orders: {
            select: {
              id: true,
              uuid: true,
              date: true,
              documentType: true,
              grandTotal: true,
              orderCurrency: true,
            },
            orderBy: { date: 'desc' },
            take: 5,
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 250,
      }),
    ])

    const ingestedDocuments: ReturnType<KnowledgeService['mapDocument']>[] = []

    for (const product of products) {
      const publishedSummary = [
        `Producto: ${product.name}`,
        product.productCode ? `Código: ${product.productCode}` : null,
        product.category?.name ? `Categoría: ${product.category.name}` : null,
        `Modo: ${product.mode}`,
        `Tipo: ${product.productType}`,
        `Moneda: ${product.currency}`,
        `Precio de venta: ${Number(product.salePrice).toFixed(2)}`,
        product.description ? `Descripción: ${product.description}` : null,
      ]
        .filter(Boolean)
        .join('\n')

      const publicDocument = await this.prisma.knowledgeDocument.upsert({
        where: {
          tenantKey_scope_sourceType_sourceKey: {
            tenantKey: resolvedTenantKey,
            scope: KnowledgeDocumentScope.CUSTOMER_PUBLIC,
            sourceType: KnowledgeSourceType.BACKEND_DATASET,
            sourceKey: `product-public:${product.id}`,
          },
        },
        update: {
          title: product.name,
          summary: product.category?.name ?? null,
          content: publishedSummary,
          tags: ['product', product.mode.toLowerCase()],
          metadata: this.toJsonValue({
            productId: product.id,
            productCode: product.productCode ?? null,
            published: product.published,
          }),
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
        },
        create: {
          tenantKey: resolvedTenantKey,
          scope: KnowledgeDocumentScope.CUSTOMER_PUBLIC,
          sourceType: KnowledgeSourceType.BACKEND_DATASET,
          status: KnowledgeDocumentStatus.ACTIVE,
          sourceKey: `product-public:${product.id}`,
          title: product.name,
          summary: product.category?.name ?? null,
          content: publishedSummary,
          tags: ['product', product.mode.toLowerCase()],
          piiRiskLevel: 'low',
          metadata: this.toJsonValue({
            productId: product.id,
            productCode: product.productCode ?? null,
            published: product.published,
          }),
          authoredByUserId: actorUserId,
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
        },
      })

      await this.embeddings.indexDocument(publicDocument)
      ingestedDocuments.push(await this.getDocumentById(publicDocument.id))

      const internalSummary = [
        publishedSummary,
        `Costo: ${Number(product.costPrice).toFixed(2)}`,
        `Stock: ${product.stock}`,
      ].join('\n')

      const internalDocument = await this.prisma.knowledgeDocument.upsert({
        where: {
          tenantKey_scope_sourceType_sourceKey: {
            tenantKey: resolvedTenantKey,
            scope: KnowledgeDocumentScope.ADMIN_INTERNAL,
            sourceType: KnowledgeSourceType.BACKEND_DATASET,
            sourceKey: `product-admin:${product.id}`,
          },
        },
        update: {
          title: `${product.name} (interno)`,
          summary: product.category?.name ?? null,
          content: internalSummary,
          tags: ['product', 'internal', product.mode.toLowerCase()],
          metadata: this.toJsonValue({
            productId: product.id,
            productCode: product.productCode ?? null,
            published: product.published,
          }),
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
        },
        create: {
          tenantKey: resolvedTenantKey,
          scope: KnowledgeDocumentScope.ADMIN_INTERNAL,
          sourceType: KnowledgeSourceType.BACKEND_DATASET,
          status: KnowledgeDocumentStatus.ACTIVE,
          sourceKey: `product-admin:${product.id}`,
          title: `${product.name} (interno)`,
          summary: product.category?.name ?? null,
          content: internalSummary,
          tags: ['product', 'internal', product.mode.toLowerCase()],
          piiRiskLevel: 'low',
          metadata: this.toJsonValue({
            productId: product.id,
            productCode: product.productCode ?? null,
            published: product.published,
          }),
          authoredByUserId: actorUserId,
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
        },
      })

      await this.embeddings.indexDocument(internalDocument)
      ingestedDocuments.push(await this.getDocumentById(internalDocument.id))
    }

    for (const customer of customers) {
      const customerContent = [
        `Cliente: ${customer.name}`,
        customer.status?.name ? `Estado: ${customer.status.name}` : null,
        `Locale preferido: ${customer.preferredLocale}`,
        `Pedidos registrados: ${customer.orders.length}`,
        customer.orders[0]
          ? `Último pedido: ${customer.orders[0].uuid} · ${customer.orders[0].orderCurrency} ${Number(
              customer.orders[0].grandTotal,
            ).toFixed(2)}`
          : null,
        `Tiene email: ${customer.email ? 'sí' : 'no'}`,
        `Tiene teléfono: ${customer.phoneNumber ? 'sí' : 'no'}`,
      ]
        .filter(Boolean)
        .join('\n')

      const document = await this.prisma.knowledgeDocument.upsert({
        where: {
          tenantKey_scope_sourceType_sourceKey: {
            tenantKey: resolvedTenantKey,
            scope: KnowledgeDocumentScope.ADMIN_INTERNAL,
            sourceType: KnowledgeSourceType.BACKEND_DATASET,
            sourceKey: `customer:${customer.id}`,
          },
        },
        update: {
          title: `Cliente ${customer.name}`,
          summary: customer.status?.name ?? null,
          content: customerContent,
          tags: ['customer', customer.preferredLocale],
          piiRiskLevel: 'medium',
          metadata: this.toJsonValue({
            customerId: customer.id,
            hasEmail: Boolean(customer.email),
            hasPhone: Boolean(customer.phoneNumber),
            orders: customer.orders.map((order) => ({
              id: order.id,
              uuid: order.uuid,
              currency: order.orderCurrency,
            })),
          }),
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
        },
        create: {
          tenantKey: resolvedTenantKey,
          scope: KnowledgeDocumentScope.ADMIN_INTERNAL,
          sourceType: KnowledgeSourceType.BACKEND_DATASET,
          status: KnowledgeDocumentStatus.ACTIVE,
          sourceKey: `customer:${customer.id}`,
          title: `Cliente ${customer.name}`,
          summary: customer.status?.name ?? null,
          content: customerContent,
          tags: ['customer', customer.preferredLocale],
          piiRiskLevel: 'medium',
          metadata: this.toJsonValue({
            customerId: customer.id,
            hasEmail: Boolean(customer.email),
            hasPhone: Boolean(customer.phoneNumber),
            orders: customer.orders.map((order) => ({
              id: order.id,
              uuid: order.uuid,
              currency: order.orderCurrency,
            })),
          }),
          authoredByUserId: actorUserId,
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
        },
      })

      await this.embeddings.indexDocument(document)
      ingestedDocuments.push(await this.getDocumentById(document.id))
    }

    return {
      tenantKey: resolvedTenantKey,
      ingested: ingestedDocuments.length,
      items: ingestedDocuments,
    }
  }

  async createCandidateFromConversation(
    input: CreateKnowledgeCandidateDto,
    actorUserId: number,
  ) {
    const tenantKey = this.resolveTenantKey(input.tenantKey)
    const message = await this.prisma.conversationMessage.findUnique({
      where: { id: input.messageId },
      include: {
        conversation: {
          select: {
            id: true,
            tenantKey: true,
            scope: true,
            subject: true,
          },
        },
      },
    })

    if (!message || message.conversationId !== input.conversationId) {
      throw new NotFoundException('knowledge.messageNotFound')
    }

    const excerpt = message.body ?? message.normalizedText ?? ''
    const redactedExcerpt = this.redactSensitiveText(excerpt)
    const piiDetected = redactedExcerpt !== excerpt

    const candidate = await this.prisma.knowledgeCandidate.create({
      data: {
        tenantKey: tenantKey || message.conversation.tenantKey,
        scope:
          message.conversation.scope === 'ADMIN_INTERNAL'
            ? KnowledgeDocumentScope.ADMIN_INTERNAL
            : KnowledgeDocumentScope.CUSTOMER_PUBLIC,
        sourceType: KnowledgeSourceType.CONVERSATION_DERIVED,
        status: KnowledgeCandidateStatus.PENDING,
        title:
          input.title?.trim() ||
          message.conversation.subject ||
          'Candidate from conversation',
        summary: input.summary?.trim() || null,
        excerpt,
        redactedExcerpt,
        piiDetected,
        metadata: this.toJsonValue({
          conversationId: message.conversationId,
          source: 'conversation-review',
        }),
        conversationId: message.conversationId,
        messageId: message.id,
        createdByUserId: actorUserId,
      },
    })

    return {
      id: candidate.id,
      status: this.normalizeEnum(candidate.status),
      piiDetected: candidate.piiDetected,
    }
  }

  async reviewCandidate(
    id: string,
    input: ReviewKnowledgeCandidateDto,
    actorUserId: number,
  ) {
    const candidate = await this.prisma.knowledgeCandidate.findUnique({
      where: { id },
    })

    if (!candidate) {
      throw new NotFoundException('knowledge.candidateNotFound')
    }

    const approved = input.action === 'approve'
    const status = approved
      ? KnowledgeCandidateStatus.APPROVED
      : KnowledgeCandidateStatus.REJECTED

    const updatedCandidate = await this.prisma.knowledgeCandidate.update({
      where: { id },
      data: {
        status,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
    })

    let promotedDocument: ReturnType<KnowledgeService['mapDocument']> | null =
      null
    if (approved && input.promoteToDocument) {
      const createdDocument = await this.prisma.knowledgeDocument.create({
        data: {
          tenantKey: candidate.tenantKey,
          scope: input.scope
            ? this.mapScope(input.scope)
            : candidate.scope,
          sourceType: KnowledgeSourceType.CONVERSATION_DERIVED,
          status: KnowledgeDocumentStatus.ACTIVE,
          sourceKey: `candidate:${candidate.id}`,
          title: input.title?.trim() || candidate.title,
          summary: input.summary?.trim() || candidate.summary || null,
          content:
            input.content?.trim() ||
            candidate.redactedExcerpt ||
            candidate.excerpt,
          tags: ['conversation-derived'],
          piiRiskLevel: candidate.piiDetected ? 'medium' : 'low',
          metadata: this.toJsonValue({
            candidateId: candidate.id,
            source: 'candidate-review',
          }),
          authoredByUserId: candidate.createdByUserId ?? actorUserId,
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
        },
      })
      await this.embeddings.indexDocument(createdDocument)
      promotedDocument = await this.getDocumentById(createdDocument.id)
    }

    return {
      candidate: {
        id: updatedCandidate.id,
        status: this.normalizeEnum(updatedCandidate.status),
      },
      promotedDocument,
    }
  }

  async indexDocuments(input: IndexKnowledgeDocumentsDto, _actorUserId: number) {
    const tenantKey = this.resolveTenantKey(input.tenantKey)
    const where: Prisma.KnowledgeDocumentWhereInput = {
      tenantKey,
      status: KnowledgeDocumentStatus.ACTIVE,
      approvedAt: { not: null },
    }

    if (input.scope === 'customer_public' || input.scope === 'admin_internal') {
      where.scope = this.mapScope(input.scope)
    }

    if (input.documentIds?.length) {
      where.id = { in: input.documentIds }
    }

    const documents = await this.prisma.knowledgeDocument.findMany({
      where,
      select: {
        id: true,
        title: true,
        summary: true,
        content: true,
        tags: true,
      },
      take: 500,
    })

    const result = await this.embeddings.indexDocuments(documents)

    return {
      tenantKey,
      indexed: result.indexed,
      documentIds: documents.map((document) => document.id),
    }
  }

  private mapDocument(document: {
    id: string
    tenantKey: string
    scope: KnowledgeDocumentScope
    sourceType: KnowledgeSourceType
    status: KnowledgeDocumentStatus
    sourceKey: string
    title: string
    summary: string | null
    content: string
    sourceFileName?: string | null
    sourceFilePath?: string | null
    sourceFileMime?: string | null
    sourceFileSize?: number | null
    tags: string[]
    piiRiskLevel: string | null
    metadata: Prisma.JsonValue | null
    approvedAt: Date | null
    createdAt: Date
    updatedAt: Date
    embedding?: {
      provider: string
      model: string
      dimensions: number
      updatedAt: Date
    } | null
  }) {
    return {
      id: document.id,
      tenantKey: document.tenantKey,
      scope: this.normalizeEnum(document.scope),
      sourceType: this.normalizeEnum(document.sourceType),
      status: this.normalizeEnum(document.status),
      sourceKey: document.sourceKey,
      title: document.title,
      summary: document.summary ?? null,
      content: document.content,
      sourceFile:
        document.sourceFileName && document.sourceFilePath
          ? {
              name: document.sourceFileName,
              mimeType: document.sourceFileMime ?? 'application/octet-stream',
              size: document.sourceFileSize ?? 0,
              downloadUrl: `/api/ai/knowledge/documents/${document.id}/file`,
            }
          : null,
      tags: document.tags,
      piiRiskLevel: document.piiRiskLevel ?? 'low',
      metadata: document.metadata ?? null,
      approvedAt: document.approvedAt,
      embedding:
        document.embedding != null
          ? {
              provider: document.embedding.provider,
              model: document.embedding.model,
              dimensions: document.embedding.dimensions,
              indexedAt: document.embedding.updatedAt,
            }
          : null,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    }
  }

  private async getDocumentById(id: string) {
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      include: {
        embedding: {
          select: {
            provider: true,
            model: true,
            dimensions: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!document) {
      throw new NotFoundException('knowledge.documentNotFound')
    }

    return this.mapDocument(document)
  }

  private resolveTenantKey(tenantKey?: string | null) {
    return tenantKey?.trim() || this.config.get<string>('CLIENT_SLUG') || 'default'
  }

  private mapScope(scope: 'customer_public' | 'admin_internal') {
    return scope === 'admin_internal'
      ? KnowledgeDocumentScope.ADMIN_INTERNAL
      : KnowledgeDocumentScope.CUSTOMER_PUBLIC
  }

  private mapSourceType(sourceType: ListKnowledgeDocumentsDto['sourceType']) {
    switch (sourceType) {
      case 'docs':
        return KnowledgeSourceType.DOCS
      case 'backend_dataset':
        return KnowledgeSourceType.BACKEND_DATASET
      case 'admin_curated':
        return KnowledgeSourceType.ADMIN_CURATED
      default:
        return KnowledgeSourceType.CONVERSATION_DERIVED
    }
  }

  private mapDocumentStatus(status: ListKnowledgeDocumentsDto['status']) {
    switch (status) {
      case 'draft':
        return KnowledgeDocumentStatus.DRAFT
      case 'archived':
        return KnowledgeDocumentStatus.ARCHIVED
      default:
        return KnowledgeDocumentStatus.ACTIVE
    }
  }

  private mapCandidateStatus(status: ListKnowledgeCandidatesDto['status']) {
    switch (status) {
      case 'approved':
        return KnowledgeCandidateStatus.APPROVED
      case 'rejected':
        return KnowledgeCandidateStatus.REJECTED
      default:
        return KnowledgeCandidateStatus.PENDING
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

  private scoreDocument(
    document: {
      title: string
      summary: string | null
      content: string
      tags: string[]
    },
    search: string,
  ) {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) {
      return 0
    }

    let score = 0
    const title = document.title.toLowerCase()
    const summary = (document.summary ?? '').toLowerCase()
    const content = document.content.toLowerCase()
    const tags = (document.tags ?? []).map((tag) => tag.toLowerCase())

    if (title.includes(normalizedSearch)) score += 10
    if (summary.includes(normalizedSearch)) score += 6
    if (tags.some((tag) => tag.includes(normalizedSearch))) score += 4
    if (content.includes(normalizedSearch)) score += 3

    const searchTokens = normalizedSearch.split(/\s+/).filter(Boolean)
    for (const token of searchTokens) {
      if (token.length < 2) continue
      if (title.includes(token)) score += 2
      if (summary.includes(token)) score += 1
      if (tags.some((tag) => tag.includes(token))) score += 1
      if (content.includes(token)) score += 0.5
    }

    return score
  }

  private buildSnippet(content: string, search: string) {
    const normalizedContent = content.trim()
    if (!normalizedContent) {
      return ''
    }

    const normalizedSearch = search.trim().toLowerCase()
    const normalizedBody = normalizedContent.toLowerCase()
    let index = normalizedBody.indexOf(normalizedSearch)

    if (index < 0) {
      const stopwords = new Set([
        'sobre',
        'desde',
        'segun',
        'según',
        'cargado',
        'quiero',
        'necesito',
        'podrias',
        'podrías',
        'resumime',
        'resumen',
        'principales',
        'informe',
        'datos',
      ])

      const candidateToken = normalizedSearch
        .split(/[^a-z0-9áéíóúüñ]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4 && !stopwords.has(token))
        .sort((left, right) => right.length - left.length)
        .find((token) => normalizedBody.includes(token))

      if (candidateToken) {
        index = normalizedBody.indexOf(candidateToken)
      }
    }

    if (index < 0) {
      return normalizedContent.slice(0, 420)
    }

    const start = Math.max(index - 180, 0)
    const end = Math.min(index + 540, normalizedContent.length)
    return normalizedContent.slice(start, end)
  }

  private slugify(input: string) {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  private extractMarkdownTitle(content: string) {
    const firstHeading = content.match(/^#\s+(.+)$/m)
    return firstHeading?.[1]?.trim() ?? null
  }

  private extractSummary(content: string) {
    const firstParagraph = content
      .split('\n\n')
      .map((segment) => segment.replace(/^#+\s+/gm, '').trim())
      .find((segment) => segment.length > 40)

    return firstParagraph ? firstParagraph.slice(0, 320) : null
  }

  private redactSensitiveText(input: string) {
    return input
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
      .replace(/\+?\d[\d\s-]{6,}\d/g, '[redacted-phone]')
  }

  private async ingestTenantRepoSource(
    source: Extract<TenantKnowledgeSource, { kind: 'repo_markdown' }>,
    docsDir: string | null,
    tenantKey: string,
    actorUserId: number,
  ) {
    if (!docsDir) {
      return null
    }

    const filePath = path.join(docsDir, source.pathWithinDocs)
    const content = await fs.readFile(filePath, 'utf8')
    const title = source.title || this.extractMarkdownTitle(content) || source.pathWithinDocs
    const summary = this.extractSummary(content)

    return this.upsertKnowledgeDocument({
      tenantKey,
      scope: this.mapScope(source.scope),
      sourceType: KnowledgeSourceType.DOCS,
      sourceKey: source.sourceKey,
      title,
      summary,
      content,
      tags: source.tags ?? [],
      piiRiskLevel: 'low',
      metadata: {
        filePath: `docs/${source.pathWithinDocs}`,
        source: 'tenant-docs-ingestion',
        ...(source.metadata ?? {}),
      },
      actorUserId,
    })
  }

  private async ingestTenantWebSource(
    source: Extract<TenantKnowledgeSource, { kind: 'web_page' }>,
    tenantKey: string,
    actorUserId: number,
  ) {
    const response = await fetch(source.url)
    if (!response.ok) {
      throw new Error(`knowledge.webFetchFailed:${response.status}`)
    }

    const html = await response.text()
    const content = this.extractReadableHtml(html)
    const title = source.title || this.extractHtmlTitle(html) || source.url
    const summary =
      this.extractHtmlDescription(html) ||
      this.extractSummary(content) ||
      source.title ||
      null

    return this.upsertKnowledgeDocument({
      tenantKey,
      scope: this.mapScope(source.scope),
      sourceType: KnowledgeSourceType.DOCS,
      sourceKey: source.sourceKey,
      title,
      summary,
      content,
      tags: source.tags ?? [],
      piiRiskLevel: 'low',
      metadata: {
        url: source.url,
        source: 'tenant-web-ingestion',
        ...(source.metadata ?? {}),
      },
      actorUserId,
    })
  }

  private async upsertKnowledgeDocument(input: {
    tenantKey: string
    scope: KnowledgeDocumentScope
    sourceType: KnowledgeSourceType
    sourceKey: string
    title: string
    summary: string | null
    content: string
    tags: string[]
    piiRiskLevel: string
    metadata: Record<string, unknown>
    sourceFileName?: string | null
    sourceFilePath?: string | null
    sourceFileMime?: string | null
    sourceFileSize?: number | null
    actorUserId: number
  }) {
    const document = await this.prisma.knowledgeDocument.upsert({
      where: {
        tenantKey_scope_sourceType_sourceKey: {
          tenantKey: input.tenantKey,
          scope: input.scope,
          sourceType: input.sourceType,
          sourceKey: input.sourceKey,
        },
      },
      update: {
        title: input.title,
        summary: input.summary,
        content: input.content,
        status: KnowledgeDocumentStatus.ACTIVE,
        tags: input.tags,
        piiRiskLevel: input.piiRiskLevel,
        sourceFileName: input.sourceFileName ?? null,
        sourceFilePath: input.sourceFilePath ?? null,
        sourceFileMime: input.sourceFileMime ?? null,
        sourceFileSize: input.sourceFileSize ?? null,
        metadata: this.toJsonValue(input.metadata),
        approvedByUserId: input.actorUserId,
        approvedAt: new Date(),
      } as any,
      create: {
        tenantKey: input.tenantKey,
        scope: input.scope,
        sourceType: input.sourceType,
        status: KnowledgeDocumentStatus.ACTIVE,
        sourceKey: input.sourceKey,
        title: input.title,
        summary: input.summary,
        content: input.content,
        tags: input.tags,
        piiRiskLevel: input.piiRiskLevel,
        sourceFileName: input.sourceFileName ?? null,
        sourceFilePath: input.sourceFilePath ?? null,
        sourceFileMime: input.sourceFileMime ?? null,
        sourceFileSize: input.sourceFileSize ?? null,
        metadata: this.toJsonValue(input.metadata),
        authoredByUserId: input.actorUserId,
        approvedByUserId: input.actorUserId,
        approvedAt: new Date(),
      } as any,
    })

    await this.embeddings.indexDocument(document)
    return document
  }

  private extractHtmlTitle(html: string) {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    return match?.[1]?.replace(/\s+/g, ' ').trim() ?? null
  }

  private extractHtmlDescription(html: string) {
    const match = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
    )
    return match?.[1]?.replace(/\s+/g, ' ').trim() ?? null
  }

  private extractReadableHtml(html: string) {
    const withoutScripts = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<\/(p|div|section|article|header|footer|aside|h1|h2|h3|h4|h5|h6|li|ul|ol|br|tr)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, ' ')

    const decoded = withoutScripts
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&aacute;/gi, 'á')
      .replace(/&eacute;/gi, 'é')
      .replace(/&iacute;/gi, 'í')
      .replace(/&oacute;/gi, 'ó')
      .replace(/&uacute;/gi, 'ú')
      .replace(/&ntilde;/gi, 'ñ')

    return decoded
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length >= 3)
      .join('\n')
      .slice(0, 24000)
  }

  private async resolveDocsDir() {
    const configuredPath = this.config.get<string>('KNOWLEDGE_DOCS_PATH')?.trim()
    const candidates = [
      configuredPath || null,
      path.resolve(process.cwd(), '../docs'),
      path.resolve(process.cwd(), 'docs'),
      '/docs',
    ].filter(Boolean) as string[]

    for (const candidate of candidates) {
      try {
        const stats = await fs.stat(candidate)
        if (stats.isDirectory()) {
          return candidate
        }
      } catch {
        continue
      }
    }

    return null
  }
}

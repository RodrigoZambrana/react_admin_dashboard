import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  ConversationChannel,
  ConversationMessageAuthorType,
  ConversationScope,
  KnowledgeConversationBundleStatus,
  KnowledgeCandidateStatus,
  KnowledgeDerivedArtifactStatus,
  KnowledgeDerivedArtifactType,
  KnowledgeDocumentScope,
  KnowledgeDocumentStatus,
  KnowledgeIngestionRunStatus,
  KnowledgeNegativeExampleSourceKind,
  KnowledgeNegativeExampleStatus,
  KnowledgeRawEventStatus,
  KnowledgeSnapshotEntryType,
  KnowledgeSnapshotSourceKind,
  KnowledgeSnapshotSourceRole,
  KnowledgeSnapshotStatus,
  KnowledgeSourceType,
  KnowledgeSuggestionFeedbackOutcome,
  Prisma,
} from '@prisma/client'
import { createHash } from 'crypto'
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
import { CreateKnowledgeUrlDto } from './dto/create-knowledge-url.dto'
import { CreateKnowledgeCandidateDto } from './dto/create-knowledge-candidate.dto'
import { ReviewKnowledgeCandidateDto } from './dto/review-knowledge-candidate.dto'
import { RetrieveKnowledgeDto } from './dto/retrieve-knowledge.dto'
import { IndexKnowledgeDocumentsDto } from './dto/index-knowledge-documents.dto'
import { ListKnowledgeRawEventsDto } from './dto/list-knowledge-raw-events.dto'
import { ListKnowledgeIngestionRunsDto } from './dto/list-knowledge-ingestion-runs.dto'
import { IngestConversationKnowledgeDto } from './dto/ingest-conversation-knowledge.dto'
import { UpdateKnowledgeDocumentDto } from './dto/update-knowledge-document.dto'
import { ListKnowledgeFeedbackDto } from './dto/list-knowledge-feedback.dto'
import { ListKnowledgeConversationBundlesDto } from './dto/list-knowledge-conversation-bundles.dto'
import { ListKnowledgeNegativeExamplesDto } from './dto/list-knowledge-negative-examples.dto'
import { ReviewKnowledgeConversationBundleDto } from './dto/review-knowledge-conversation-bundle.dto'
import { ReviewKnowledgeNegativeExampleDto } from './dto/review-knowledge-negative-example.dto'
import { RefreshKnowledgeUrlDocumentsDto } from './dto/refresh-knowledge-url-documents.dto'
import { GetKnowledgeQuoteProfilesAdminDto } from './dto/get-knowledge-quote-profiles-admin.dto'
import { UpsertKnowledgeQuoteProfilesDto } from './dto/upsert-knowledge-quote-profiles.dto'

const DOC_SOURCES = [
  'product.md',
  'architecture.md',
  'decisions.md',
  'storefront.md',
  'notifications.md',
  'ai-knowledge-base-plan.md',
]

const KNOWLEDGE_URL_REFRESH_POLICIES = ['manual', 'daily', 'weekly', 'on_demand'] as const

type KnowledgeUrlRefreshPolicy =
  (typeof KNOWLEDGE_URL_REFRESH_POLICIES)[number]

type TenantTopicTaxonomyKind =
  | 'product_family'
  | 'product_topic'
  | 'product_variant'

type TenantTopicTaxonomyItem = {
  key: string
  label: string
  kind: TenantTopicTaxonomyKind
  aliases: string[]
  normalizationValue: string | null
  parentKeys: string[]
  parentLabels: string[]
  familyLabel: string | null
  tags: string[]
  sourceDocumentIds: string[]
}

type TenantQuoteProfileClosureMode =
  | 'collect_then_handoff'
  | 'collect_then_price_or_handoff'

type TenantQuoteProfilePricingStrategy =
  | 'handoff_only'
  | 'immediate_unit_price'
  | 'immediate_square_meter'
  | 'parametric_exact_or_handoff'

type TenantQuoteProfileAttributeCaptureKind =
  | 'measurements'
  | 'quantity'
  | 'taxonomy_tag'
  | 'enum'

type TenantQuoteProfileAttributeOption = {
  value: string
  aliases: string[]
}

type TenantQuoteProfileAttribute = {
  key: string
  label: string
  required: boolean
  captureKind: TenantQuoteProfileAttributeCaptureKind
  taxonomyTag: string | null
  options: TenantQuoteProfileAttributeOption[]
  subjectPrefix: string | null
}

type TenantQuoteProfile = {
  key: string
  label: string
  appliesToTopicKeys: string[]
  appliesToTopicLabels: string[]
  familyLabel: string | null
  pricingStrategy: TenantQuoteProfilePricingStrategy
  closureMode: TenantQuoteProfileClosureMode
  measurementCarrierTerms: string[]
  attributes: TenantQuoteProfileAttribute[]
  sourceDocumentIds: string[]
}

type KnowledgeDerivedTopicTaxonomyArtifactContent = TenantTopicTaxonomyItem

type KnowledgeDerivedQuoteProfileArtifactContent = TenantQuoteProfile

type KnowledgeDerivedMeasurementCarrierTermsArtifactContent = {
  key: string
  label: string
  quoteProfileKey: string | null
  appliesToTopicKeys: string[]
  appliesToTopicLabels: string[]
  measurementCarrierTerms: string[]
  sourceDocumentIds: string[]
}

type KnowledgeDerivedKeywordLexiconArtifactContent = {
  key: string
  label: string
  aliases: string[]
  topicKey: string | null
  quoteProfileKey: string | null
  taxonomyTag: string | null
  sourceDocumentIds: string[]
}

type KnowledgeDerivedArtifactDraft = {
  type: KnowledgeDerivedArtifactType
  content:
    | KnowledgeDerivedTopicTaxonomyArtifactContent
    | KnowledgeDerivedQuoteProfileArtifactContent
    | KnowledgeDerivedMeasurementCarrierTermsArtifactContent
    | KnowledgeDerivedKeywordLexiconArtifactContent
  metadata?: Record<string, unknown>
}

const KNOWLEDGE_WEB_PRODUCT_SIGNAL_DEFINITIONS = [
  {
    label: 'cortinas roller',
    factType: 'product_topic',
    tags: ['product_topic', 'roller', 'cortinas'],
    matchers: [/\bcortinas?\s+roller\b/u, /\broller\b/u],
  },
  {
    label: 'cortinas venecianas',
    factType: 'product_topic',
    tags: ['product_topic', 'venecianas', 'cortinas'],
    matchers: [/\bcortinas?\s+venecianas?\b/u, /\bvenecianas?\b/u],
  },
  {
    label: 'persianas',
    factType: 'product_topic',
    tags: ['product_topic', 'persianas'],
    matchers: [/\bpersianas?\b/u],
  },
  {
    label: 'bandas verticales',
    factType: 'product_topic',
    tags: ['product_topic', 'bandas_verticales'],
    matchers: [/\bbandas?\s+verticales?\b/u, /\bbanda\s+vertical\b/u],
  },
  {
    label: 'aberturas de aluminio',
    factType: 'product_topic',
    tags: ['product_topic', 'aberturas', 'aluminio'],
    matchers: [/\baberturas?(?:\s+de\s+aluminio)?\b/u],
  },
  {
    label: 'automatizacion',
    factType: 'product_topic',
    tags: ['product_topic', 'automatizacion'],
    matchers: [/\bautomatizacion\b/u],
  },
  {
    label: 'mosquiteros',
    factType: 'product_topic',
    tags: ['product_topic', 'mosquiteros'],
    matchers: [/\bmosquiteros?\b/u],
  },
  {
    label: 'screen',
    factType: 'product_variant',
    tags: ['product_variant', 'screen'],
    matchers: [/\bscreen\b/u],
  },
  {
    label: 'blackout',
    factType: 'product_variant',
    tags: ['product_variant', 'blackout'],
    matchers: [/\bblackout\b/u],
  },
  {
    label: 'dvh',
    factType: 'product_variant',
    tags: ['product_variant', 'dvh'],
    matchers: [/\bdvh\b/u, /\bdoble\s+vidriado\s+hermetico\b/u],
  },
  {
    label: 'probba',
    factType: 'product_variant',
    tags: ['product_variant', 'probba'],
    matchers: [/\bprobba\b/u],
  },
  {
    label: 'gala',
    factType: 'product_variant',
    tags: ['product_variant', 'gala'],
    matchers: [/\bgala\b/u],
  },
  {
    label: 'summa',
    factType: 'product_variant',
    tags: ['product_variant', 'summa'],
    matchers: [/\bsumma\b/u],
  },
  {
    label: 'monoblock',
    factType: 'product_variant',
    tags: ['product_variant', 'monoblock'],
    matchers: [/\bmonoblock\b/u],
  },
] as const

const DEFAULT_RUNTIME_KNOWLEDGE: Record<
  KnowledgeDocumentScope,
  Array<{
    key: string
    title: string
    plainText: string
    topicKey: string
    appliesToChannels: string[]
  }>
> = {
  [KnowledgeDocumentScope.CUSTOMER_PUBLIC]: [
    {
      key: 'base:customer_public:natural_conversation',
      title: 'Conversación base con cliente',
      plainText:
        'El sistema debe responder de forma natural, breve y útil aun cuando no exista conocimiento específico aprobado para la consulta.',
      topicKey: 'customer.base_conversation',
      appliesToChannels: ['webchat', 'whatsapp', 'email', 'meta'],
    },
    {
      key: 'base:customer_public:minimal_clarification',
      title: 'Aclaración mínima antes de responder',
      plainText:
        'Si falta información crítica, debe pedir la aclaración mínima necesaria antes de afirmar datos no confirmados o prometer resultados.',
      topicKey: 'customer.minimal_clarification',
      appliesToChannels: ['webchat', 'whatsapp', 'email', 'meta'],
    },
    {
      key: 'base:customer_public:safe_visibility',
      title: 'Límites de visibilidad y seguridad',
      plainText:
        'Solo puede brindar información visible, aprobada o verificable para cliente. Si no alcanza el contexto, mantiene la conversación abierta y escala a humano solo cuando corresponde.',
      topicKey: 'customer.safe_visibility',
      appliesToChannels: ['webchat', 'whatsapp', 'email', 'meta'],
    },
  ],
  [KnowledgeDocumentScope.ADMIN_INTERNAL]: [
    {
      key: 'base:admin_internal:operational_support',
      title: 'Apoyo operativo interno',
      plainText:
        'El asistente interno debe ser fluido y amigable, orientado a resolver gestión operativa real sin lenguaje robótico ni desvíos innecesarios.',
      topicKey: 'admin.operational_support',
      appliesToChannels: ['admin_chat'],
    },
    {
      key: 'base:admin_internal:confirmation_before_execution',
      title: 'Confirmación antes de ejecutar',
      plainText:
        'No debe ejecutar acciones críticas sin draft verificable, validación backend y confirmación explícita cuando el flujo lo requiera.',
      topicKey: 'admin.confirmation_before_execution',
      appliesToChannels: ['admin_chat'],
    },
    {
      key: 'base:admin_internal:clear_error_reporting',
      title: 'Errores y faltantes claros',
      plainText:
        'Si faltan datos o una acción falla, debe indicar con claridad qué faltó, qué se entendió y cuál es el siguiente paso operativo recomendado.',
      topicKey: 'admin.clear_error_reporting',
      appliesToChannels: ['admin_chat'],
    },
  ],
}

const formatSnapshotDateTime = (value: Date) => {
  try {
    return new Intl.DateTimeFormat('es-UY', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(value)
  } catch {
    return value.toISOString()
  }
}

type CapturedKnowledgeEventResult = {
  status: 'created' | 'updated' | 'attached' | 'skipped'
  reason?: string
  rawEventId?: string
  candidateId?: string | null
  candidateCreated?: boolean
}

type KnowledgeSuggestionFeedbackCounts = {
  used: number
  edited: number
  discarded: number
}

type KnowledgeSuggestionFeedbackMetrics = KnowledgeSuggestionFeedbackCounts & {
  total: number
  applied: number
  adoptionRate: number
  discardRate: number
}

type PaginatedKnowledgeList<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasMore: boolean
  orderBy: string
  orderDir: 'asc' | 'desc'
}

type KnowledgeSnapshotSourceFingerprint = {
  activeDocuments: {
    count: number
    latestUpdatedAt: string | null
  }
  approvedCandidates: {
    count: number
    latestUpdatedAt: string | null
  }
  pendingRawEvents: {
    count: number
    latestUpdatedAt: string | null
  }
  approvedBundles: {
    count: number
    latestUpdatedAt: string | null
  }
  approvedNegativeExamples: {
    count: number
    latestUpdatedAt: string | null
  }
}

type KnowledgeSnapshotSourceRecord = {
  sourceKind: KnowledgeSnapshotSourceKind
  sourceId: string
  sourceVersion?: number | null
  sourceStatus?: string | null
  role: KnowledgeSnapshotSourceRole
  excerpt?: string | null
  metadata?: Record<string, unknown> | null
}

type KnowledgeSnapshotDraftEntry = {
  entryType: KnowledgeSnapshotEntryType
  key: string
  title: string
  plainText: string
  normalizedIntent?: string | null
  topicKey?: string | null
  confidence?: number | null
  priority?: string | null
  appliesToChannels?: string[]
  metadata?: Record<string, unknown> | null
  sources: KnowledgeSnapshotSourceRecord[]
}

type KnowledgeSnapshotDiffItem = {
  key: string
  title: string
  entryType: string
  topicKey: string | null
  normalizedIntent: string | null
  plainText: string
  confidence: number | null
  appliesToChannels: string[]
  sources: Array<{
    sourceKind: string
    sourceId: string
    role: string
    sourceStatus: string | null
    excerpt: string | null
    metadata: Prisma.JsonValue | null
  }>
}

type KnowledgeWebPageKind =
  | 'contact_page'
  | 'faq_page'
  | 'hours_page'
  | 'payments_page'
  | 'product_page'

type KnowledgeWebDerivedFactType =
  | 'location'
  | 'local_commercial'
  | 'contact_phone'
  | 'contact_email'
  | 'business_hours'
  | 'payment_methods'
  | 'product_topic'
  | 'product_variant'

type KnowledgeWebDerivedFact = {
  factType: KnowledgeWebDerivedFactType
  title: string
  summary: string | null
  content: string
  tags: string[]
  confidence: number
  extractionMethod: 'faq_answer' | 'label_value' | 'pattern_match'
  factKey?: string | null
  factValue?: string | null
  topicType?: 'product_topic' | 'product_variant' | null
}

type KnowledgeWebPageAnalysis = {
  pageKinds: KnowledgeWebPageKind[]
  facts: KnowledgeWebDerivedFact[]
}

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly embeddings: KnowledgeEmbeddingsService,
  ) {}

  async getOverview(tenantKey?: string) {
    const resolvedTenantKey = this.resolveTenantKey(tenantKey)
    const [documentCounts, candidateCounts, rawEventCounts, runCounts, feedbackCounts] =
      await Promise.all([
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
      this.prisma.knowledgeRawEvent.groupBy({
        by: ['status', 'scope'],
        where: { tenantKey: resolvedTenantKey },
        _count: { _all: true },
      }),
      this.prisma.knowledgeIngestionRun.groupBy({
        by: ['status'],
        where: { tenantKey: resolvedTenantKey },
        _count: { _all: true },
      }),
      this.prisma.knowledgeSuggestionFeedback.groupBy({
        by: ['outcome'],
        where: { tenantKey: resolvedTenantKey },
        _count: { _all: true },
      }),
    ])

    const feedbackSummary = this.buildSuggestionFeedbackMetrics(
      feedbackCounts.reduce<KnowledgeSuggestionFeedbackCounts>(
        (accumulator, row) => {
          if (row.outcome === KnowledgeSuggestionFeedbackOutcome.USED) {
            accumulator.used = row._count._all
          } else if (row.outcome === KnowledgeSuggestionFeedbackOutcome.EDITED) {
            accumulator.edited = row._count._all
          } else if (
            row.outcome === KnowledgeSuggestionFeedbackOutcome.DISCARDED
          ) {
            accumulator.discarded = row._count._all
          }

          return accumulator
        },
        {
          used: 0,
          edited: 0,
          discarded: 0,
        },
      ),
    )

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
      rawEvents: rawEventCounts.map((entry) => ({
        status: this.normalizeEnum(entry.status),
        scope: this.normalizeEnum(entry.scope),
        count: entry._count._all,
      })),
      ingestionRuns: runCounts.map((entry) => ({
        status: this.normalizeEnum(entry.status),
        count: entry._count._all,
      })),
      feedback: feedbackSummary,
    }
  }

  async getLatestSnapshot(input?: {
    tenantKey?: string
    scope?: 'customer_public' | 'admin_internal'
  }) {
    const tenantKey = this.resolveTenantKey(input?.tenantKey)
    const scope = this.mapScope(input?.scope ?? 'admin_internal')
    const latestSnapshot = await this.prisma.knowledgeSnapshot.findFirst({
      where: {
        tenantKey,
        scope,
        status: {
          in: [KnowledgeSnapshotStatus.READY, KnowledgeSnapshotStatus.STALE],
        },
      },
      include: {
        generatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        entries: {
          include: {
            sources: true,
          },
          orderBy: [{ entryType: 'asc' }, { title: 'asc' }],
        },
      },
      orderBy: [{ version: 'desc' }, { generatedAt: 'desc' }],
    })

    const snapshotInputs = await this.collectSnapshotInputs(tenantKey, scope)
    const currentFingerprint = this.buildSnapshotSourceFingerprint(snapshotInputs)
    const latestFingerprint = this.extractSnapshotSourceFingerprint(
      latestSnapshot?.metadata ?? null,
    )

    if (
      latestSnapshot &&
      latestSnapshot.status === KnowledgeSnapshotStatus.READY &&
      latestFingerprint &&
      JSON.stringify(latestFingerprint) === JSON.stringify(currentFingerprint)
    ) {
      return this.mapKnowledgeSnapshot(latestSnapshot)
    }

    return this.generateDeterministicSnapshot({
      tenantKey,
      scope,
      latestSnapshot,
      snapshotInputs,
      sourceFingerprint: currentFingerprint,
    })
  }

  async getSnapshot(id: string) {
    const snapshot = await this.prisma.knowledgeSnapshot.findUnique({
      where: { id },
      include: {
        generatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        entries: {
          include: {
            sources: true,
          },
          orderBy: [{ entryType: 'asc' }, { title: 'asc' }],
        },
      },
    })

    if (!snapshot) {
      throw new NotFoundException('knowledge.snapshotNotFound')
    }

    return this.mapKnowledgeSnapshot(snapshot)
  }

  async getSnapshotPlainText(id: string) {
    const snapshot = await this.getSnapshot(id)
    return {
      id: snapshot.id,
      tenantKey: snapshot.tenantKey,
      scope: snapshot.scope,
      version: snapshot.version,
      status: snapshot.status,
      generatedAt: snapshot.generatedAt,
      plainText: snapshot.summaryText ?? this.renderKnowledgeSnapshotPlainText(snapshot),
    }
  }

  async getSnapshotDiff(id: string, compareToId?: string) {
    const currentSnapshot = await this.prisma.knowledgeSnapshot.findUnique({
      where: { id },
      include: {
        generatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        entries: {
          include: {
            sources: true,
          },
          orderBy: [{ entryType: 'asc' }, { title: 'asc' }],
        },
      },
    })

    if (!currentSnapshot) {
      throw new NotFoundException('knowledge.snapshotNotFound')
    }

    const compareSnapshot = compareToId
      ? await this.prisma.knowledgeSnapshot.findUnique({
          where: { id: compareToId },
          include: {
            generatedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            entries: {
              include: {
                sources: true,
              },
              orderBy: [{ entryType: 'asc' }, { title: 'asc' }],
            },
          },
        })
      : await this.prisma.knowledgeSnapshot.findFirst({
          where: {
            tenantKey: currentSnapshot.tenantKey,
            scope: currentSnapshot.scope,
            version: {
              lt: currentSnapshot.version,
            },
            status: {
              in: [KnowledgeSnapshotStatus.READY, KnowledgeSnapshotStatus.STALE],
            },
          },
          include: {
            generatedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            entries: {
              include: {
                sources: true,
              },
              orderBy: [{ entryType: 'asc' }, { title: 'asc' }],
            },
          },
          orderBy: [{ version: 'desc' }, { generatedAt: 'desc' }],
        })

    const mappedCurrent = this.mapKnowledgeSnapshot(currentSnapshot)
    const mappedCompare = compareSnapshot
      ? this.mapKnowledgeSnapshot(compareSnapshot)
      : null

    return this.buildKnowledgeSnapshotDiff(mappedCurrent, mappedCompare)
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

    const documents = await this.prisma.knowledgeDocument.findMany({
      where,
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

    const mappedItems = documents
      .map((item) => this.mapDocument(item))
      .filter((item) => {
        if (query.originCategory && item.originCategory !== query.originCategory) {
          return false
        }

        if (query.contentType && item.contentType !== query.contentType) {
          return false
        }

        if (query.hasEmbedding === 'true' && !item.hasEmbedding) {
          return false
        }

        if (query.hasEmbedding === 'false' && item.hasEmbedding) {
          return false
        }

        return true
      })

    return this.sortAndPaginateList(mappedItems, {
      page: query.page,
      pageSize: query.pageSize,
      defaultPageSize: query.sourceFileOnly === 'true' ? 50 : 25,
      orderBy: query.orderBy,
      orderDir: query.orderDir,
      defaultOrderBy: 'updatedAt',
      selectors: {
        updatedAt: (item) => item.updatedAt,
        createdAt: (item) => item.createdAt,
        title: (item) => item.title,
        sourceType: (item) => item.sourceType,
        status: (item) => item.status,
        approvedAt: (item) => item.approvedAt,
      },
    })
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
    if (query.sourceType) {
      where.sourceType = this.mapSourceType(query.sourceType)
    }
    if (query.detectedIntent?.trim()) {
      where.detectedIntent = {
        contains: query.detectedIntent.trim(),
        mode: 'insensitive',
      }
    }
    if (query.search?.trim()) {
      const search = query.search.trim()
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { contextSummary: { contains: search, mode: 'insensitive' } },
        { suggestedResponse: { contains: search, mode: 'insensitive' } },
        { approvedResponse: { contains: search, mode: 'insensitive' } },
      ]
    }

    const candidates = await this.prisma.knowledgeCandidate.findMany({
      where,
      include: {
        conversation: {
          select: {
            id: true,
            subject: true,
            channel: true,
          },
        },
        observation: {
          select: {
            id: true,
            status: true,
            channel: true,
            sourceAuthorType: true,
            userMessage: true,
            operatorReply: true,
            aiReply: true,
            messageElements: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    const feedbackByCandidateId = await this.buildSuggestionFeedbackSummaryMap(
      candidates.map((item) => item.id),
    )

    const mappedItems = candidates
      .map((item) =>
        this.mapCandidate(
          item,
          this.buildSuggestionFeedbackMetrics(feedbackByCandidateId.get(item.id)),
        ),
      )
      .filter((item) => {
        if (query.channel && item.channel !== query.channel) {
          return false
        }

        if (query.originCategory && item.originCategory !== query.originCategory) {
          return false
        }

        if (query.hasFeedback === 'true' && !item.hasFeedback) {
          return false
        }

        if (query.hasFeedback === 'false' && item.hasFeedback) {
          return false
        }

        return true
      })

    return this.sortAndPaginateList(mappedItems, {
      page: query.page,
      pageSize: query.pageSize,
      defaultPageSize: 25,
      orderBy: query.orderBy,
      orderDir: query.orderDir,
      defaultOrderBy: 'updatedAt',
      selectors: {
        updatedAt: (item) => item.updatedAt,
        createdAt: (item) => item.createdAt,
        status: (item) => item.status,
        confidence: (item) => item.confidence ?? -1,
        detectedIntent: (item) => item.detectedIntent ?? '',
        feedbackApplied: (item) => item.feedback.applied,
      },
    })
  }

  async listRawEvents(query: ListKnowledgeRawEventsDto) {
    const tenantKey = this.resolveTenantKey(query.tenantKey)
    const where: Prisma.KnowledgeRawEventWhereInput = {
      tenantKey,
    }

    if (query.status) {
      where.status = this.mapRawEventStatus(query.status)
    }
    if (query.conversationId?.trim()) {
      where.conversationId = query.conversationId.trim()
    }
    if (query.channel && query.channel !== 'meta') {
      where.channel = this.mapConversationChannel(query.channel)
    }
    if (query.sourceAuthorType) {
      where.sourceAuthorType = this.mapConversationMessageAuthorType(
        query.sourceAuthorType,
      )
    }
    if (query.detectedIntent?.trim()) {
      where.detectedIntent = {
        contains: query.detectedIntent.trim(),
        mode: 'insensitive',
      }
    }
    if (query.search?.trim()) {
      const search = query.search.trim()
      where.OR = [
        { userMessage: { contains: search, mode: 'insensitive' } },
        { operatorReply: { contains: search, mode: 'insensitive' } },
        { aiReply: { contains: search, mode: 'insensitive' } },
        { contextSummary: { contains: search, mode: 'insensitive' } },
        { suggestedResponse: { contains: search, mode: 'insensitive' } },
      ]
    }

    const rawEvents = await this.prisma.knowledgeRawEvent.findMany({
      where,
      include: {
        conversation: {
          select: {
            id: true,
            subject: true,
            channel: true,
            scope: true,
          },
        },
        message: {
          select: {
            id: true,
            authorType: true,
            kind: true,
            body: true,
            createdAt: true,
          },
        },
        candidate: {
          select: {
            id: true,
            status: true,
            confidence: true,
            version: true,
          },
        },
      },
    })

    const mappedItems = rawEvents.map((item) => this.mapRawEvent(item))

    return this.sortAndPaginateList(mappedItems, {
      page: query.page,
      pageSize: query.pageSize,
      defaultPageSize: 25,
      orderBy: query.orderBy,
      orderDir: query.orderDir,
      defaultOrderBy: 'updatedAt',
      selectors: {
        updatedAt: (item) => item.updatedAt,
        createdAt: (item) => item.createdAt,
        status: (item) => item.status,
        channel: (item) => item.channel,
        confidence: (item) => item.confidence ?? -1,
        detectedIntent: (item) => item.detectedIntent ?? '',
      },
    })
  }

  async listIngestionRuns(query: ListKnowledgeIngestionRunsDto) {
    const tenantKey = this.resolveTenantKey(query.tenantKey)
    const where: Prisma.KnowledgeIngestionRunWhereInput = {
      tenantKey,
    }

    if (query.status) {
      where.status = this.mapIngestionRunStatus(query.status)
    }
    if (query.sourceType) {
      where.sourceType = this.mapSourceType(query.sourceType)
    }
    if (query.createdByUserId) {
      where.createdByUserId = query.createdByUserId
    }
    if (query.from || query.to) {
      where.startedAt = {}
      if (query.from) {
        const fromDate = new Date(query.from)
        if (!Number.isNaN(fromDate.getTime())) {
          where.startedAt.gte = fromDate
        }
      }
      if (query.to) {
        const toDate = new Date(query.to)
        if (!Number.isNaN(toDate.getTime())) {
          where.startedAt.lte = toDate
        }
      }
    }

    const runs = await this.prisma.knowledgeIngestionRun.findMany({
      where,
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            observations: true,
          },
        },
      },
    })

    const mappedItems = runs.map((item) => ({
      id: item.id,
      tenantKey: item.tenantKey,
      sourceType: this.normalizeEnum(item.sourceType),
      triggerType: item.triggerType,
      status: this.normalizeEnum(item.status),
      processedCount: item.processedCount,
      createdCandidates: item.createdCandidates,
      skippedCount: item.skippedCount,
      errorCount: item.errorCount,
      observationCount: item._count.observations,
      metadata: item.metadata ?? null,
      createdByUser: item.createdByUser
        ? {
            id: item.createdByUser.id,
            name: item.createdByUser.name ?? null,
            email: item.createdByUser.email,
          }
        : null,
      startedAt: item.startedAt,
      finishedAt: item.finishedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))

    return this.sortAndPaginateList(mappedItems, {
      page: query.page,
      pageSize: query.pageSize,
      defaultPageSize: 25,
      orderBy: query.orderBy,
      orderDir: query.orderDir,
      defaultOrderBy: 'startedAt',
      selectors: {
        startedAt: (item) => item.startedAt,
        finishedAt: (item) => item.finishedAt,
        createdAt: (item) => item.createdAt,
        status: (item) => item.status,
        processedCount: (item) => item.processedCount,
        createdCandidates: (item) => item.createdCandidates,
        errorCount: (item) => item.errorCount,
      },
    })
  }

  async listFeedback(query: ListKnowledgeFeedbackDto) {
    const tenantKey = this.resolveTenantKey(query.tenantKey)
    const where: Prisma.KnowledgeSuggestionFeedbackWhereInput = {
      tenantKey,
    }

    if (query.outcome) {
      const mappedOutcome = this.mapSuggestionFeedbackOutcome(query.outcome)
      if (mappedOutcome) {
        where.outcome = mappedOutcome
      }
    }
    if (query.candidateId?.trim()) {
      where.candidateId = query.candidateId.trim()
    }
    if (query.conversationId?.trim()) {
      where.conversationId = query.conversationId.trim()
    }
    if (query.scope) {
      where.candidate = {
        scope: this.mapScope(query.scope),
      }
    }
    if (query.channel) {
      where.conversation = {
        channel: this.mapConversationChannel(query.channel),
      }
    }
    if (query.search?.trim()) {
      const search = query.search.trim()
      where.OR = [
        { suggestedText: { contains: search, mode: 'insensitive' } },
        { finalText: { contains: search, mode: 'insensitive' } },
        {
          candidate: {
            title: { contains: search, mode: 'insensitive' },
          },
        },
        {
          candidate: {
            detectedIntent: { contains: search, mode: 'insensitive' },
          },
        },
        {
          conversation: {
            subject: { contains: search, mode: 'insensitive' },
          },
        },
      ]
    }

    const rows = await this.prisma.knowledgeSuggestionFeedback.findMany({
      where,
      include: {
        candidate: {
          select: {
            id: true,
            title: true,
            detectedIntent: true,
            status: true,
            scope: true,
            sourceType: true,
            version: true,
          },
        },
        conversation: {
          select: {
            id: true,
            subject: true,
            channel: true,
            scope: true,
          },
        },
        actorUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        targetMessage: {
          select: {
            id: true,
            body: true,
            createdAt: true,
          },
        },
        operatorMessage: {
          select: {
            id: true,
            body: true,
            createdAt: true,
          },
        },
      },
    })

    const mappedItems = rows.map((item) => ({
      id: item.id,
      tenantKey: item.tenantKey,
      outcome: this.normalizeEnum(item.outcome),
      scope: this.normalizeEnum(item.candidate.scope),
      channel: this.normalizeVisibleChannel(item.conversation.channel),
      suggestedText: item.suggestedText ?? null,
      finalText: item.finalText ?? null,
      metadata: item.metadata ?? null,
      candidate: {
        id: item.candidate.id,
        title: item.candidate.title,
        detectedIntent: item.candidate.detectedIntent ?? null,
        status: this.normalizeEnum(item.candidate.status),
        sourceType: this.normalizeEnum(item.candidate.sourceType),
        version: item.candidate.version,
      },
      conversation: {
        id: item.conversation.id,
        subject: item.conversation.subject ?? null,
        channel: this.normalizeVisibleChannel(item.conversation.channel),
        scope: this.normalizeEnum(item.conversation.scope),
      },
      actorUser: item.actorUser
        ? {
            id: item.actorUser.id,
            name: item.actorUser.name ?? null,
            email: item.actorUser.email,
          }
        : null,
      targetMessage: item.targetMessage
        ? {
            id: item.targetMessage.id,
            body: item.targetMessage.body ?? null,
            createdAt: item.targetMessage.createdAt,
          }
        : null,
      operatorMessage: item.operatorMessage
        ? {
            id: item.operatorMessage.id,
            body: item.operatorMessage.body ?? null,
            createdAt: item.operatorMessage.createdAt,
          }
        : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))

    return this.sortAndPaginateList(mappedItems, {
      page: query.page,
      pageSize: query.pageSize,
      defaultPageSize: 25,
      orderBy: query.orderBy,
      orderDir: query.orderDir,
      defaultOrderBy: 'createdAt',
      selectors: {
        createdAt: (item) => item.createdAt,
        updatedAt: (item) => item.updatedAt,
        outcome: (item) => item.outcome,
        channel: (item) => item.channel,
        candidateTitle: (item) => item.candidate.title,
        actorName: (item) =>
          item.actorUser?.name || item.actorUser?.email || 'Sin actor',
      },
    })
  }

  async listConversationBundles(query: ListKnowledgeConversationBundlesDto) {
    const tenantKey = this.resolveTenantKey(query.tenantKey)
    const where: Prisma.KnowledgeConversationBundleWhereInput = {
      tenantKey,
    }

    if (query.scope) {
      where.scope = this.mapScope(query.scope)
    }
    if (query.status) {
      where.status = this.mapConversationBundleStatus(query.status)
    }
    if (query.channel) {
      where.conversation = {
        channel: this.mapConversationChannel(query.channel),
      }
    }
    if (query.search?.trim()) {
      const search = query.search.trim()
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { previewQuestion: { contains: search, mode: 'insensitive' } },
        { previewResponse: { contains: search, mode: 'insensitive' } },
        { detectedIntents: { has: search } },
        {
          conversation: {
            subject: { contains: search, mode: 'insensitive' },
          },
        },
      ]
    }

    const rows = await this.prisma.knowledgeConversationBundle.findMany({
      where,
      include: {
        conversation: {
          select: {
            id: true,
            subject: true,
            channel: true,
            scope: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    const mappedItems = rows.map((item) => this.mapConversationBundle(item))

    return this.sortAndPaginateList(mappedItems, {
      page: query.page,
      pageSize: query.pageSize,
      defaultPageSize: 25,
      orderBy: query.orderBy,
      orderDir: query.orderDir,
      defaultOrderBy: 'updatedAt',
      selectors: {
        updatedAt: (item) => item.updatedAt,
        createdAt: (item) => item.createdAt,
        approvedCount: (item) => item.approvedCount,
        pendingCount: (item) => item.pendingCount,
        eventCount: (item) => item.eventCount,
        candidateCount: (item) => item.candidateCount,
      },
    })
  }

  async getConversationBundle(id: string) {
    const bundle = await this.prisma.knowledgeConversationBundle.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        conversation: {
          include: {
            knowledgeRawEvents: {
              orderBy: [{ updatedAt: 'desc' }],
              take: 25,
              include: {
                conversation: {
                  select: {
                    id: true,
                    subject: true,
                    channel: true,
                    scope: true,
                  },
                },
                message: {
                  select: {
                    id: true,
                    authorType: true,
                    kind: true,
                    body: true,
                    createdAt: true,
                  },
                },
                candidate: {
                  select: {
                    id: true,
                    status: true,
                    confidence: true,
                    version: true,
                  },
                },
              },
            },
            knowledgeCandidates: {
              orderBy: [{ updatedAt: 'desc' }],
              take: 25,
              include: {
                conversation: {
                  select: {
                    id: true,
                    subject: true,
                    channel: true,
                  },
                },
                observation: {
                  select: {
                    id: true,
                    status: true,
                    channel: true,
                    sourceAuthorType: true,
                    userMessage: true,
                    operatorReply: true,
                    aiReply: true,
                    messageElements: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!bundle) {
      throw new NotFoundException('knowledge.conversationBundleNotFound')
    }

    const feedbackByCandidateId = await this.buildSuggestionFeedbackSummaryMap(
      bundle.conversation.knowledgeCandidates.map((item) => item.id),
    )
    const mapped = this.mapConversationBundle(bundle)
    return {
      ...mapped,
      rawEvents:
        bundle.conversation.knowledgeRawEvents.map((item) => this.mapRawEvent(item)) ?? [],
      candidates:
        bundle.conversation.knowledgeCandidates.map((item) =>
          this.mapCandidate(
            item,
            this.buildSuggestionFeedbackMetrics(feedbackByCandidateId.get(item.id)),
          ),
        ) ?? [],
    }
  }

  async reviewConversationBundle(
    id: string,
    input: ReviewKnowledgeConversationBundleDto,
    actorUserId: number,
  ) {
    const bundle = await this.prisma.knowledgeConversationBundle.findUnique({
      where: { id },
    })

    if (!bundle) {
      throw new NotFoundException('knowledge.conversationBundleNotFound')
    }

    const updated = await this.prisma.knowledgeConversationBundle.update({
      where: { id },
      data: {
        status:
          input.action === 'approve'
            ? KnowledgeConversationBundleStatus.APPROVED
            : KnowledgeConversationBundleStatus.REJECTED,
        summary: input.summary?.trim() || bundle.summary,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
      include: {
        conversation: {
          select: {
            id: true,
            subject: true,
            channel: true,
            scope: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return this.mapConversationBundle(updated)
  }

  async listNegativeExamples(query: ListKnowledgeNegativeExamplesDto) {
    const tenantKey = this.resolveTenantKey(query.tenantKey)
    const where: Prisma.KnowledgeNegativeExampleWhereInput = {
      tenantKey,
    }

    if (query.scope) {
      where.scope = this.mapScope(query.scope)
    }
    if (query.status) {
      where.status = this.mapNegativeExampleStatus(query.status)
    }
    if (query.sourceKind) {
      where.sourceKind = this.mapNegativeExampleSourceKind(query.sourceKind)
    }
    if (query.channel) {
      where.channel = this.mapConversationChannel(query.channel)
    }
    if (query.detectedIntent?.trim()) {
      where.detectedIntent = {
        contains: query.detectedIntent.trim(),
        mode: 'insensitive',
      }
    }
    if (query.search?.trim()) {
      const search = query.search.trim()
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { disallowedText: { contains: search, mode: 'insensitive' } },
        { correctedText: { contains: search, mode: 'insensitive' } },
        { detectedIntent: { contains: search, mode: 'insensitive' } },
      ]
    }

    const rows = await this.prisma.knowledgeNegativeExample.findMany({
      where,
      include: {
        conversation: {
          select: {
            id: true,
            subject: true,
            channel: true,
            scope: true,
          },
        },
        candidate: {
          select: {
            id: true,
            title: true,
            detectedIntent: true,
            status: true,
            sourceType: true,
            version: true,
          },
        },
        feedback: {
          select: {
            id: true,
            outcome: true,
            suggestedText: true,
            finalText: true,
            createdAt: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    const mappedItems = rows.map((item) => this.mapNegativeExample(item))

    return this.sortAndPaginateList(mappedItems, {
      page: query.page,
      pageSize: query.pageSize,
      defaultPageSize: 25,
      orderBy: query.orderBy,
      orderDir: query.orderDir,
      defaultOrderBy: 'updatedAt',
      selectors: {
        updatedAt: (item) => item.updatedAt,
        createdAt: (item) => item.createdAt,
        status: (item) => item.status,
        sourceKind: (item) => item.sourceKind,
        detectedIntent: (item) => item.detectedIntent ?? '',
      },
    })
  }

  async getNegativeExample(id: string) {
    const row = await this.prisma.knowledgeNegativeExample.findUnique({
      where: { id },
      include: {
        conversation: {
          select: {
            id: true,
            subject: true,
            channel: true,
            scope: true,
          },
        },
        candidate: {
          select: {
            id: true,
            title: true,
            detectedIntent: true,
            status: true,
            sourceType: true,
            version: true,
          },
        },
        feedback: {
          select: {
            id: true,
            outcome: true,
            suggestedText: true,
            finalText: true,
            createdAt: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!row) {
      throw new NotFoundException('knowledge.negativeExampleNotFound')
    }

    return this.mapNegativeExample(row)
  }

  async reviewNegativeExample(
    id: string,
    input: ReviewKnowledgeNegativeExampleDto,
    actorUserId: number,
  ) {
    const row = await this.prisma.knowledgeNegativeExample.findUnique({
      where: { id },
    })

    if (!row) {
      throw new NotFoundException('knowledge.negativeExampleNotFound')
    }

    const updated = await this.prisma.knowledgeNegativeExample.update({
      where: { id },
      data: {
        status:
          input.action === 'approve'
            ? KnowledgeNegativeExampleStatus.APPROVED
            : KnowledgeNegativeExampleStatus.REJECTED,
        title: input.title?.trim() || row.title,
        summary: input.summary?.trim() || row.summary,
        correctedText: input.correctedText?.trim() || row.correctedText,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
      include: {
        conversation: {
          select: {
            id: true,
            subject: true,
            channel: true,
            scope: true,
          },
        },
        candidate: {
          select: {
            id: true,
            title: true,
            detectedIntent: true,
            status: true,
            sourceType: true,
            version: true,
          },
        },
        feedback: {
          select: {
            id: true,
            outcome: true,
            suggestedText: true,
            finalText: true,
            createdAt: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return this.mapNegativeExample(updated)
  }

  async suggestApprovedRepliesForConversation(input: {
    conversationId: string
    limit?: number
  }) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: {
        id: true,
        tenantKey: true,
        scope: true,
        channel: true,
        subject: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
          select: {
            id: true,
            authorType: true,
            body: true,
            normalizedText: true,
            createdAt: true,
          },
        },
      },
    })

    if (!conversation) {
      throw new NotFoundException('conversation.notFound')
    }

    if (conversation.scope === ConversationScope.ADMIN_INTERNAL) {
      return {
        conversationId: conversation.id,
        targetMessageId: null,
        items: [],
      }
    }

    const targetMessage = [...conversation.messages]
      .reverse()
      .find(
        (message) =>
          message.authorType === ConversationMessageAuthorType.CUSTOMER &&
          Boolean((message.body ?? message.normalizedText ?? '').trim()),
      )

    if (!targetMessage) {
      return {
        conversationId: conversation.id,
        targetMessageId: null,
        items: [],
      }
    }

    const scope = this.mapKnowledgeScopeFromConversationScope(conversation.scope)
    const observation = await this.prisma.knowledgeRawEvent.findFirst({
      where: {
        conversationId: conversation.id,
        OR: [
          { messageId: targetMessage.id },
          {
            sourceAuthorType: ConversationMessageAuthorType.CUSTOMER,
          },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        detectedIntent: true,
        problem: true,
        contextSummary: true,
        dedupeHash: true,
        clusterKey: true,
      },
    })

    const queryText = [
      targetMessage.body ?? targetMessage.normalizedText ?? '',
      observation?.problem ?? '',
      observation?.contextSummary ?? '',
      observation?.detectedIntent ?? '',
      conversation.subject ?? '',
    ]
      .filter(Boolean)
      .join(' \n ')
      .trim()

    const approvedCandidates = await this.prisma.knowledgeCandidate.findMany({
      where: {
        tenantKey: conversation.tenantKey,
        scope,
        status: KnowledgeCandidateStatus.APPROVED,
      },
      orderBy: [{ reviewedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        title: true,
        summary: true,
        excerpt: true,
        redactedExcerpt: true,
        detectedIntent: true,
        problem: true,
        contextSummary: true,
        suggestedResponse: true,
        approvedResponse: true,
        confidence: true,
        dedupeHash: true,
        clusterKey: true,
        version: true,
        reviewedAt: true,
        observationId: true,
      },
    })
    const feedbackByCandidateId =
      await this.buildSuggestionFeedbackSummaryMap(
        approvedCandidates.map((candidate) => candidate.id),
      )

    const normalizedQuery = this.normalizeKnowledgeText(queryText)
    const queryVector = normalizedQuery
      ? this.embeddings.projectQuery(queryText)
      : []
    const ranked = approvedCandidates
      .map((candidate) => {
        const responseText =
          candidate.approvedResponse ??
          candidate.suggestedResponse ??
          null
        if (!responseText) {
          return null
        }

        const feedback =
          feedbackByCandidateId.get(candidate.id) ?? {
            used: 0,
            edited: 0,
            discarded: 0,
          }

        let score = 0
        const matchedBy: string[] = []
        if (
          observation?.dedupeHash &&
          candidate.dedupeHash &&
          observation.dedupeHash === candidate.dedupeHash
        ) {
          score += 120
          matchedBy.push('dedupe')
        }
        if (
          observation?.detectedIntent &&
          candidate.detectedIntent &&
          observation.detectedIntent === candidate.detectedIntent
        ) {
          score += 40
          matchedBy.push('intent')
        }
        if (
          observation?.clusterKey &&
          candidate.clusterKey &&
          observation.clusterKey === candidate.clusterKey
        ) {
          score += 16
          matchedBy.push('cluster')
        }

        const lexicalHaystack = [
          candidate.title,
          candidate.summary ?? '',
          candidate.excerpt,
          candidate.redactedExcerpt ?? '',
          candidate.problem ?? '',
          candidate.contextSummary ?? '',
          responseText,
        ].join(' \n ')
        const lexicalScore = this.scoreKnowledgeCandidate(lexicalHaystack, normalizedQuery)
        if (lexicalScore > 0) {
          score += lexicalScore
          matchedBy.push('lexical')
        }

        const semanticVector =
          normalizedQuery && lexicalHaystack.trim()
            ? this.embeddings.projectQuery(lexicalHaystack)
            : []
        const semanticScore =
          queryVector.length && semanticVector.length
            ? this.embeddings.cosineSimilarity(queryVector, semanticVector)
            : 0
        if (semanticScore >= 0.18) {
          score += semanticScore * 18
          matchedBy.push('semantic')
        }

        const feedbackScore = Math.min(feedback.used * 4, 24) +
          Math.min(feedback.edited * 2, 10) -
          Math.min(feedback.discarded * 3, 12)
        if (feedbackScore !== 0) {
          score += feedbackScore
          matchedBy.push('feedback')
        }

        if (score <= 0) {
          return null
        }

        return {
          id: candidate.id,
          title: candidate.title,
          summary: candidate.summary ?? candidate.contextSummary ?? null,
          responseText,
          detectedIntent: candidate.detectedIntent ?? null,
          confidence: candidate.confidence ?? null,
          score: Number(score.toFixed(2)),
          semanticScore: Number(semanticScore.toFixed(4)),
          matchedBy,
          version: candidate.version,
          feedback,
          source: {
            type: 'approved_candidate',
            candidateId: candidate.id,
            observationId: candidate.observationId ?? null,
            reviewedAt: candidate.reviewedAt,
          },
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => {
        if (left.score !== right.score) {
          return right.score - left.score
        }
        return (right.confidence ?? 0) - (left.confidence ?? 0)
      })
      .slice(0, input.limit ?? 3)

    return {
      conversationId: conversation.id,
      targetMessageId: targetMessage.id,
      targetMessageText: targetMessage.body ?? targetMessage.normalizedText ?? null,
      items: ranked,
    }
  }

  async getDocument(id: string) {
    return this.getDocumentById(id)
  }

  async getCandidate(id: string) {
    const candidate = await this.prisma.knowledgeCandidate.findUnique({
      where: { id },
      include: {
        conversation: {
          select: {
            id: true,
            subject: true,
            channel: true,
          },
        },
        observation: {
          select: {
            id: true,
            status: true,
            channel: true,
            sourceAuthorType: true,
            userMessage: true,
            operatorReply: true,
            aiReply: true,
            messageElements: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!candidate) {
      throw new NotFoundException('knowledge.candidateNotFound')
    }

    const feedbackByCandidateId = await this.buildSuggestionFeedbackSummaryMap([
      candidate.id,
    ])
    return this.mapCandidate(
      candidate,
      this.buildSuggestionFeedbackMetrics(feedbackByCandidateId.get(candidate.id)),
    )
  }

  async getRawEvent(id: string) {
    const rawEvent = await this.prisma.knowledgeRawEvent.findUnique({
      where: { id },
      include: {
        conversation: {
          select: {
            id: true,
            subject: true,
            channel: true,
            scope: true,
          },
        },
        message: {
          select: {
            id: true,
            authorType: true,
            kind: true,
            body: true,
            createdAt: true,
          },
        },
        candidate: {
          select: {
            id: true,
            status: true,
            confidence: true,
            version: true,
          },
        },
      },
    })

    if (!rawEvent) {
      throw new NotFoundException('knowledge.rawEventNotFound')
    }

    return this.mapRawEvent(rawEvent)
  }

  async recordSuggestionFeedback(
    input: {
      conversationId: string
      candidateId: string
      actorUserId?: number | null
      outcome?: 'used' | 'edited' | 'discarded' | null
      targetMessageId?: string | null
      targetMessageText?: string | null
      suggestedText?: string | null
      finalText?: string | null
      operatorMessageId?: string | null
      metadata?: Record<string, unknown> | null
    },
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: {
        id: true,
        tenantKey: true,
        scope: true,
      },
    })

    if (!conversation) {
      throw new NotFoundException('conversation.notFound')
    }

    const candidate = await this.prisma.knowledgeCandidate.findUnique({
      where: { id: input.candidateId },
      select: {
        id: true,
        tenantKey: true,
        scope: true,
        status: true,
      },
    })

    if (!candidate) {
      throw new NotFoundException('knowledge.candidateNotFound')
    }

    if (
      candidate.tenantKey !== conversation.tenantKey ||
      candidate.scope !== this.mapKnowledgeScopeFromConversationScope(conversation.scope)
    ) {
      throw new NotFoundException('knowledge.candidateNotFound')
    }

    if (candidate.status !== KnowledgeCandidateStatus.APPROVED) {
      throw new NotFoundException('knowledge.candidateNotApproved')
    }

    const suggestedText = input.suggestedText?.trim() || null
    const finalText = input.finalText?.trim() || null
    const explicitOutcome = this.mapSuggestionFeedbackOutcome(input.outcome)
    const outcome =
      explicitOutcome ??
      this.inferSuggestionFeedbackOutcome({
        suggestedText,
        finalText,
      })

    const feedback = await this.prisma.knowledgeSuggestionFeedback.create({
      data: {
        tenantKey: conversation.tenantKey,
        conversationId: conversation.id,
        candidateId: candidate.id,
        targetMessageId: input.targetMessageId?.trim() || null,
        operatorMessageId: input.operatorMessageId?.trim() || null,
        actorUserId: input.actorUserId ?? null,
        outcome,
        suggestedText,
        finalText,
        metadata: this.toJsonValue({
          targetMessageText: input.targetMessageText?.trim() || null,
          source: 'admin-inbox',
          ...(input.metadata ?? {}),
        }),
      },
      select: {
        id: true,
        outcome: true,
        candidateId: true,
        conversationId: true,
        operatorMessageId: true,
        createdAt: true,
      },
    })

    if (outcome === KnowledgeSuggestionFeedbackOutcome.DISCARDED) {
      await this.syncNegativeExampleFromFeedback(feedback.id, input.actorUserId ?? null)
    }

    return {
      id: feedback.id,
      outcome: this.normalizeEnum(feedback.outcome),
      candidateId: feedback.candidateId,
      conversationId: feedback.conversationId,
      operatorMessageId: feedback.operatorMessageId ?? null,
      createdAt: feedback.createdAt,
    }
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
            entry.document.sourceType === KnowledgeSourceType.WEB_URL ||
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
      items: ranked.map(({ document, score, lexicalScore, vectorScore }) => {
        const metadata = this.asRecord(document.metadata)
        return {
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
          metadata: {
            documentKind:
              typeof metadata?.documentKind === 'string'
                ? String(metadata.documentKind)
                : null,
            factType:
              typeof metadata?.factType === 'string'
                ? String(metadata.factType)
                : null,
            factValue:
              typeof metadata?.factValue === 'string'
                ? String(metadata.factValue)
                : null,
            topicType:
              typeof metadata?.topicType === 'string'
                ? String(metadata.topicType)
                : null,
            pageKinds: Array.isArray(metadata?.pageKinds)
              ? metadata.pageKinds
                  .filter((entry): entry is string => typeof entry === 'string')
                  .slice(0, 6)
              : [],
            url:
              typeof metadata?.url === 'string'
                ? String(metadata.url)
                : typeof metadata?.derivedFromUrl === 'string'
                  ? String(metadata.derivedFromUrl)
                  : null,
          },
          updatedAt: document.updatedAt,
        }
      }),
    }
  }

  async getTopicTaxonomy(input?: {
    tenantKey?: string
    scope?: 'customer_public' | 'admin_internal'
  }) {
    const tenantKey = this.resolveTenantKey(input?.tenantKey)
    const scope =
      input?.scope?.trim() === 'admin_internal'
        ? KnowledgeDocumentScope.ADMIN_INTERNAL
        : KnowledgeDocumentScope.CUSTOMER_PUBLIC

    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        tenantKey,
        status: KnowledgeDocumentStatus.ACTIVE,
        approvedAt: { not: null },
        scope,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        tags: true,
        metadata: true,
      },
    })

    const derivedArtifacts = await this.listActiveKnowledgeDerivedArtifacts({
      tenantKey,
      scope,
      types: [
        KnowledgeDerivedArtifactType.TOPIC_TAXONOMY,
        KnowledgeDerivedArtifactType.KEYWORD_LEXICON,
      ],
    })
    const items = this.applyDerivedKeywordLexiconToTopicTaxonomyItems(
      this.mergeTenantTopicTaxonomyItems([
        ...this.buildTenantTopicTaxonomyItems(documents),
        ...this.extractTenantTopicTaxonomyItemsFromArtifacts(derivedArtifacts),
      ]).sort((left, right) =>
        left.label.localeCompare(right.label, undefined, {
          sensitivity: 'base',
        }),
      ),
      derivedArtifacts,
    )
    return {
      tenantKey,
      scope: this.normalizeEnum(scope),
      items,
      updatedAt: new Date().toISOString(),
    }
  }

  async getQuoteProfiles(input?: {
    tenantKey?: string
    scope?: 'customer_public' | 'admin_internal'
  }) {
    const tenantKey = this.resolveTenantKey(input?.tenantKey)
    const scope =
      input?.scope?.trim() === 'admin_internal'
        ? KnowledgeDocumentScope.ADMIN_INTERNAL
        : KnowledgeDocumentScope.CUSTOMER_PUBLIC

    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        tenantKey,
        status: KnowledgeDocumentStatus.ACTIVE,
        approvedAt: { not: null },
        scope,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        metadata: true,
      },
    })

    const derivedArtifacts = await this.listActiveKnowledgeDerivedArtifacts({
      tenantKey,
      scope,
      types: [
        KnowledgeDerivedArtifactType.QUOTE_PROFILE_HINTS,
        KnowledgeDerivedArtifactType.MEASUREMENT_CARRIER_TERMS,
      ],
    })
    const items = this.applyDerivedMeasurementCarrierArtifactsToQuoteProfiles(
      this.mergeTenantQuoteProfiles([
        ...this.buildTenantQuoteProfiles(documents),
        ...this.extractTenantQuoteProfilesFromArtifacts(derivedArtifacts),
      ]).sort((left, right) =>
        left.label.localeCompare(right.label, undefined, {
          sensitivity: 'base',
        }),
      ),
      derivedArtifacts,
    )
    return {
      tenantKey,
      scope: this.normalizeEnum(scope),
      items,
      updatedAt: new Date().toISOString(),
    }
  }

  async getManagedQuoteProfiles(input?: GetKnowledgeQuoteProfilesAdminDto) {
    const tenantKey = this.resolveTenantKey(input?.tenantKey)
    const scope =
      input?.scope?.trim() === 'admin_internal'
        ? KnowledgeDocumentScope.ADMIN_INTERNAL
        : KnowledgeDocumentScope.CUSTOMER_PUBLIC

    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        tenantKey,
        scope,
        sourceType: KnowledgeSourceType.ADMIN_CURATED,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        summary: true,
        content: true,
        tags: true,
        status: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const matchingDocuments = documents.filter(
      (document) =>
        this.asRecord(document.metadata)?.sourceKind === 'tenant_quote_profiles',
    )
    const currentDocument = matchingDocuments[0] ?? null
    const items = currentDocument
      ? this.buildTenantQuoteProfiles([
          {
            id: currentDocument.id,
            metadata: currentDocument.metadata,
          },
        ])
      : []
    const catalogConsistency = await this.buildQuoteProfilesCatalogConsistency({
      tenantKey,
      items,
    })

    return {
      tenantKey,
      scope: this.normalizeEnum(scope),
      document: currentDocument
        ? {
            id: currentDocument.id,
            title: currentDocument.title,
            summary: currentDocument.summary,
            content: currentDocument.content,
            tags: currentDocument.tags,
            status: this.normalizeEnum(currentDocument.status),
            createdAt: currentDocument.createdAt.toISOString(),
            updatedAt: currentDocument.updatedAt.toISOString(),
          }
        : null,
      items,
      catalogConsistency,
      updatedAt: currentDocument?.updatedAt.toISOString() ?? new Date().toISOString(),
    }
  }

  async syncManagedQuoteProfiles(
    input: GetKnowledgeQuoteProfilesAdminDto | undefined,
    actorUserId: number,
  ) {
    const current = await this.getManagedQuoteProfiles(input)
    if (!current.document || !Array.isArray(current.items) || !current.items.length) {
      throw new BadRequestException('knowledge.quoteProfilesMissing')
    }

    return this.upsertManagedQuoteProfiles(
      {
        documentId: current.document.id,
        tenantKey: current.tenantKey,
        scope: current.scope as 'customer_public' | 'admin_internal',
        title: current.document.title,
        summary: current.document.summary ?? undefined,
        tags: current.document.tags,
        profiles: current.items.map((profile) => ({
          key: profile.key,
          label: profile.label,
          appliesToTopicKeys: profile.appliesToTopicKeys,
          appliesToTopicLabels: profile.appliesToTopicLabels,
          familyLabel: profile.familyLabel,
          pricingStrategy: profile.pricingStrategy,
          closureMode: profile.closureMode,
          measurementCarrierTerms: profile.measurementCarrierTerms,
          attributes: profile.attributes.map((attribute) => ({
            key: attribute.key,
            label: attribute.label,
            required: attribute.required,
            captureKind: attribute.captureKind,
            taxonomyTag: attribute.taxonomyTag,
            subjectPrefix: attribute.subjectPrefix,
            options: attribute.options.map((option) => ({
              value: option.value,
              aliases: option.aliases,
            })),
          })),
        })),
      },
      actorUserId,
    )
  }

  async upsertManagedQuoteProfiles(
    input: UpsertKnowledgeQuoteProfilesDto,
    actorUserId: number,
  ) {
    const tenantKey = this.resolveTenantKey(input.tenantKey)
    const scope =
      input.scope === 'admin_internal'
        ? KnowledgeDocumentScope.ADMIN_INTERNAL
        : KnowledgeDocumentScope.CUSTOMER_PUBLIC

    const normalizedProfiles = (input.profiles ?? [])
      .map((entry) =>
        this.normalizeExplicitTenantQuoteProfileEntry(
          entry,
          input.documentId || 'managed_quote_profiles',
        ),
      )
      .filter((entry): entry is TenantQuoteProfile => Boolean(entry))

    if (!normalizedProfiles.length) {
      throw new BadRequestException('knowledge.quoteProfilesRequired')
    }

    const persistedProfiles = normalizedProfiles.map((profile) => ({
      key: profile.key,
      label: profile.label,
      appliesToTopicKeys: profile.appliesToTopicKeys,
      appliesToTopicLabels: profile.appliesToTopicLabels,
      familyLabel: profile.familyLabel,
      pricingStrategy: profile.pricingStrategy,
      closureMode: profile.closureMode,
      measurementCarrierTerms: profile.measurementCarrierTerms,
      attributes: profile.attributes.map((attribute) => ({
        key: attribute.key,
        label: attribute.label,
        required: attribute.required,
        captureKind: attribute.captureKind,
        taxonomyTag: attribute.taxonomyTag,
        subjectPrefix: attribute.subjectPrefix,
        options: attribute.options.map((option) => ({
          value: option.value,
          aliases: option.aliases,
        })),
      })),
    }))

    const title =
      input.title?.trim() ||
      `Perfiles de cotización · ${tenantKey || 'Tenant'}`
    const summary =
      input.summary?.trim() ||
      'Perfiles curados para intake de presupuestos por tipo de producto y cierre operativo.'
    const content =
      input.content?.trim() ||
      this.buildQuoteProfilesDocumentContent(persistedProfiles)
    const tags =
      input.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [
        'tenant-quote-profiles',
        'customer-quote',
      ]

    const metadata = {
      source: 'admin-ui',
      sourceKind: 'tenant_quote_profiles',
      pricingSchemaVersion: 1,
      quoteProfiles: persistedProfiles,
    }

    let documentId = input.documentId?.trim() || null

    if (!documentId) {
      const existingDocuments = await this.prisma.knowledgeDocument.findMany({
        where: {
          tenantKey,
          scope,
          sourceType: KnowledgeSourceType.ADMIN_CURATED,
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          metadata: true,
        },
      })

      documentId =
        existingDocuments.find(
          (document) =>
            this.asRecord(document.metadata)?.sourceKind ===
            'tenant_quote_profiles',
        )?.id ?? null
    }

    if (documentId) {
      await this.updateDocument(
        documentId,
        {
          title,
          summary,
          content,
          tags,
          scope: this.normalizeEnum(scope) as 'customer_public' | 'admin_internal',
          status: 'active',
          metadata,
        },
        actorUserId,
      )
    } else {
      await this.createCuratedDocument(
        {
          tenantKey,
          scope: this.normalizeEnum(scope) as 'customer_public' | 'admin_internal',
          title,
          summary,
          content,
          tags,
          metadata,
        },
        actorUserId,
      )
    }

    return this.getManagedQuoteProfiles({
      tenantKey,
      scope: this.normalizeEnum(scope) as 'customer_public' | 'admin_internal',
    })
  }

  private buildQuoteProfilesDocumentContent(
    profiles: Array<{
      key: string
      label: string
      appliesToTopicKeys?: string[]
      appliesToTopicLabels?: string[]
      familyLabel?: string | null
      pricingStrategy: TenantQuoteProfilePricingStrategy
      closureMode: TenantQuoteProfileClosureMode
      measurementCarrierTerms?: string[]
      attributes?: Array<{
        key: string
        label: string
        required: boolean
        captureKind: TenantQuoteProfileAttributeCaptureKind
        taxonomyTag?: string | null
        subjectPrefix?: string | null
        options?: Array<{
          value: string
          aliases?: string[]
        }>
      }>
    }>,
  ) {
    const strategyLabels: Record<TenantQuoteProfilePricingStrategy, string> = {
      handoff_only: 'handoff_only',
      immediate_unit_price: 'immediate_unit_price',
      immediate_square_meter: 'immediate_square_meter',
      parametric_exact_or_handoff: 'parametric_exact_or_handoff',
    }

    const closureLabels: Record<TenantQuoteProfileClosureMode, string> = {
      collect_then_handoff: 'collect_then_handoff',
      collect_then_price_or_handoff: 'collect_then_price_or_handoff',
    }

    const lines = [
      '# Perfiles de cotización',
      '',
      'Documento curado y gestionado desde admin para definir intake mínimo, estrategia de pricing y cierre operativo por tipo de producto o servicio.',
      '',
    ]

    for (const profile of profiles) {
      const topicLabels = Array.isArray(profile.appliesToTopicLabels)
        ? profile.appliesToTopicLabels.filter(Boolean)
        : []
      const topicKeys = Array.isArray(profile.appliesToTopicKeys)
        ? profile.appliesToTopicKeys.filter(Boolean)
        : []
      const carrierTerms = Array.isArray(profile.measurementCarrierTerms)
        ? profile.measurementCarrierTerms.filter(Boolean)
        : []
      const attributes = Array.isArray(profile.attributes)
        ? profile.attributes.filter(Boolean)
        : []

      lines.push(`## ${profile.label}`)
      lines.push(`- Key: ${profile.key}`)
      if (profile.familyLabel) {
        lines.push(`- Familia: ${profile.familyLabel}`)
      }
      if (topicLabels.length) {
        lines.push(`- Aplica a tópicos: ${topicLabels.join(', ')}`)
      }
      if (topicKeys.length) {
        lines.push(`- Topic keys: ${topicKeys.join(', ')}`)
      }
      lines.push(`- Estrategia de pricing: ${strategyLabels[profile.pricingStrategy]}`)
      lines.push(`- Cierre operativo: ${closureLabels[profile.closureMode]}`)
      if (carrierTerms.length) {
        lines.push(`- Términos portadores de medida: ${carrierTerms.join(', ')}`)
      }

      if (attributes.length) {
        lines.push('- Atributos:')
        for (const attribute of attributes) {
          const optionValues = Array.isArray(attribute.options)
            ? attribute.options
                .map((option) => option?.value)
                .filter((value): value is string => Boolean(value))
            : []
          const attributeParts = [
            `${attribute.label}`,
            `[${attribute.key}]`,
            attribute.required ? 'required' : 'optional',
            `capture:${attribute.captureKind}`,
          ]
          if (attribute.taxonomyTag) {
            attributeParts.push(`taxonomy:${attribute.taxonomyTag}`)
          }
          if (attribute.subjectPrefix) {
            attributeParts.push(`prefix:${attribute.subjectPrefix}`)
          }
          if (optionValues.length) {
            attributeParts.push(`options:${optionValues.join(', ')}`)
          }
          lines.push(`  - ${attributeParts.join(' · ')}`)
        }
      }

      lines.push('')
    }

    return lines.join('\n').trim()
  }

  private normalizeCatalogConsistencyText(value: string | null | undefined) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private buildQuoteProfileCatalogSearchTerms(profile: TenantQuoteProfile) {
    const candidates = [
      profile.label,
      profile.familyLabel,
      ...(Array.isArray(profile.appliesToTopicLabels) ? profile.appliesToTopicLabels : []),
    ]
      .map((entry) => this.normalizeCatalogConsistencyText(entry))
      .filter((entry) => entry.length >= 3)

    return Array.from(new Set(candidates))
  }

  private doesCatalogProductMatchQuoteProfile(
    profile: TenantQuoteProfile,
    product: {
      name: string
      tags: string[]
      category: { name: string } | null
    },
  ) {
    const haystack = this.normalizeCatalogConsistencyText(
      [
        product.name,
        product.category?.name ?? '',
        ...(Array.isArray(product.tags) ? product.tags : []),
      ].join(' '),
    )
    if (!haystack) {
      return false
    }

    const searchTerms = this.buildQuoteProfileCatalogSearchTerms(profile)
    if (!searchTerms.length) {
      return false
    }

    return searchTerms.some((term) => haystack.includes(term))
  }

  private async buildQuoteProfilesCatalogConsistency(input: {
    tenantKey: string
    items: TenantQuoteProfile[]
  }) {
    const products = await this.prisma.product.findMany({
      where: {
        published: true,
      },
      select: {
        id: true,
        name: true,
        mode: true,
        unitOfMeasure: true,
        tags: true,
        category: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })

    const items = (Array.isArray(input.items) ? input.items : []).map((profile) => {
      const matches = products.filter((product) =>
        this.doesCatalogProductMatchQuoteProfile(profile, product),
      )
      const requiresImmediateCatalog =
        profile.pricingStrategy === 'immediate_unit_price' ||
        profile.pricingStrategy === 'immediate_square_meter'
      const status =
        !requiresImmediateCatalog
          ? 'not_applicable'
          : matches.length > 0
            ? 'matched'
            : 'review'

      return {
        profileKey: profile.key,
        label: profile.label,
        pricingStrategy: profile.pricingStrategy,
        status,
        requiresImmediateCatalog,
        catalogMatchCount: matches.length,
        matchedProducts: matches.slice(0, 6).map((product) => ({
          id: product.id,
          name: product.name,
          mode: this.normalizeEnum(product.mode),
          unitOfMeasure: this.normalizeEnum(product.unitOfMeasure),
          categoryName: product.category?.name ?? null,
        })),
      }
    })

    return {
      tenantKey: input.tenantKey,
      updatedAt: new Date().toISOString(),
      productCount: products.length,
      profileCount: items.length,
      immediateProfiles: items.filter((entry) => entry.requiresImmediateCatalog).length,
      immediateProfilesMatched: items.filter(
        (entry) => entry.requiresImmediateCatalog && entry.catalogMatchCount > 0,
      ).length,
      immediateProfilesNeedingReview: items.filter(
        (entry) => entry.requiresImmediateCatalog && entry.catalogMatchCount === 0,
      ).length,
      items,
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
    await this.syncKnowledgeDerivedArtifactsForDocument(document)
    return this.getDocumentById(document.id)
  }

  async updateDocument(
    id: string,
    input: UpdateKnowledgeDocumentDto,
    actorUserId: number,
  ) {
    const existing = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new NotFoundException('knowledge.documentNotFound')
    }

    const nextTitle = input.title?.trim()
    const nextSummary =
      input.summary === undefined ? undefined : input.summary.trim() || null
    const nextContent =
      input.content === undefined ? undefined : input.content.trim()
    const nextTags =
      input.tags === undefined
        ? undefined
        : input.tags.map((tag) => tag.trim()).filter(Boolean)
    const nextScope = input.scope ? this.mapScope(input.scope) : undefined
    const nextStatus = input.status
      ? this.mapDocumentStatus(input.status)
      : undefined

    const mergedMetadata = this.toJsonValue({
      ...(this.asRecord(existing.metadata) ?? {}),
      ...(input.metadata ?? {}),
      lastEditedByUserId: actorUserId,
      lastEditedAt: new Date().toISOString(),
    })

    const updated = await this.prisma.knowledgeDocument.update({
      where: { id },
      data: {
        title: nextTitle || undefined,
        summary: nextSummary,
        content: nextContent || undefined,
        tags: nextTags,
        scope: nextScope,
        status: nextStatus,
        metadata: mergedMetadata,
      },
    })

    if (
      updated.status === KnowledgeDocumentStatus.ACTIVE &&
      updated.approvedAt
    ) {
      await this.embeddings.indexDocument(updated)
    }

    await this.syncKnowledgeDerivedArtifactsForDocument(updated)

    return this.getDocumentById(updated.id)
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

  async createUrlDocument(input: CreateKnowledgeUrlDto, actorUserId: number) {
    const tenantKey = this.resolveTenantKey(input.tenantKey)
    const refreshPolicy = this.normalizeKnowledgeUrlRefreshPolicy(input.refreshPolicy)
    const resolved = await this.fetchKnowledgeUrlSource({
      url: input.url,
      titleOverride: input.title,
      summaryOverride: input.summary,
      refreshPolicy,
      previousMetadata: null,
    })

    const document = await this.upsertKnowledgeDocument({
      tenantKey,
      scope: this.mapScope(input.scope),
      sourceType: KnowledgeSourceType.WEB_URL,
      sourceKey: this.buildKnowledgeWebSourceKey(resolved.url),
      title: resolved.title,
      summary: resolved.summary,
      content: resolved.content,
      tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      piiRiskLevel: 'low',
      metadata: {
        ...(input.metadata ?? {}),
        ...resolved.metadata,
        source: 'admin-web-url',
      },
      actorUserId,
    })

    await this.syncKnowledgeUrlDerivedFacts({
      tenantKey,
      scope: this.mapScope(input.scope),
      actorUserId,
      url: resolved.url,
      sourceDocumentId: document.id,
      sourceDocumentTitle: resolved.title,
      pageKinds: resolved.analysis?.pageKinds ?? [],
      facts: resolved.analysis?.facts ?? [],
      tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      sourceLabel: 'admin-web-url',
    })

    const crawlOptions = this.normalizeCrawlOptions(input)
    if (crawlOptions.enabled) {
      const crawlResult = await this.crawlKnowledgeUrlSources({
        tenantKey,
        scope: this.mapScope(input.scope),
        actorUserId,
        rootUrl: resolved.url,
        rootDocumentId: document.id,
        refreshPolicy,
        tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
        metadata: {
          ...(input.metadata ?? {}),
          source: 'admin-web-url',
        },
        options: crawlOptions,
        rootRawHtml: resolved.rawHtml || null,
      })

      await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          metadata: this.toJsonValue({
            ...(input.metadata ?? {}),
            ...resolved.metadata,
            source: 'admin-web-url',
            crawl: {
              enabled: true,
              rootUrl: resolved.url,
              maxDepth: crawlOptions.maxDepth,
              maxPages: crawlOptions.maxPages,
              sameDomainOnly: crawlOptions.sameDomainOnly,
              respectRobots: crawlOptions.respectRobots,
              excludePatterns: crawlOptions.excludePatterns,
              lastCrawledAt: new Date().toISOString(),
              crawledCount: crawlResult.createdCount,
            },
          }),
        },
      })
    }

    return this.getDocumentById(document.id)
  }

  async refreshUrlDocument(id: string, actorUserId: number) {
    const existing = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new NotFoundException('knowledge.documentNotFound')
    }
    if (existing.sourceType !== KnowledgeSourceType.WEB_URL) {
      throw new NotFoundException('knowledge.urlDocumentNotFound')
    }

    const metadata = this.readKnowledgeUrlMetadata(existing.metadata)
    if (!metadata.url) {
      throw new NotFoundException('knowledge.urlDocumentMissingUrl')
    }

    const resolved = await this.fetchKnowledgeUrlSource({
      url: metadata.url,
      titleOverride: existing.title,
      summaryOverride: existing.summary,
      refreshPolicy: metadata.refreshPolicy,
      previousMetadata: metadata,
    })

    if (resolved.notModified) {
      const updated = await this.prisma.knowledgeDocument.update({
        where: { id },
        data: {
          metadata: this.toJsonValue({
            ...(this.asRecord(existing.metadata) ?? {}),
            ...resolved.metadata,
            source: metadata.source || 'admin-web-url',
            lastEditedByUserId: actorUserId,
            lastEditedAt: new Date().toISOString(),
          }),
        },
      })
      return this.getDocumentById(updated.id)
    }

    const document = await this.upsertKnowledgeDocument({
      tenantKey: existing.tenantKey,
      scope: existing.scope,
      sourceType: KnowledgeSourceType.WEB_URL,
      sourceKey: existing.sourceKey,
      title: resolved.title,
      summary: resolved.summary,
      content: resolved.content,
      tags: existing.tags,
      piiRiskLevel: existing.piiRiskLevel ?? 'low',
      metadata: {
        ...(this.asRecord(existing.metadata) ?? {}),
        ...resolved.metadata,
        source: metadata.source || 'admin-web-url',
      },
      actorUserId,
    })

    await this.syncKnowledgeUrlDerivedFacts({
      tenantKey: existing.tenantKey,
      scope: existing.scope,
      actorUserId,
      url: resolved.url,
      sourceDocumentId: document.id,
      sourceDocumentTitle: resolved.title,
      pageKinds: resolved.analysis?.pageKinds ?? [],
      facts: resolved.analysis?.facts ?? [],
      tags: existing.tags ?? [],
      sourceLabel: metadata.source || 'admin-web-url',
    })

    const crawlOptions = this.normalizeCrawlOptions(existing.metadata)
    if (crawlOptions.enabled && crawlOptions.rootUrl === metadata.url) {
      await this.crawlKnowledgeUrlSources({
        tenantKey: existing.tenantKey,
        scope: existing.scope,
        actorUserId,
        rootUrl: metadata.url,
        rootDocumentId: existing.id,
        refreshPolicy: metadata.refreshPolicy,
        tags: existing.tags ?? [],
        metadata: this.asRecord(existing.metadata) ?? {},
        options: crawlOptions,
        rootRawHtml: resolved.rawHtml || null,
      })
    }

    return this.getDocumentById(document.id)
  }

  async refreshDueUrlDocuments(
    input: RefreshKnowledgeUrlDocumentsDto,
    actorUserId: number,
  ) {
    const tenantKey = this.resolveTenantKey(input.tenantKey)
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        tenantKey,
        sourceType: KnowledgeSourceType.WEB_URL,
        status: KnowledgeDocumentStatus.ACTIVE,
        ...(input.scope ? { scope: this.mapScope(input.scope) } : {}),
      },
      select: {
        id: true,
        metadata: true,
      },
    })

    const dueIds = documents
      .filter((document) => this.isKnowledgeUrlRefreshDue(document.metadata))
      .map((document) => document.id)

    const refreshed: Array<{ id: string }> = []
    for (const id of dueIds) {
      refreshed.push(await this.refreshUrlDocument(id, actorUserId))
    }

    return {
      tenantKey,
      requestedScope: input.scope ?? null,
      refreshedCount: refreshed.length,
      refreshedIds: refreshed.map((item) => item.id),
    }
  }

  async deleteDocument(id: string) {
    const document = (await this.prisma.knowledgeDocument.findUnique({
      where: { id },
    })) as
      | {
          id: string
          tenantKey: string
          scope: KnowledgeDocumentScope
          sourceType: KnowledgeSourceType
          sourceFilePath: string | null
          metadata: Prisma.JsonValue | null
        }
      | null

    if (!document) {
      throw new NotFoundException('knowledge.documentNotFound')
    }

    if (document.sourceType === KnowledgeSourceType.WEB_URL) {
      const metadata = this.asRecord(document.metadata)
      const isDerivedFact = metadata?.documentKind === 'derived_web_fact'
      const urlMetadata = this.readKnowledgeUrlMetadata(document.metadata)
      const targetUrl = !isDerivedFact ? urlMetadata.url : null

      if (targetUrl) {
        await this.prisma.knowledgeDocument.deleteMany({
          where: {
            tenantKey: document.tenantKey,
            scope: document.scope,
            sourceType: KnowledgeSourceType.WEB_URL,
            sourceKey: {
              startsWith: this.buildKnowledgeWebFactSourceKeyPrefix(targetUrl),
            },
          },
        })
      }
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
    const message = await this.prisma.conversationMessage.findUnique({
      where: { id: input.messageId },
      select: {
        id: true,
        conversationId: true,
      },
    })

    if (!message || message.conversationId !== input.conversationId) {
      throw new NotFoundException('knowledge.messageNotFound')
    }

    const result = await this.captureConversationMessage(message.id, {
      actorUserId,
      forceObservation: true,
      tenantKey: input.tenantKey,
      titleOverride: input.title?.trim() || undefined,
      summaryOverride: input.summary?.trim() || undefined,
    })

    const candidate = result.candidateId
      ? await this.prisma.knowledgeCandidate.findUnique({
          where: { id: result.candidateId },
        })
      : null

    return {
      id: candidate?.id ?? null,
      status: candidate ? this.normalizeEnum(candidate.status) : 'observation_only',
      piiDetected: candidate?.piiDetected ?? false,
      rawEventId: result.rawEventId ?? null,
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
        approvedResponse:
          approved
            ? input.content?.trim() ||
              candidate.approvedResponse ||
              candidate.suggestedResponse ||
              candidate.redactedExcerpt ||
              candidate.excerpt
            : null,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
    })

    if (candidate.observationId) {
      await this.prisma.knowledgeRawEvent.update({
        where: { id: candidate.observationId },
        data: {
          status:
            status === KnowledgeCandidateStatus.REJECTED
              ? KnowledgeRawEventStatus.DISCARDED
              : KnowledgeRawEventStatus.PROCESSED,
          metadata: this.toJsonValue({
            ...(this.asRecord(candidate.metadata) ?? {}),
            reviewAction: status === KnowledgeCandidateStatus.APPROVED ? 'approved' : 'rejected',
            reviewedByUserId: actorUserId,
          }),
        },
      })
    }

    if (status === KnowledgeCandidateStatus.REJECTED) {
      await this.syncNegativeExampleFromCandidate({
        candidateId: candidate.id,
        actorUserId,
      })
    } else {
      await this.clearNegativeExampleForCandidate(candidate.id)
    }

    if (candidate.conversationId) {
      await this.syncConversationBundleForConversation(candidate.conversationId, {
        actorUserId,
      })
    }

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
            candidate.approvedResponse ||
            candidate.suggestedResponse ||
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

  async ingestConversationMessages(
    input: IngestConversationKnowledgeDto,
    actorUserId: number,
  ) {
    const tenantKey = this.resolveTenantKey(input.tenantKey)
    const limit = input.limit ?? 100
    const run = await this.prisma.knowledgeIngestionRun.create({
      data: {
        tenantKey,
        sourceType: 'conversation_message',
        triggerType: 'manual_backfill',
        status: KnowledgeIngestionRunStatus.RUNNING,
        metadata: this.toJsonValue({
          limit,
        }),
        createdByUserId: actorUserId,
      },
    })

    let processedCount = 0
    let createdCandidates = 0
    let skippedCount = 0
    let errorCount = 0

    try {
      const messages = await this.prisma.conversationMessage.findMany({
        where: {
          conversation: {
            tenantKey,
          },
        },
        select: {
          id: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
      })

      for (const message of messages) {
        try {
          const result = await this.captureConversationMessage(message.id, {
            actorUserId,
            ingestionRunId: run.id,
            tenantKey,
          })

          if (result.status === 'skipped') {
            skippedCount += 1
            continue
          }

          processedCount += 1
          if (result.candidateCreated) {
            createdCandidates += 1
          }
        } catch {
          errorCount += 1
        }
      }

      const completedRun = await this.prisma.knowledgeIngestionRun.update({
        where: { id: run.id },
        data: {
          status: KnowledgeIngestionRunStatus.COMPLETED,
          processedCount,
          createdCandidates,
          skippedCount,
          errorCount,
          finishedAt: new Date(),
        },
      })

      return {
        id: completedRun.id,
        tenantKey: completedRun.tenantKey,
        status: this.normalizeEnum(completedRun.status),
        processedCount,
        createdCandidates,
        skippedCount,
        errorCount,
      }
    } catch (error) {
      await this.prisma.knowledgeIngestionRun.update({
        where: { id: run.id },
        data: {
          status: KnowledgeIngestionRunStatus.FAILED,
          processedCount,
          createdCandidates,
          skippedCount,
          errorCount: errorCount + 1,
          finishedAt: new Date(),
          metadata: this.toJsonValue({
            limit,
            error: error instanceof Error ? error.message : 'unknown',
          }),
        },
      })
      throw error
    }
  }

  async captureConversationMessage(
    messageId: string,
    options?: {
      actorUserId?: number
      ingestionRunId?: string
      forceObservation?: boolean
      tenantKey?: string
      titleOverride?: string
      summaryOverride?: string
    },
  ): Promise<CapturedKnowledgeEventResult> {
    const message = await this.prisma.conversationMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          select: {
            id: true,
            tenantKey: true,
            scope: true,
            subject: true,
            channel: true,
          },
        },
      },
    })

    if (!message?.conversation) {
      throw new NotFoundException('knowledge.messageNotFound')
    }

    const captureMode = this.resolveKnowledgeCaptureMode(message, Boolean(options?.forceObservation))
    if (captureMode.mode === 'skip') {
      return {
        status: 'skipped',
        reason: captureMode.reason,
      }
    }

    if (captureMode.mode === 'attach_reply') {
      const observation = await this.prisma.knowledgeRawEvent.findFirst({
        where: {
          conversationId: message.conversationId,
          sourceAuthorType: captureMode.sourceAuthorType,
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      })

      if (!observation) {
        return {
          status: 'skipped',
          reason: 'observation_not_found',
        }
      }

      const replyText = (message.body ?? message.normalizedText ?? '').trim()
      if (!replyText) {
        return {
          status: 'skipped',
          reason: 'reply_without_text',
        }
      }

      const aiMetadata = this.extractKnowledgeAiMetadata(message.metadata)
      const updatedObservation = await this.prisma.knowledgeRawEvent.update({
        where: { id: observation.id },
        data: {
          operatorReply:
            message.authorType === ConversationMessageAuthorType.OPERATOR
              ? replyText
              : observation.operatorReply,
          aiReply:
            message.authorType === ConversationMessageAuthorType.AGENT
              ? replyText
              : observation.aiReply,
          detectedIntent: aiMetadata.intent ?? observation.detectedIntent,
          confidence: aiMetadata.confidence ?? observation.confidence,
          suggestedResponse:
            message.authorType === ConversationMessageAuthorType.OPERATOR
              ? replyText
              : observation.suggestedResponse ?? replyText,
          status: KnowledgeRawEventStatus.PROCESSED,
          metadata: this.toJsonValue({
            ...(this.asRecord(observation.metadata) ?? {}),
            lastReplyMessageId: message.id,
            lastReplyAuthorType: this.normalizeEnum(message.authorType),
            ...(aiMetadata.decisionPath?.length
              ? {
                  decisionPath: aiMetadata.decisionPath,
                }
              : {}),
          }),
          ingestionRunId: options?.ingestionRunId ?? observation.ingestionRunId ?? null,
        },
      })

      const syncResult = await this.syncCandidateFromObservation(updatedObservation, {
        actorUserId: options?.actorUserId,
        titleOverride: options?.titleOverride,
        summaryOverride: options?.summaryOverride,
      })

      await this.syncConversationBundleForConversation(message.conversationId, {
        actorUserId: options?.actorUserId,
      })

      return {
        status: 'attached',
        rawEventId: updatedObservation.id,
        candidateId: syncResult.id,
        candidateCreated: syncResult.created,
      }
    }

    const userMessage = (message.body ?? message.normalizedText ?? '').trim()
    if (!userMessage) {
      return {
        status: 'skipped',
        reason: 'empty_message',
      }
    }

    const normalizedMessage = this.normalizeKnowledgeText(userMessage)
    const redactedMessage = this.redactSensitiveText(userMessage)
    const piiDetected = redactedMessage !== userMessage
    const messageElements = this.extractMessageElements(message)
    const messageContextOrigin = this.extractMessageContextOrigin(message)
    const attachments = this.extractMessageAttachments(message)
    const detectedIntent = this.deriveKnowledgeIntent({
      message,
      normalizedMessage,
      messageElements,
    })
    const contextSummary = this.buildObservationContextSummary({
      subject: message.conversation.subject,
      scope: message.conversation.scope,
      channel: message.conversation.channel,
      messageContextOrigin,
    })
    const problem = this.buildKnowledgeProblemSummary(redactedMessage)
    const dedupeHash = this.buildKnowledgeDedupeHash({
      scope: message.conversation.scope,
      normalizedMessage,
      detectedIntent,
    })
    const clusterKey = detectedIntent ?? `${this.normalizeEnum(message.conversation.scope)}:${this.normalizeEnum(message.conversation.channel)}`
    const confidence = this.estimateObservationConfidence({
      messageElements,
      detectedIntent,
    })
    const relevanceScore = this.estimateObservationRelevance({
      confidence,
      messageElements,
      hasReply: false,
    })
    const metadata = this.buildObservationMetadata(message)
    const existingObservation = await this.prisma.knowledgeRawEvent.findUnique({
      where: { messageId: message.id },
    })
    const rawEvent = existingObservation
      ? await this.prisma.knowledgeRawEvent.update({
          where: { id: existingObservation.id },
          data: {
            tenantKey: this.resolveTenantKey(options?.tenantKey || message.conversation.tenantKey),
            scope: this.mapKnowledgeScopeFromConversationScope(message.conversation.scope),
            channel: message.conversation.channel,
            sourceAuthorType: message.authorType,
            status: KnowledgeRawEventStatus.PROCESSED,
            conversationId: message.conversationId,
            userMessage,
            normalizedMessage,
            redactedMessage: piiDetected ? redactedMessage : null,
            detectedIntent,
            problem,
            contextSummary,
            confidence,
            relevanceScore,
            dedupeHash,
            clusterKey,
            messageElements: this.toJsonValue(messageElements),
            messageContextOrigin: this.toJsonValue(messageContextOrigin),
            attachments: this.toJsonValue(attachments),
            metadata: this.toJsonValue(metadata),
            ingestionRunId: options?.ingestionRunId ?? existingObservation.ingestionRunId ?? null,
          },
        })
      : await this.prisma.knowledgeRawEvent.create({
          data: {
            tenantKey: this.resolveTenantKey(options?.tenantKey || message.conversation.tenantKey),
            scope: this.mapKnowledgeScopeFromConversationScope(message.conversation.scope),
            channel: message.conversation.channel,
            sourceAuthorType: message.authorType,
            status: KnowledgeRawEventStatus.PROCESSED,
            conversationId: message.conversationId,
            messageId: message.id,
            userMessage,
            normalizedMessage,
            redactedMessage: piiDetected ? redactedMessage : null,
            detectedIntent,
            problem,
            contextSummary,
            suggestedResponse: null,
            confidence,
            relevanceScore,
            dedupeHash,
            clusterKey,
            messageElements: this.toJsonValue(messageElements),
            messageContextOrigin: this.toJsonValue(messageContextOrigin),
            attachments: this.toJsonValue(attachments),
            metadata: this.toJsonValue(metadata),
            ingestionRunId: options?.ingestionRunId ?? null,
          },
        })

    const syncResult = await this.syncCandidateFromObservation(rawEvent, {
      actorUserId: options?.actorUserId,
      titleOverride: options?.titleOverride,
      summaryOverride: options?.summaryOverride,
    })

    await this.syncConversationBundleForConversation(message.conversationId, {
      actorUserId: options?.actorUserId,
    })

    return {
      status: existingObservation ? 'updated' : 'created',
      rawEventId: rawEvent.id,
      candidateId: syncResult.id,
      candidateCreated: syncResult.created,
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

  private async collectSnapshotInputs(
    tenantKey: string,
    scope: KnowledgeDocumentScope,
  ) {
    const [documents, candidates, rawEvents, bundles, negativeExamples] = await Promise.all([
      this.prisma.knowledgeDocument.findMany({
        where: {
          tenantKey,
          scope,
          status: KnowledgeDocumentStatus.ACTIVE,
          approvedAt: { not: null },
        },
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
        orderBy: [{ updatedAt: 'desc' }],
        take: 500,
      }),
      this.prisma.knowledgeCandidate.findMany({
        where: {
          tenantKey,
          scope,
          status: KnowledgeCandidateStatus.APPROVED,
        },
        include: {
          conversation: {
            select: {
              id: true,
              subject: true,
              channel: true,
            },
          },
          observation: {
            select: {
              id: true,
              status: true,
              channel: true,
              sourceAuthorType: true,
              userMessage: true,
              operatorReply: true,
              aiReply: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [{ reviewedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 500,
      }),
      this.prisma.knowledgeRawEvent.findMany({
        where: {
          tenantKey,
          scope,
          status: {
            in: [KnowledgeRawEventStatus.NEW, KnowledgeRawEventStatus.PROCESSED],
          },
        },
        include: {
          conversation: {
            select: {
              id: true,
              subject: true,
              channel: true,
              scope: true,
            },
          },
          candidate: {
            select: {
              id: true,
              status: true,
              confidence: true,
              version: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 500,
      }),
      this.prisma.knowledgeConversationBundle.findMany({
        where: {
          tenantKey,
          scope,
          status: KnowledgeConversationBundleStatus.APPROVED,
        },
        include: {
          conversation: {
            select: {
              id: true,
              subject: true,
              channel: true,
              scope: true,
            },
          },
        },
        orderBy: [{ reviewedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 500,
      }),
      this.prisma.knowledgeNegativeExample.findMany({
        where: {
          tenantKey,
          scope,
          status: KnowledgeNegativeExampleStatus.APPROVED,
        },
        include: {
          conversation: {
            select: {
              id: true,
              subject: true,
              channel: true,
              scope: true,
            },
          },
          candidate: {
            select: {
              id: true,
              title: true,
              detectedIntent: true,
              status: true,
              sourceType: true,
              version: true,
            },
          },
          feedback: {
            select: {
              id: true,
              outcome: true,
              suggestedText: true,
              finalText: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ reviewedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 500,
      }),
    ])

    return {
      documents,
      candidates,
      rawEvents,
      bundles,
      negativeExamples,
    }
  }

  private buildSnapshotSourceFingerprint(input: {
    documents: Array<{ updatedAt: Date }>
    candidates: Array<{ updatedAt: Date }>
    rawEvents: Array<{ updatedAt: Date }>
    bundles: Array<{ updatedAt: Date }>
    negativeExamples: Array<{ updatedAt: Date }>
  }): KnowledgeSnapshotSourceFingerprint {
    const documents = input.documents ?? []
    const candidates = input.candidates ?? []
    const rawEvents = input.rawEvents ?? []
    const bundles = input.bundles ?? []
    const negativeExamples = input.negativeExamples ?? []

    return {
      activeDocuments: {
        count: documents.length,
        latestUpdatedAt: documents[0]?.updatedAt?.toISOString() ?? null,
      },
      approvedCandidates: {
        count: candidates.length,
        latestUpdatedAt: candidates[0]?.updatedAt?.toISOString() ?? null,
      },
      pendingRawEvents: {
        count: rawEvents.length,
        latestUpdatedAt: rawEvents[0]?.updatedAt?.toISOString() ?? null,
      },
      approvedBundles: {
        count: bundles.length,
        latestUpdatedAt: bundles[0]?.updatedAt?.toISOString() ?? null,
      },
      approvedNegativeExamples: {
        count: negativeExamples.length,
        latestUpdatedAt: negativeExamples[0]?.updatedAt?.toISOString() ?? null,
      },
    }
  }

  private extractSnapshotSourceFingerprint(
    metadata: Prisma.JsonValue | null,
  ): KnowledgeSnapshotSourceFingerprint | null {
    const record = this.asRecord(metadata)
    const fingerprint = this.asRecord(record?.sourceFingerprint)
    if (!fingerprint) {
      return null
    }

    const parseNode = (value: unknown) => {
      const node = this.asRecord(value)
      if (!node) {
        return {
          count: 0,
          latestUpdatedAt: null,
        }
      }
      return {
        count:
          typeof node.count === 'number'
            ? node.count
            : Number.isFinite(Number(node.count))
              ? Number(node.count)
              : 0,
        latestUpdatedAt:
          typeof node.latestUpdatedAt === 'string' ? node.latestUpdatedAt : null,
      }
    }

    return {
      activeDocuments: parseNode(fingerprint.activeDocuments),
      approvedCandidates: parseNode(fingerprint.approvedCandidates),
      pendingRawEvents: parseNode(fingerprint.pendingRawEvents),
      approvedBundles: parseNode(fingerprint.approvedBundles),
      approvedNegativeExamples: parseNode(fingerprint.approvedNegativeExamples),
    }
  }

  private async generateDeterministicSnapshot(input: {
    tenantKey: string
    scope: KnowledgeDocumentScope
    latestSnapshot?: {
      id: string
      version: number
      status: KnowledgeSnapshotStatus
    } | null
    snapshotInputs: Awaited<ReturnType<KnowledgeService['collectSnapshotInputs']>>
    sourceFingerprint: KnowledgeSnapshotSourceFingerprint
  }) {
    const entries = this.buildSnapshotEntries(input.snapshotInputs, input.scope)
    const bundles = input.snapshotInputs.bundles ?? []
    const negativeExamples = input.snapshotInputs.negativeExamples ?? []
    const activeEntries = entries.filter(
      (entry) =>
        entry.entryType !== KnowledgeSnapshotEntryType.KNOWN_GAP &&
        entry.entryType !== KnowledgeSnapshotEntryType.OPERATIONAL_NOTE,
    )
    const gapEntries = entries.filter(
      (entry) => entry.entryType === KnowledgeSnapshotEntryType.KNOWN_GAP,
    )
    const coverageDenominator = activeEntries.length + gapEntries.length
    const coverageScore =
      coverageDenominator > 0 ? activeEntries.length / coverageDenominator : 0
    const nextVersion = (input.latestSnapshot?.version ?? 0) + 1
    const now = new Date()
    const metrics = {
      activeDocuments: input.snapshotInputs.documents.length,
      approvedCandidates: input.snapshotInputs.candidates.length,
      pendingRawEvents: input.snapshotInputs.rawEvents.length,
      approvedBundles: bundles.length,
      approvedNegativeExamples: negativeExamples.length,
      activeEntries: activeEntries.length,
      gapEntries: gapEntries.length,
      totalEntries: entries.length,
    }

    if (
      input.latestSnapshot &&
      input.latestSnapshot.status === KnowledgeSnapshotStatus.READY
    ) {
      await this.prisma.knowledgeSnapshot.update({
        where: { id: input.latestSnapshot.id },
        data: {
          status: KnowledgeSnapshotStatus.STALE,
        },
      })
    }

    const createdSnapshot = await this.prisma.knowledgeSnapshot.create({
      data: {
        tenantKey: input.tenantKey,
        scope: input.scope,
        status: KnowledgeSnapshotStatus.READY,
        version: nextVersion,
        generationReason: input.latestSnapshot ? 'auto_refresh' : 'initial_build',
        summaryText: null,
        metrics: this.toJsonValue(metrics),
        coverageScore,
        metadata: this.toJsonValue({
          generatedWithoutLlm: true,
          sourceFingerprint: input.sourceFingerprint,
        }),
        generatedAt: now,
        entries: {
          create: entries.map((entry) => ({
            tenantKey: input.tenantKey,
            scope: input.scope,
            entryType: entry.entryType,
            key: entry.key,
            title: entry.title,
            plainText: entry.plainText,
            normalizedIntent: entry.normalizedIntent ?? null,
            topicKey: entry.topicKey ?? null,
            confidence: entry.confidence ?? null,
            priority: entry.priority ?? null,
            appliesToChannels: entry.appliesToChannels ?? [],
            metadata: this.toJsonValue(entry.metadata),
            sources: {
              create: entry.sources.map((source) => ({
                sourceKind: source.sourceKind,
                sourceId: source.sourceId,
                sourceVersion: source.sourceVersion ?? null,
                sourceStatus: source.sourceStatus ?? null,
                role: source.role,
                excerpt: source.excerpt ?? null,
                metadata: this.toJsonValue(source.metadata),
              })),
            },
          })),
        },
      },
      include: {
        generatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        entries: {
          include: {
            sources: true,
          },
          orderBy: [{ entryType: 'asc' }, { title: 'asc' }],
        },
      },
    })

    const mappedSnapshot = this.mapKnowledgeSnapshot(createdSnapshot)
    const summaryText = this.renderKnowledgeSnapshotPlainText(mappedSnapshot)

    const updatedSnapshot = await this.prisma.knowledgeSnapshot.update({
      where: { id: createdSnapshot.id },
      data: {
        summaryText,
      },
      include: {
        generatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        entries: {
          include: {
            sources: true,
          },
          orderBy: [{ entryType: 'asc' }, { title: 'asc' }],
        },
      },
    })

    return this.mapKnowledgeSnapshot(updatedSnapshot)
  }

  private buildSnapshotEntries(
    input: Awaited<ReturnType<KnowledgeService['collectSnapshotInputs']>>,
    scope: KnowledgeDocumentScope,
  ) {
    const bundles = input.bundles ?? []
    const negativeExamples = input.negativeExamples ?? []

    return [
      ...this.buildBaseSnapshotEntries(scope),
      ...this.buildDocumentSnapshotEntries(input.documents, scope),
      ...this.buildCandidateSnapshotEntries(input.candidates, scope),
      ...this.buildBundleSnapshotEntries(bundles, scope),
      ...this.buildNegativeExampleSnapshotEntries(negativeExamples, scope),
      ...this.buildGapSnapshotEntries(input.rawEvents, scope),
    ]
  }

  private buildBaseSnapshotEntries(
    scope: KnowledgeDocumentScope,
  ): KnowledgeSnapshotDraftEntry[] {
    const defaults = DEFAULT_RUNTIME_KNOWLEDGE[scope] ?? []

    return defaults.map((entry) => ({
      entryType: KnowledgeSnapshotEntryType.OPERATIONAL_NOTE,
      key: entry.key,
      title: entry.title,
      plainText: entry.plainText,
      topicKey: entry.topicKey,
      priority: 'medium',
      appliesToChannels: entry.appliesToChannels,
      metadata: {
        synthetic: true,
        entryClass: 'default_runtime_rule',
        scope: this.normalizeEnum(scope),
      },
      sources: [
        {
          sourceKind: KnowledgeSnapshotSourceKind.KNOWLEDGE_DOCUMENT,
          sourceId: `system:default-runtime:${this.normalizeEnum(scope)}:${entry.key}`,
          sourceStatus: 'builtin',
          role: KnowledgeSnapshotSourceRole.PRIMARY_SUPPORT,
          excerpt: this.buildSnapshotExcerpt(entry.plainText, 180),
          metadata: {
            synthetic: true,
            label: 'Reglas base del runtime',
            scope: this.normalizeEnum(scope),
          },
        },
      ],
    }))
  }

  private buildDocumentSnapshotEntries(
    documents: Awaited<ReturnType<KnowledgeService['collectSnapshotInputs']>>['documents'],
    scope: KnowledgeDocumentScope,
  ): KnowledgeSnapshotDraftEntry[] {
    return documents.map((document) => {
      const metadata = this.asRecord(document.metadata)
      const normalizedIntent =
        typeof metadata?.detectedIntent === 'string'
          ? metadata.detectedIntent
          : typeof metadata?.intent === 'string'
            ? metadata.intent
            : null
      const topicKey = this.deriveSnapshotTopicKey({
        normalizedIntent,
        title: document.title,
        tags: document.tags,
      })
      const contentType = this.deriveDocumentContentType(document)
      const entryType =
        contentType === 'conversation_response'
          ? KnowledgeSnapshotEntryType.APPROVED_RESPONSE_PATTERN
          : KnowledgeSnapshotEntryType.APPROVED_RULE

      return {
        entryType,
        key: `document:${document.id}`,
        title: document.title,
        plainText: this.buildSnapshotExcerpt(document.summary ?? document.content, 360),
        normalizedIntent,
        topicKey,
        priority: 'medium',
        appliesToChannels: [],
        metadata: {
          sourceType: this.normalizeEnum(document.sourceType),
          contentType,
          tags: document.tags,
        },
        sources: [
          {
            sourceKind: KnowledgeSnapshotSourceKind.KNOWLEDGE_DOCUMENT,
            sourceId: document.id,
            sourceStatus: this.normalizeEnum(document.status),
            role: KnowledgeSnapshotSourceRole.PRIMARY_SUPPORT,
            excerpt: this.buildSnapshotExcerpt(
              document.summary ?? document.content,
              220,
            ),
            metadata: {
              title: document.title,
            },
          },
        ],
      }
    })
  }

  private buildCandidateSnapshotEntries(
    candidates: Awaited<ReturnType<KnowledgeService['collectSnapshotInputs']>>['candidates'],
    scope: KnowledgeDocumentScope,
  ): KnowledgeSnapshotDraftEntry[] {
    return candidates.map((candidate) => {
      const responseText =
        candidate.approvedResponse ??
        candidate.suggestedResponse ??
        candidate.summary ??
        candidate.excerpt
      const channels = new Set<string>()
      if (candidate.observation?.channel) {
        channels.add(this.normalizeVisibleChannel(candidate.observation.channel))
      }
      if (candidate.conversation?.channel) {
        channels.add(this.normalizeVisibleChannel(candidate.conversation.channel))
      }
      const topicKey = this.deriveSnapshotTopicKey({
        normalizedIntent: candidate.detectedIntent ?? null,
        title: candidate.title,
      })

      return {
        entryType: KnowledgeSnapshotEntryType.APPROVED_RESPONSE_PATTERN,
        key: `candidate:${candidate.id}`,
        title: candidate.title,
        plainText: this.buildSnapshotExcerpt(responseText, 360),
        normalizedIntent: candidate.detectedIntent ?? null,
        topicKey,
        confidence: candidate.confidence ?? null,
        priority: 'medium',
        appliesToChannels: [...channels],
        metadata: {
          scope: this.normalizeEnum(scope),
          sourceType: this.normalizeEnum(candidate.sourceType),
          version: candidate.version,
          observationId: candidate.observationId ?? null,
        },
        sources: [
          {
            sourceKind: KnowledgeSnapshotSourceKind.KNOWLEDGE_CANDIDATE,
            sourceId: candidate.id,
            sourceVersion: candidate.version,
            sourceStatus: this.normalizeEnum(candidate.status),
            role: KnowledgeSnapshotSourceRole.PRIMARY_SUPPORT,
            excerpt: this.buildSnapshotExcerpt(responseText, 220),
            metadata: {
              title: candidate.title,
              detectedIntent: candidate.detectedIntent ?? null,
            },
          },
        ],
      }
    })
  }

  private buildBundleSnapshotEntries(
    bundles: Awaited<ReturnType<KnowledgeService['collectSnapshotInputs']>>['bundles'],
    scope: KnowledgeDocumentScope,
  ): KnowledgeSnapshotDraftEntry[] {
    return bundles.map((bundle) => ({
      entryType: KnowledgeSnapshotEntryType.TOPIC_SUMMARY,
      key: `bundle:${bundle.id}`,
      title: bundle.title,
      plainText: this.buildSnapshotExcerpt(
        bundle.summary ??
          `${bundle.eventCount} mensajes/eventos y ${bundle.candidateCount} candidatos relacionados en una secuencia multi-turno aprobada.`,
        360,
      ),
      normalizedIntent: bundle.detectedIntents[0] ?? null,
      topicKey: this.deriveSnapshotTopicKey({
        normalizedIntent: bundle.detectedIntents[0] ?? null,
        title: bundle.title,
      }),
      priority: bundle.approvedCount > 0 ? 'high' : 'medium',
      appliesToChannels: bundle.conversation?.channel
        ? [this.normalizeVisibleChannel(bundle.conversation.channel)]
        : [],
      metadata: {
        scope: this.normalizeEnum(scope),
        eventCount: bundle.eventCount,
        candidateCount: bundle.candidateCount,
        approvedCount: bundle.approvedCount,
        pendingCount: bundle.pendingCount,
      },
      sources: [
        {
          sourceKind: KnowledgeSnapshotSourceKind.KNOWLEDGE_CONVERSATION_BUNDLE,
          sourceId: bundle.id,
          sourceStatus: this.normalizeEnum(bundle.status),
          role: KnowledgeSnapshotSourceRole.SECONDARY_SUPPORT,
          excerpt: this.buildSnapshotExcerpt(
            bundle.summary ?? bundle.previewResponse ?? bundle.previewQuestion,
            220,
          ),
          metadata: {
            conversationId: bundle.conversationId,
            title: bundle.title,
          },
        },
      ],
    }))
  }

  private buildNegativeExampleSnapshotEntries(
    negativeExamples: Awaited<
      ReturnType<KnowledgeService['collectSnapshotInputs']>
    >['negativeExamples'],
    scope: KnowledgeDocumentScope,
  ): KnowledgeSnapshotDraftEntry[] {
    return negativeExamples.map((item) => ({
      entryType: KnowledgeSnapshotEntryType.GUARDRAIL_NEGATIVE,
      key: `negative:${item.id}`,
      title: item.title,
      plainText: this.buildSnapshotExcerpt(
        item.summary ??
          `Evitar reutilizar o priorizar esta formulación: ${item.disallowedText}`,
        360,
      ),
      normalizedIntent: item.detectedIntent ?? null,
      topicKey: this.deriveSnapshotTopicKey({
        normalizedIntent: item.detectedIntent ?? null,
        title: item.title,
      }),
      priority: 'high',
      appliesToChannels: item.channel
        ? [this.normalizeVisibleChannel(item.channel)]
        : [],
      metadata: {
        scope: this.normalizeEnum(scope),
        sourceKind: this.normalizeEnum(item.sourceKind),
        correctedText: item.correctedText ?? null,
      },
      sources: [
        {
          sourceKind: KnowledgeSnapshotSourceKind.KNOWLEDGE_NEGATIVE_EXAMPLE,
          sourceId: item.id,
          sourceStatus: this.normalizeEnum(item.status),
          role: KnowledgeSnapshotSourceRole.GUARDRAIL,
          excerpt: this.buildSnapshotExcerpt(item.disallowedText, 220),
          metadata: {
            title: item.title,
            correctedText: item.correctedText ?? null,
          },
        },
      ],
    }))
  }

  private buildGapSnapshotEntries(
    rawEvents: Awaited<ReturnType<KnowledgeService['collectSnapshotInputs']>>['rawEvents'],
    scope: KnowledgeDocumentScope,
  ): KnowledgeSnapshotDraftEntry[] {
    const relevantRawEvents = rawEvents.filter(
      (event) => !event.candidate || event.candidate.status !== KnowledgeCandidateStatus.APPROVED,
    )
    const grouped = new Map<
      string,
      {
        normalizedIntent: string | null
        items: typeof relevantRawEvents
      }
    >()

    for (const event of relevantRawEvents) {
      const normalizedIntent = event.detectedIntent ?? null
      const key = normalizedIntent ?? 'unclassified'
      const existing = grouped.get(key)
      if (existing) {
        existing.items.push(event)
      } else {
        grouped.set(key, {
          normalizedIntent,
          items: [event],
        })
      }
    }

    return [...grouped.values()].map(({ normalizedIntent, items }) => {
      const title = normalizedIntent
        ? `Vacío detectado: ${normalizedIntent}`
        : 'Vacío detectado sin intención clasificada'
      const channels = [...new Set(items.map((item) => this.normalizeVisibleChannel(item.channel)))]
      const avgConfidence =
        items.reduce((acc, item) => acc + (item.confidence ?? 0), 0) / items.length
      const priority = items.length >= 5 ? 'high' : items.length >= 2 ? 'medium' : 'low'
      const topicKey = this.deriveSnapshotTopicKey({
        normalizedIntent,
        title,
      })

      return {
        entryType: KnowledgeSnapshotEntryType.KNOWN_GAP,
        key: `gap:${normalizedIntent ?? 'unclassified'}`,
        title,
        plainText: normalizedIntent
          ? `Hay ${items.length} observaciones recientes sobre ${normalizedIntent} sin conocimiento aprobado consolidado para este scope.`
          : `Hay ${items.length} observaciones recientes sin intención clasificada y sin conocimiento aprobado consolidado para este scope.`,
        normalizedIntent,
        topicKey,
        confidence: Number.isFinite(avgConfidence) ? avgConfidence : null,
        priority,
        appliesToChannels: channels,
        metadata: {
          scope: this.normalizeEnum(scope),
          rawEventCount: items.length,
        },
        sources: items.slice(0, 5).map((item) => ({
          sourceKind: KnowledgeSnapshotSourceKind.KNOWLEDGE_RAW_EVENT,
          sourceId: item.id,
          sourceStatus: this.normalizeEnum(item.status),
          role: KnowledgeSnapshotSourceRole.PENDING_SIGNAL,
          excerpt: this.buildSnapshotExcerpt(
            item.redactedMessage ?? item.userMessage,
            180,
          ),
          metadata: {
            channel: this.normalizeVisibleChannel(item.channel),
            sourceAuthorType: this.normalizeEnum(item.sourceAuthorType),
            conversationId: item.conversationId ?? null,
          },
        })),
      }
    })
  }

  private mapKnowledgeSnapshot(snapshot: {
    id: string
    tenantKey: string
    scope: KnowledgeDocumentScope
    status: KnowledgeSnapshotStatus
    version: number
    generationReason: string
    summaryText: string | null
    metrics: Prisma.JsonValue | null
    coverageScore: number | null
    metadata: Prisma.JsonValue | null
    generatedAt: Date | null
    createdAt: Date
    updatedAt: Date
    generatedByUser?: {
      id: number
      name: string | null
      email: string
    } | null
    entries?: Array<{
      id: string
      entryType: KnowledgeSnapshotEntryType
      key: string
      title: string
      plainText: string
      normalizedIntent: string | null
      topicKey: string | null
      confidence: number | null
      priority: string | null
      appliesToChannels: string[]
      metadata: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
      sources?: Array<{
        id: string
        sourceKind: KnowledgeSnapshotSourceKind
        sourceId: string
        sourceVersion: number | null
        sourceStatus: string | null
        role: KnowledgeSnapshotSourceRole
        excerpt: string | null
        metadata: Prisma.JsonValue | null
        createdAt: Date
        updatedAt: Date
      }>
    }>
  }) {
    return {
      id: snapshot.id,
      tenantKey: snapshot.tenantKey,
      scope: this.normalizeEnum(snapshot.scope),
      status: this.normalizeEnum(snapshot.status),
      version: snapshot.version,
      generationReason: snapshot.generationReason,
      summaryText: snapshot.summaryText ?? null,
      metrics: snapshot.metrics ?? null,
      coverageScore: snapshot.coverageScore ?? null,
      metadata: snapshot.metadata ?? null,
      generatedAt: snapshot.generatedAt,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      generatedByUser: snapshot.generatedByUser
        ? {
            id: snapshot.generatedByUser.id,
            name: snapshot.generatedByUser.name ?? null,
            email: snapshot.generatedByUser.email,
          }
        : null,
      entries:
        snapshot.entries?.map((entry) => ({
          id: entry.id,
          entryType: this.normalizeEnum(entry.entryType),
          key: entry.key,
          title: entry.title,
          plainText: entry.plainText,
          normalizedIntent: entry.normalizedIntent ?? null,
          topicKey: entry.topicKey ?? null,
          confidence: entry.confidence ?? null,
          priority: entry.priority ?? null,
          appliesToChannels: entry.appliesToChannels ?? [],
          metadata: entry.metadata ?? null,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          sources:
            entry.sources?.map((source) => ({
              id: source.id,
              sourceKind: this.normalizeEnum(source.sourceKind),
              sourceId: source.sourceId,
              sourceVersion: source.sourceVersion ?? null,
              sourceStatus: source.sourceStatus ?? null,
              role: this.normalizeEnum(source.role),
              excerpt: source.excerpt ?? null,
              metadata: source.metadata ?? null,
              createdAt: source.createdAt,
              updatedAt: source.updatedAt,
            })) ?? [],
        })) ?? [],
    }
  }

  private buildKnowledgeSnapshotDiff(
    currentSnapshot: ReturnType<KnowledgeService['mapKnowledgeSnapshot']>,
    compareSnapshot: ReturnType<KnowledgeService['mapKnowledgeSnapshot']> | null,
  ) {
    const currentEntries = new Map(
      currentSnapshot.entries.map((entry) => [entry.key, entry]),
    )
    const compareEntries = new Map(
      (compareSnapshot?.entries ?? []).map((entry) => [entry.key, entry]),
    )

    const added: KnowledgeSnapshotDiffItem[] = []
    const removed: KnowledgeSnapshotDiffItem[] = []
    const changed: Array<{
      key: string
      fields: string[]
      current: KnowledgeSnapshotDiffItem
      previous: KnowledgeSnapshotDiffItem
    }> = []
    let unchangedCount = 0

    for (const [key, currentEntry] of currentEntries) {
      const previousEntry = compareEntries.get(key)
      if (!previousEntry) {
        added.push(this.toSnapshotDiffItem(currentEntry))
        continue
      }

      const changedFields = this.diffSnapshotEntryFields(currentEntry, previousEntry)
      if (changedFields.length === 0) {
        unchangedCount += 1
        continue
      }

      changed.push({
        key,
        fields: changedFields,
        current: this.toSnapshotDiffItem(currentEntry),
        previous: this.toSnapshotDiffItem(previousEntry),
      })
    }

    for (const [key, previousEntry] of compareEntries) {
      if (!currentEntries.has(key)) {
        removed.push(this.toSnapshotDiffItem(previousEntry))
      }
    }

    return {
      snapshot: {
        id: currentSnapshot.id,
        version: currentSnapshot.version,
        generatedAt: currentSnapshot.generatedAt,
        status: currentSnapshot.status,
        scope: currentSnapshot.scope,
      },
      compareTo: compareSnapshot
        ? {
            id: compareSnapshot.id,
            version: compareSnapshot.version,
            generatedAt: compareSnapshot.generatedAt,
            status: compareSnapshot.status,
            scope: compareSnapshot.scope,
          }
        : null,
      summary: {
        added: added.length,
        removed: removed.length,
        changed: changed.length,
        unchanged: unchangedCount,
      },
      added,
      removed,
      changed,
    }
  }

  private diffSnapshotEntryFields(
    currentEntry: ReturnType<KnowledgeService['mapKnowledgeSnapshot']>['entries'][number],
    previousEntry: ReturnType<KnowledgeService['mapKnowledgeSnapshot']>['entries'][number],
  ) {
    const changedFields: string[] = []

    if (currentEntry.title !== previousEntry.title) {
      changedFields.push('title')
    }
    if (currentEntry.plainText !== previousEntry.plainText) {
      changedFields.push('plainText')
    }
    if (currentEntry.entryType !== previousEntry.entryType) {
      changedFields.push('entryType')
    }
    if (currentEntry.topicKey !== previousEntry.topicKey) {
      changedFields.push('topicKey')
    }
    if (currentEntry.normalizedIntent !== previousEntry.normalizedIntent) {
      changedFields.push('normalizedIntent')
    }
    if (
      JSON.stringify(currentEntry.appliesToChannels ?? []) !==
      JSON.stringify(previousEntry.appliesToChannels ?? [])
    ) {
      changedFields.push('appliesToChannels')
    }
    if (
      JSON.stringify(
        (currentEntry.sources ?? []).map((source) => ({
          sourceKind: source.sourceKind,
          sourceId: source.sourceId,
          role: source.role,
          sourceStatus: source.sourceStatus,
          excerpt: source.excerpt,
        })),
      ) !==
      JSON.stringify(
        (previousEntry.sources ?? []).map((source) => ({
          sourceKind: source.sourceKind,
          sourceId: source.sourceId,
          role: source.role,
          sourceStatus: source.sourceStatus,
          excerpt: source.excerpt,
        })),
      )
    ) {
      changedFields.push('sources')
    }

    return changedFields
  }

  private toSnapshotDiffItem(
    entry: ReturnType<KnowledgeService['mapKnowledgeSnapshot']>['entries'][number],
  ): KnowledgeSnapshotDiffItem {
    return {
      key: entry.key,
      title: entry.title,
      entryType: entry.entryType,
      topicKey: entry.topicKey ?? null,
      normalizedIntent: entry.normalizedIntent ?? null,
      plainText: entry.plainText,
      confidence: entry.confidence ?? null,
      appliesToChannels: entry.appliesToChannels ?? [],
      sources: (entry.sources ?? []).map((source) => ({
        sourceKind: source.sourceKind,
        sourceId: source.sourceId,
        role: source.role,
        sourceStatus: source.sourceStatus ?? null,
        excerpt: source.excerpt ?? null,
        metadata: source.metadata ?? null,
      })),
    }
  }

  private renderKnowledgeSnapshotPlainText(snapshot: ReturnType<KnowledgeService['mapKnowledgeSnapshot']>) {
    const activeEntries = snapshot.entries.filter(
      (entry) =>
        entry.entryType !== 'known_gap' && entry.entryType !== 'operational_note',
    )
    const baseEntries = snapshot.entries.filter((entry) => {
      if (entry.entryType !== 'operational_note') {
        return false
      }
      const metadata = this.asRecord(entry.metadata)
      return metadata?.entryClass === 'default_runtime_rule'
    })
    const guardrailEntries = snapshot.entries.filter(
      (entry) => entry.entryType === 'guardrail_negative',
    )
    const gapEntries = snapshot.entries.filter((entry) => entry.entryType === 'known_gap')
    const uniqueSources = new Map<string, { label: string }>()

    for (const entry of snapshot.entries) {
      for (const source of entry.sources) {
        const metadata = this.asRecord(source.metadata)
        const label =
          typeof metadata?.label === 'string'
            ? metadata.label
            : `${source.sourceKind} · ${source.sourceId}`
        const key =
          metadata?.synthetic === true
            ? label
            : `${source.sourceKind}:${source.sourceId}`
        if (!uniqueSources.has(key)) {
          uniqueSources.set(key, {
            label,
          })
        }
      }
    }

    const lines = [
      `Scope: ${snapshot.scope}`,
      `Última actualización: ${snapshot.generatedAt ? formatSnapshotDateTime(snapshot.generatedAt) : 'sin fecha'}`,
      `Versión: ${snapshot.version}`,
    ]

    if (activeEntries.length > 0) {
      lines.push('', 'Qué interpreta hoy el sistema:')
      for (const entry of activeEntries.slice(0, 8)) {
        lines.push(`- ${entry.title}: ${this.buildSnapshotExcerpt(entry.plainText, 140)}`)
      }
    } else {
      lines.push(
        '',
        'Todavía no hay conocimiento aprobado suficiente para este scope. Se mantiene la base operativa predeterminada:',
      )
    }

    if (baseEntries.length > 0) {
      if (activeEntries.length > 0) {
        lines.push('', 'Base operativa predeterminada vigente:')
      }
      for (const entry of baseEntries.slice(0, 8)) {
        lines.push(`- ${entry.title}: ${this.buildSnapshotExcerpt(entry.plainText, 140)}`)
      }
    }

    if (guardrailEntries.length > 0) {
      lines.push('', 'Guardrails activos:')
      for (const entry of guardrailEntries.slice(0, 6)) {
        lines.push(`- ${entry.title}: ${this.buildSnapshotExcerpt(entry.plainText, 140)}`)
      }
    }

    if (uniqueSources.size > 0) {
      lines.push('', 'Fuentes principales:')
      for (const source of [...uniqueSources.values()].slice(0, 12)) {
        lines.push(`- ${source.label}`)
      }
    }

    if (gapEntries.length > 0) {
      lines.push('', 'Vacíos detectados:')
      for (const entry of gapEntries.slice(0, 8)) {
        lines.push(`- ${entry.title}`)
      }
    }

    return lines.join('\n')
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
    const originCategory = this.deriveDocumentOriginCategory(document)
    const contentType = this.deriveDocumentContentType(document)
    return {
      id: document.id,
      tenantKey: document.tenantKey,
      scope: this.normalizeEnum(document.scope),
      sourceType: this.normalizeEnum(document.sourceType),
      status: this.normalizeEnum(document.status),
      originCategory,
      contentType,
      hasEmbedding: document.embedding != null,
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

  private mapCandidate(
    item: {
      id: string
      tenantKey: string
      scope: KnowledgeDocumentScope
      status: KnowledgeCandidateStatus
      sourceType: KnowledgeSourceType
      title: string
      summary: string | null
      excerpt: string
      redactedExcerpt: string | null
      detectedIntent: string | null
      problem: string | null
      contextSummary: string | null
      suggestedResponse: string | null
      approvedResponse: string | null
      confidence: number | null
      dedupeHash: string | null
      clusterKey: string | null
      version: number
      piiDetected: boolean
      metadata: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
      conversation?: {
        id: string
        subject: string | null
        channel: ConversationChannel
      } | null
      observation?: {
        id: string
        status: KnowledgeRawEventStatus
        channel: ConversationChannel
        sourceAuthorType: ConversationMessageAuthorType
        userMessage: string
        operatorReply: string | null
        aiReply: string | null
        messageElements?: Prisma.JsonValue | null
        createdAt: Date
        updatedAt: Date
      } | null
    },
    feedback: KnowledgeSuggestionFeedbackMetrics,
  ) {
    const channel = item.observation
      ? this.normalizeVisibleChannel(item.observation.channel)
      : item.conversation
        ? this.normalizeVisibleChannel(item.conversation.channel)
        : null
    const contentType = this.deriveCandidateContentType(item)
    const originCategory = this.deriveCandidateOriginCategory(item)

    return {
      id: item.id,
      tenantKey: item.tenantKey,
      scope: this.normalizeEnum(item.scope),
      status: this.normalizeEnum(item.status),
      sourceType: this.normalizeEnum(item.sourceType),
      originCategory,
      contentType,
      channel,
      hasFeedback: feedback.total > 0,
      title: item.title,
      summary: item.summary ?? null,
      excerpt: item.excerpt,
      redactedExcerpt: item.redactedExcerpt ?? null,
      detectedIntent: item.detectedIntent ?? null,
      problem: item.problem ?? null,
      contextSummary: item.contextSummary ?? null,
      suggestedResponse: item.suggestedResponse ?? null,
      approvedResponse: item.approvedResponse ?? null,
      confidence: item.confidence ?? null,
      dedupeHash: item.dedupeHash ?? null,
      clusterKey: item.clusterKey ?? null,
      version: item.version,
      piiDetected: item.piiDetected,
      metadata: item.metadata ?? null,
      observation: item.observation
        ? {
            id: item.observation.id,
            status: this.normalizeEnum(item.observation.status),
            channel: this.normalizeEnum(item.observation.channel),
            sourceAuthorType: this.normalizeEnum(item.observation.sourceAuthorType),
            userMessage: item.observation.userMessage,
            operatorReply: item.observation.operatorReply ?? null,
            aiReply: item.observation.aiReply ?? null,
            createdAt: item.observation.createdAt,
            updatedAt: item.observation.updatedAt,
          }
        : null,
      conversation: item.conversation
        ? {
            id: item.conversation.id,
            subject: item.conversation.subject ?? null,
            channel: this.normalizeEnum(item.conversation.channel),
          }
        : null,
      feedback,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }

  private mapRawEvent(item: {
    id: string
    tenantKey: string
    scope: KnowledgeDocumentScope
    channel: ConversationChannel
    sourceAuthorType: ConversationMessageAuthorType
    status: KnowledgeRawEventStatus
    userMessage: string
    normalizedMessage: string
    redactedMessage: string | null
    operatorReply: string | null
    aiReply: string | null
    detectedIntent: string | null
    problem: string | null
    contextSummary: string | null
    suggestedResponse: string | null
    confidence: number | null
    relevanceScore: number | null
    dedupeHash: string | null
    clusterKey: string | null
    messageElements: Prisma.JsonValue | null
    messageContextOrigin: Prisma.JsonValue | null
    attachments: Prisma.JsonValue | null
    metadata: Prisma.JsonValue | null
    createdAt: Date
    updatedAt: Date
    conversation?: {
      id: string
      subject: string | null
      channel: ConversationChannel
      scope: ConversationScope
    } | null
    message?: {
      id: string
      authorType: ConversationMessageAuthorType
      kind: string
      body: string | null
      createdAt: Date
    } | null
    candidate?: {
      id: string
      status: KnowledgeCandidateStatus
      confidence: number | null
      version: number
    } | null
  }) {
    return {
      id: item.id,
      tenantKey: item.tenantKey,
      scope: this.normalizeEnum(item.scope),
      channel: this.normalizeVisibleChannel(item.channel),
      sourceAuthorType: this.normalizeEnum(item.sourceAuthorType),
      status: this.normalizeEnum(item.status),
      userMessage: item.userMessage,
      normalizedMessage: item.normalizedMessage,
      redactedMessage: item.redactedMessage ?? null,
      operatorReply: item.operatorReply ?? null,
      aiReply: item.aiReply ?? null,
      detectedIntent: item.detectedIntent ?? null,
      problem: item.problem ?? null,
      contextSummary: item.contextSummary ?? null,
      suggestedResponse: item.suggestedResponse ?? null,
      confidence: item.confidence ?? null,
      relevanceScore: item.relevanceScore ?? null,
      dedupeHash: item.dedupeHash ?? null,
      clusterKey: item.clusterKey ?? null,
      messageElements: item.messageElements ?? null,
      messageContextOrigin: item.messageContextOrigin ?? null,
      attachments: item.attachments ?? null,
      metadata: item.metadata ?? null,
      conversation: item.conversation
        ? {
            id: item.conversation.id,
            subject: item.conversation.subject ?? null,
            channel: this.normalizeVisibleChannel(item.conversation.channel),
            scope: this.normalizeEnum(item.conversation.scope),
          }
        : null,
      message: item.message
        ? {
            id: item.message.id,
            authorType: this.normalizeEnum(item.message.authorType),
            kind: this.normalizeEnum(item.message.kind),
            body: item.message.body ?? null,
            createdAt: item.message.createdAt,
          }
        : null,
      candidate: item.candidate
        ? {
            id: item.candidate.id,
            status: this.normalizeEnum(item.candidate.status),
            confidence: item.candidate.confidence ?? null,
            version: item.candidate.version,
          }
        : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
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

  private async syncConversationBundleForConversation(
    conversationId: string,
    options?: {
      actorUserId?: number | null
    },
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        tenantKey: true,
        scope: true,
        subject: true,
        channel: true,
        knowledgeRawEvents: {
          orderBy: [{ updatedAt: 'desc' }],
          take: 50,
          select: {
            id: true,
            userMessage: true,
            operatorReply: true,
            aiReply: true,
            suggestedResponse: true,
            detectedIntent: true,
            status: true,
            updatedAt: true,
          },
        },
        knowledgeCandidates: {
          orderBy: [{ updatedAt: 'desc' }],
          take: 50,
          select: {
            id: true,
            title: true,
            status: true,
            detectedIntent: true,
            updatedAt: true,
            approvedResponse: true,
            suggestedResponse: true,
            excerpt: true,
          },
        },
      },
    })

    if (!conversation) {
      return null
    }

    const existing = await this.prisma.knowledgeConversationBundle.findUnique({
      where: { conversationId },
    })

    const eventCount = conversation.knowledgeRawEvents.length
    const candidateCount = conversation.knowledgeCandidates.length
    const approvedCount = conversation.knowledgeCandidates.filter(
      (candidate) => candidate.status === KnowledgeCandidateStatus.APPROVED,
    ).length
    const pendingCount = conversation.knowledgeCandidates.filter(
      (candidate) => candidate.status === KnowledgeCandidateStatus.PENDING,
    ).length
    const signalCount = eventCount + candidateCount

    if (signalCount < 2 && !existing) {
      return null
    }

    const intents = [
      ...new Set(
        [
          ...conversation.knowledgeRawEvents.map((item) => item.detectedIntent),
          ...conversation.knowledgeCandidates.map((item) => item.detectedIntent),
        ].filter((value): value is string => Boolean(value)),
      ),
    ]

    const latestEvent = conversation.knowledgeRawEvents[0] ?? null
    const latestCandidate = conversation.knowledgeCandidates[0] ?? null
    const previewQuestion =
      latestEvent?.userMessage?.trim() ||
      latestCandidate?.excerpt?.trim() ||
      existing?.previewQuestion ||
      'Sin mensaje visible'
    const previewResponse =
      latestEvent?.operatorReply?.trim() ||
      latestEvent?.aiReply?.trim() ||
      latestEvent?.suggestedResponse?.trim() ||
      latestCandidate?.approvedResponse?.trim() ||
      latestCandidate?.suggestedResponse?.trim() ||
      existing?.previewResponse ||
      'Sin respuesta visible'

    const title =
      conversation.subject?.trim() ||
      (intents[0]
        ? `Bundle ${intents[0]}`
        : `Bundle ${this.normalizeVisibleChannel(conversation.channel)} ${conversation.id.slice(-6)}`)

    const summary = [
      `${signalCount} elementos de conversación relacionados.`,
      intents.length > 0 ? `Intents: ${intents.join(', ')}` : null,
      approvedCount > 0 ? `${approvedCount} candidatos aprobados dentro del hilo.` : null,
    ]
      .filter(Boolean)
      .join(' ')

    const data = {
      tenantKey: conversation.tenantKey,
      scope: this.mapKnowledgeScopeFromConversationScope(conversation.scope),
      title,
      summary,
      detectedIntents: intents,
      eventCount,
      candidateCount,
      approvedCount,
      pendingCount,
      previewQuestion,
      previewResponse,
      metadata: this.toJsonValue({
        source: 'conversation-sequence',
        signalCount,
      }),
      createdByUserId: existing?.createdByUserId ?? options?.actorUserId ?? null,
      status: existing?.status ?? KnowledgeConversationBundleStatus.PENDING,
    }

    return existing
      ? this.prisma.knowledgeConversationBundle.update({
          where: { id: existing.id },
          data,
        })
      : this.prisma.knowledgeConversationBundle.create({
          data: {
            ...data,
            conversationId: conversation.id,
          },
        })
  }

  private async syncNegativeExampleFromCandidate(input: {
    candidateId: string
    actorUserId?: number | null
  }) {
    const candidate = await this.prisma.knowledgeCandidate.findUnique({
      where: { id: input.candidateId },
      select: {
        id: true,
        tenantKey: true,
        scope: true,
        status: true,
        title: true,
        summary: true,
        detectedIntent: true,
        suggestedResponse: true,
        approvedResponse: true,
        excerpt: true,
        conversationId: true,
        conversation: {
          select: {
            channel: true,
          },
        },
      },
    })

    if (!candidate || candidate.status !== KnowledgeCandidateStatus.REJECTED) {
      return null
    }

    const existing = await this.prisma.knowledgeNegativeExample.findFirst({
      where: {
        candidateId: candidate.id,
        sourceKind: KnowledgeNegativeExampleSourceKind.REJECTED_CANDIDATE,
      },
    })

    return existing
      ? this.prisma.knowledgeNegativeExample.update({
          where: { id: existing.id },
          data: {
            tenantKey: candidate.tenantKey,
            scope: candidate.scope,
            status: existing.status,
            sourceKind: KnowledgeNegativeExampleSourceKind.REJECTED_CANDIDATE,
            conversationId: candidate.conversationId ?? null,
            title: `Candidate rechazado: ${candidate.title}`,
            summary:
              candidate.summary ??
              'Intercambio rechazado para evitar reuse o promoción como conocimiento.',
            detectedIntent: candidate.detectedIntent ?? null,
            channel: candidate.conversation?.channel ?? null,
            disallowedText:
              candidate.approvedResponse ??
              candidate.suggestedResponse ??
              candidate.excerpt,
            correctedText: null,
            metadata: this.toJsonValue({
              source: 'candidate-review',
            }),
          },
        })
      : this.prisma.knowledgeNegativeExample.create({
          data: {
            tenantKey: candidate.tenantKey,
            scope: candidate.scope,
            status: KnowledgeNegativeExampleStatus.PENDING,
            sourceKind: KnowledgeNegativeExampleSourceKind.REJECTED_CANDIDATE,
            conversationId: candidate.conversationId ?? null,
            candidateId: candidate.id,
            title: `Candidate rechazado: ${candidate.title}`,
            summary:
              candidate.summary ??
              'Intercambio rechazado para evitar reuse o promoción como conocimiento.',
            detectedIntent: candidate.detectedIntent ?? null,
            channel: candidate.conversation?.channel ?? null,
            disallowedText:
              candidate.approvedResponse ??
              candidate.suggestedResponse ??
              candidate.excerpt,
            correctedText: null,
            metadata: this.toJsonValue({
              source: 'candidate-review',
            }),
            createdByUserId: input.actorUserId ?? null,
          },
        })
  }

  private async syncNegativeExampleFromFeedback(
    feedbackId: string,
    actorUserId?: number | null,
  ) {
    const feedback = await this.prisma.knowledgeSuggestionFeedback.findUnique({
      where: { id: feedbackId },
      include: {
        conversation: {
          select: {
            id: true,
            tenantKey: true,
            channel: true,
            scope: true,
            subject: true,
          },
        },
        candidate: {
          select: {
            id: true,
            title: true,
            detectedIntent: true,
            scope: true,
          },
        },
      },
    })

    if (
      !feedback ||
      feedback.outcome !== KnowledgeSuggestionFeedbackOutcome.DISCARDED
    ) {
      return null
    }

    const existing = await this.prisma.knowledgeNegativeExample.findUnique({
      where: { feedbackId: feedback.id },
    })

    const disallowedText =
      feedback.suggestedText?.trim() ||
      feedback.finalText?.trim() ||
      'Sugerencia descartada sin texto visible'

    return existing
      ? this.prisma.knowledgeNegativeExample.update({
          where: { id: existing.id },
          data: {
            tenantKey: feedback.conversation.tenantKey,
            scope: this.mapKnowledgeScopeFromConversationScope(
              feedback.conversation.scope,
            ),
            status: existing.status,
            sourceKind: KnowledgeNegativeExampleSourceKind.DISCARDED_FEEDBACK,
            conversationId: feedback.conversation.id,
            candidateId: feedback.candidate.id,
            title: `Sugerencia descartada: ${feedback.candidate.title}`,
            summary:
              'El operador descartó una sugerencia aprobada. Debe penalizarse en reuse o ranking.',
            detectedIntent: feedback.candidate.detectedIntent ?? null,
            channel: feedback.conversation.channel,
            disallowedText,
            correctedText: feedback.finalText?.trim() || null,
            metadata: this.toJsonValue({
              source: 'suggestion-feedback',
              outcome: this.normalizeEnum(feedback.outcome),
            }),
          },
        })
      : this.prisma.knowledgeNegativeExample.create({
          data: {
            tenantKey: feedback.conversation.tenantKey,
            scope: this.mapKnowledgeScopeFromConversationScope(
              feedback.conversation.scope,
            ),
            status: KnowledgeNegativeExampleStatus.PENDING,
            sourceKind: KnowledgeNegativeExampleSourceKind.DISCARDED_FEEDBACK,
            conversationId: feedback.conversation.id,
            candidateId: feedback.candidate.id,
            feedbackId: feedback.id,
            title: `Sugerencia descartada: ${feedback.candidate.title}`,
            summary:
              'El operador descartó una sugerencia aprobada. Debe penalizarse en reuse o ranking.',
            detectedIntent: feedback.candidate.detectedIntent ?? null,
            channel: feedback.conversation.channel,
            disallowedText,
            correctedText: feedback.finalText?.trim() || null,
            metadata: this.toJsonValue({
              source: 'suggestion-feedback',
              outcome: this.normalizeEnum(feedback.outcome),
            }),
            createdByUserId: actorUserId ?? null,
          },
        })
  }

  private async clearNegativeExampleForCandidate(candidateId: string) {
    const existing = await this.prisma.knowledgeNegativeExample.findFirst({
      where: {
        candidateId,
        sourceKind: KnowledgeNegativeExampleSourceKind.REJECTED_CANDIDATE,
      },
    })

    if (!existing) {
      return null
    }

    return this.prisma.knowledgeNegativeExample.update({
      where: { id: existing.id },
      data: {
        status: KnowledgeNegativeExampleStatus.REJECTED,
        metadata: this.toJsonValue({
          ...(this.asRecord(existing.metadata) ?? {}),
          source: 'candidate-review',
          deactivatedBecause: 'candidate_not_rejected',
        }),
      },
    })
  }

  private mapConversationBundle(item: {
    id: string
    tenantKey: string
    scope: KnowledgeDocumentScope
    status: KnowledgeConversationBundleStatus
    conversationId: string
    title: string
    summary: string | null
    detectedIntents: string[]
    eventCount: number
    candidateCount: number
    approvedCount: number
    pendingCount: number
    previewQuestion: string | null
    previewResponse: string | null
    metadata: Prisma.JsonValue | null
    reviewedAt: Date | null
    createdAt: Date
    updatedAt: Date
    conversation?: {
      id: string
      subject: string | null
      channel: ConversationChannel
      scope: ConversationScope
    } | null
    createdByUser?: {
      id: number
      name: string | null
      email: string
    } | null
    reviewedByUser?: {
      id: number
      name: string | null
      email: string
    } | null
  }) {
    return {
      id: item.id,
      tenantKey: item.tenantKey,
      scope: this.normalizeEnum(item.scope),
      status: this.normalizeEnum(item.status),
      title: item.title,
      summary: item.summary ?? null,
      detectedIntents: item.detectedIntents ?? [],
      eventCount: item.eventCount,
      candidateCount: item.candidateCount,
      approvedCount: item.approvedCount,
      pendingCount: item.pendingCount,
      previewQuestion: item.previewQuestion ?? null,
      previewResponse: item.previewResponse ?? null,
      metadata: item.metadata ?? null,
      reviewedAt: item.reviewedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      conversation: item.conversation
        ? {
            id: item.conversation.id,
            subject: item.conversation.subject ?? null,
            channel: this.normalizeVisibleChannel(item.conversation.channel),
            scope: this.normalizeEnum(item.conversation.scope),
          }
        : null,
      createdByUser: item.createdByUser
        ? {
            id: item.createdByUser.id,
            name: item.createdByUser.name ?? null,
            email: item.createdByUser.email,
          }
        : null,
      reviewedByUser: item.reviewedByUser
        ? {
            id: item.reviewedByUser.id,
            name: item.reviewedByUser.name ?? null,
            email: item.reviewedByUser.email,
          }
        : null,
    }
  }

  private mapNegativeExample(item: {
    id: string
    tenantKey: string
    scope: KnowledgeDocumentScope
    status: KnowledgeNegativeExampleStatus
    sourceKind: KnowledgeNegativeExampleSourceKind
    title: string
    summary: string | null
    detectedIntent: string | null
    channel: ConversationChannel | null
    disallowedText: string
    correctedText: string | null
    metadata: Prisma.JsonValue | null
    reviewedAt: Date | null
    createdAt: Date
    updatedAt: Date
    conversation?: {
      id: string
      subject: string | null
      channel: ConversationChannel
      scope: ConversationScope
    } | null
    candidate?: {
      id: string
      title: string
      detectedIntent: string | null
      status: KnowledgeCandidateStatus
      sourceType: KnowledgeSourceType
      version: number
    } | null
    feedback?: {
      id: string
      outcome: KnowledgeSuggestionFeedbackOutcome
      suggestedText: string | null
      finalText: string | null
      createdAt: Date
    } | null
    createdByUser?: {
      id: number
      name: string | null
      email: string
    } | null
    reviewedByUser?: {
      id: number
      name: string | null
      email: string
    } | null
  }) {
    return {
      id: item.id,
      tenantKey: item.tenantKey,
      scope: this.normalizeEnum(item.scope),
      status: this.normalizeEnum(item.status),
      sourceKind: this.normalizeEnum(item.sourceKind),
      title: item.title,
      summary: item.summary ?? null,
      detectedIntent: item.detectedIntent ?? null,
      channel: item.channel ? this.normalizeVisibleChannel(item.channel) : null,
      disallowedText: item.disallowedText,
      correctedText: item.correctedText ?? null,
      metadata: item.metadata ?? null,
      reviewedAt: item.reviewedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      conversation: item.conversation
        ? {
            id: item.conversation.id,
            subject: item.conversation.subject ?? null,
            channel: this.normalizeVisibleChannel(item.conversation.channel),
            scope: this.normalizeEnum(item.conversation.scope),
          }
        : null,
      candidate: item.candidate
        ? {
            id: item.candidate.id,
            title: item.candidate.title,
            detectedIntent: item.candidate.detectedIntent ?? null,
            status: this.normalizeEnum(item.candidate.status),
            sourceType: this.normalizeEnum(item.candidate.sourceType),
            version: item.candidate.version,
          }
        : null,
      feedback: item.feedback
        ? {
            id: item.feedback.id,
            outcome: this.normalizeEnum(item.feedback.outcome),
            suggestedText: item.feedback.suggestedText ?? null,
            finalText: item.feedback.finalText ?? null,
            createdAt: item.feedback.createdAt,
          }
        : null,
      createdByUser: item.createdByUser
        ? {
            id: item.createdByUser.id,
            name: item.createdByUser.name ?? null,
            email: item.createdByUser.email,
          }
        : null,
      reviewedByUser: item.reviewedByUser
        ? {
            id: item.reviewedByUser.id,
            name: item.reviewedByUser.name ?? null,
            email: item.reviewedByUser.email,
          }
        : null,
    }
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
      case 'web_url':
        return KnowledgeSourceType.WEB_URL
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

  private mapRawEventStatus(status: ListKnowledgeRawEventsDto['status']) {
    switch (status) {
      case 'processed':
        return KnowledgeRawEventStatus.PROCESSED
      case 'discarded':
        return KnowledgeRawEventStatus.DISCARDED
      default:
        return KnowledgeRawEventStatus.NEW
    }
  }

  private mapIngestionRunStatus(status: ListKnowledgeIngestionRunsDto['status']) {
    switch (status) {
      case 'completed':
        return KnowledgeIngestionRunStatus.COMPLETED
      case 'failed':
        return KnowledgeIngestionRunStatus.FAILED
      default:
        return KnowledgeIngestionRunStatus.RUNNING
    }
  }

  private mapConversationBundleStatus(
    status: ListKnowledgeConversationBundlesDto['status'],
  ) {
    switch (status) {
      case 'approved':
        return KnowledgeConversationBundleStatus.APPROVED
      case 'rejected':
        return KnowledgeConversationBundleStatus.REJECTED
      default:
        return KnowledgeConversationBundleStatus.PENDING
    }
  }

  private mapNegativeExampleStatus(
    status: ListKnowledgeNegativeExamplesDto['status'],
  ) {
    switch (status) {
      case 'approved':
        return KnowledgeNegativeExampleStatus.APPROVED
      case 'rejected':
        return KnowledgeNegativeExampleStatus.REJECTED
      default:
        return KnowledgeNegativeExampleStatus.PENDING
    }
  }

  private mapNegativeExampleSourceKind(
    sourceKind: ListKnowledgeNegativeExamplesDto['sourceKind'],
  ) {
    switch (sourceKind) {
      case 'discarded_feedback':
        return KnowledgeNegativeExampleSourceKind.DISCARDED_FEEDBACK
      case 'manual':
        return KnowledgeNegativeExampleSourceKind.MANUAL
      default:
        return KnowledgeNegativeExampleSourceKind.REJECTED_CANDIDATE
    }
  }

  private mapConversationChannel(
    channel?:
      | ListKnowledgeCandidatesDto['channel']
      | ListKnowledgeRawEventsDto['channel']
      | ListKnowledgeFeedbackDto['channel']
      | ListKnowledgeConversationBundlesDto['channel']
      | ListKnowledgeNegativeExamplesDto['channel'],
  ) {
    switch (channel) {
      case 'email':
        return ConversationChannel.EMAIL
      case 'admin_chat':
        return ConversationChannel.ADMIN_CHAT
      case 'whatsapp':
        return ConversationChannel.WHATSAPP
      case 'meta':
        return ConversationChannel.FACEBOOK
      default:
        return ConversationChannel.WEBCHAT
    }
  }

  private mapConversationMessageAuthorType(
    authorType?: ListKnowledgeRawEventsDto['sourceAuthorType'],
  ) {
    switch (authorType) {
      case 'agent':
        return ConversationMessageAuthorType.AGENT
      case 'operator':
        return ConversationMessageAuthorType.OPERATOR
      case 'system':
        return ConversationMessageAuthorType.SYSTEM
      default:
        return ConversationMessageAuthorType.CUSTOMER
    }
  }

  private mapSuggestionFeedbackOutcome(
    outcome?: 'used' | 'edited' | 'discarded' | null,
  ) {
    switch (outcome) {
      case 'used':
        return KnowledgeSuggestionFeedbackOutcome.USED
      case 'edited':
        return KnowledgeSuggestionFeedbackOutcome.EDITED
      case 'discarded':
        return KnowledgeSuggestionFeedbackOutcome.DISCARDED
      default:
        return null
    }
  }

  private mapKnowledgeScopeFromConversationScope(scope: ConversationScope) {
    return scope === ConversationScope.ADMIN_INTERNAL
      ? KnowledgeDocumentScope.ADMIN_INTERNAL
      : KnowledgeDocumentScope.CUSTOMER_PUBLIC
  }

  private resolveKnowledgeCaptureMode(
    message: {
      authorType: ConversationMessageAuthorType
      body: string | null
      normalizedText: string | null
      kind: unknown
      conversation: {
        scope: ConversationScope
      }
    },
    forceObservation: boolean,
  ):
    | { mode: 'source' }
    | {
        mode: 'attach_reply'
        sourceAuthorType: ConversationMessageAuthorType
      }
    | { mode: 'skip'; reason: string } {
    const hasText = Boolean((message.body ?? message.normalizedText ?? '').trim())
    if (!hasText && !forceObservation) {
      return { mode: 'skip', reason: 'message_without_text' }
    }

    if (forceObservation) {
      return { mode: 'source' }
    }

    if (
      message.conversation.scope === ConversationScope.ADMIN_INTERNAL &&
      message.authorType === ConversationMessageAuthorType.OPERATOR
    ) {
      return { mode: 'source' }
    }

    if (
      message.conversation.scope !== ConversationScope.ADMIN_INTERNAL &&
      message.authorType === ConversationMessageAuthorType.CUSTOMER
    ) {
      return { mode: 'source' }
    }

    if (
      message.conversation.scope === ConversationScope.ADMIN_INTERNAL &&
      message.authorType === ConversationMessageAuthorType.AGENT
    ) {
      return {
        mode: 'attach_reply',
        sourceAuthorType: ConversationMessageAuthorType.OPERATOR,
      }
    }

    if (
      message.conversation.scope !== ConversationScope.ADMIN_INTERNAL &&
      (message.authorType === ConversationMessageAuthorType.OPERATOR ||
        message.authorType === ConversationMessageAuthorType.AGENT)
    ) {
      return {
        mode: 'attach_reply',
        sourceAuthorType: ConversationMessageAuthorType.CUSTOMER,
      }
    }

    return { mode: 'skip', reason: 'author_not_eligible' }
  }

  private normalizeKnowledgeText(input: string) {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private normalizeKnowledgeSignalText(input: string) {
    return String(input || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private deriveSnapshotTopicKey(input: {
    normalizedIntent?: string | null
    title?: string | null
    tags?: string[] | null
  }) {
    if (input.normalizedIntent?.trim()) {
      return this.normalizeKnowledgeText(input.normalizedIntent)
    }

    const firstTag = input.tags?.find((tag) => tag.trim())
    if (firstTag) {
      return this.normalizeKnowledgeText(firstTag)
    }

    if (input.title?.trim()) {
      return this.normalizeKnowledgeText(input.title).slice(0, 80)
    }

    return null
  }

  private buildSnapshotExcerpt(input: string | null | undefined, limit: number) {
    const text = (input ?? '').replace(/\s+/g, ' ').trim()
    if (!text) {
      return ''
    }
    if (text.length <= limit) {
      return text
    }
    return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
  }

  private inferSuggestionFeedbackOutcome(input: {
    suggestedText: string | null
    finalText: string | null
  }) {
    const suggestedText = input.suggestedText?.trim() || null
    const finalText = input.finalText?.trim() || null

    if (!finalText) {
      return KnowledgeSuggestionFeedbackOutcome.DISCARDED
    }

    if (!suggestedText) {
      return KnowledgeSuggestionFeedbackOutcome.USED
    }

    return suggestedText === finalText
      ? KnowledgeSuggestionFeedbackOutcome.USED
      : KnowledgeSuggestionFeedbackOutcome.EDITED
  }

  private extractMessageElements(message: {
    metadata?: Prisma.JsonValue | null
    payload?: Prisma.JsonValue | null
  }) {
    const payload = this.asRecord(message.payload)
    const metadata = this.asRecord(message.metadata)
    const fromPayload = Array.isArray(payload?.messageElements) ? payload.messageElements : null
    const fromMetadata = Array.isArray(metadata?.messageElements)
      ? metadata.messageElements
      : null
    return (fromPayload ?? fromMetadata ?? []).filter((entry) => typeof entry === 'object' && entry !== null)
  }

  private extractMessageContextOrigin(message: {
    metadata?: Prisma.JsonValue | null
    payload?: Prisma.JsonValue | null
  }) {
    const payload = this.asRecord(message.payload)
    const metadata = this.asRecord(message.metadata)
    const fromPayload = Array.isArray(payload?.messageContextOrigin)
      ? payload.messageContextOrigin
      : null
    const fromMetadata = Array.isArray(metadata?.messageContextOrigin)
      ? metadata.messageContextOrigin
      : null
    return (fromPayload ?? fromMetadata ?? []).filter((entry) => typeof entry === 'object' && entry !== null)
  }

  private extractMessageAttachments(message: {
    metadata?: Prisma.JsonValue | null
    payload?: Prisma.JsonValue | null
  }) {
    const payload = this.asRecord(message.payload)
    const metadata = this.asRecord(message.metadata)
    const fromPayload = Array.isArray(payload?.attachments) ? payload.attachments : null
    const fromMetadata = Array.isArray(metadata?.attachments)
      ? metadata.attachments
      : null
    return (fromPayload ?? fromMetadata ?? []).filter((entry) => typeof entry === 'object' && entry !== null)
  }

  private buildObservationMetadata(message: {
    id: string
    conversationId: string
    authorType: ConversationMessageAuthorType
    metadata?: Prisma.JsonValue | null
  }) {
    const metadata = this.asRecord(message.metadata)
    return {
      source: 'conversation-message',
      sourceMessageId: message.id,
      sourceAuthorType: this.normalizeEnum(message.authorType),
      ...(metadata ? { messageMetadata: metadata } : {}),
    }
  }

  private buildObservationContextSummary(input: {
    subject: string | null
    scope: ConversationScope
    channel: string
    messageContextOrigin: unknown[]
  }) {
    const parts = [
      input.subject?.trim() ? `Asunto: ${input.subject.trim()}` : null,
      `Scope: ${this.normalizeEnum(input.scope)}`,
      `Canal: ${this.normalizeEnum(input.channel)}`,
      input.messageContextOrigin.length
        ? `Contexto usado: ${input.messageContextOrigin.length} elementos`
        : null,
    ].filter(Boolean)

    return parts.length ? parts.join(' · ') : null
  }

  private buildKnowledgeProblemSummary(input: string) {
    const normalized = input.trim()
    if (!normalized) {
      return null
    }
    return normalized.slice(0, 280)
  }

  private buildKnowledgeDedupeHash(input: {
    scope: ConversationScope
    normalizedMessage: string
    detectedIntent: string | null
  }) {
    return createHash('sha256')
      .update(
        [
          this.normalizeEnum(input.scope),
          input.detectedIntent ?? 'unknown',
          input.normalizedMessage,
        ].join('|'),
      )
      .digest('hex')
  }

  private deriveKnowledgeIntent(input: {
    message: {
      authorType: ConversationMessageAuthorType
      metadata?: Prisma.JsonValue | null
    }
    normalizedMessage: string
    messageElements: unknown[]
  }) {
    const aiMetadata = this.extractKnowledgeAiMetadata(input.message.metadata)
    if (aiMetadata.intent) {
      return aiMetadata.intent
    }

    if (
      /\b(agendar|cita|reunion|visita)\b/.test(input.normalizedMessage)
    ) {
      return 'appointments.create'
    }
    if (/\b(pago|confirmar pago|cobro)\b/.test(input.normalizedMessage)) {
      return 'payments.update_status'
    }
    if (
      /\b(abertura|corrediza|batiente|monoblock|probba|fenix)\b/.test(
        input.normalizedMessage,
      )
    ) {
      return 'aberturas.register'
    }
    if (/\b(presupuesto|cotizacion|cotizacion)\b/.test(input.normalizedMessage)) {
      return 'quotes.create'
    }
    if (input.messageElements.length > 0) {
      return 'conversation.multimodal'
    }

    return null
  }

  private extractKnowledgeAiMetadata(metadata: Prisma.JsonValue | null | undefined) {
    const record = this.asRecord(metadata)
    const aiMemory = this.asRecord(record?.aiMemory)
    const aiAudit = this.asRecord(record?.aiAudit)
    const aiResponse = this.asRecord(record?.aiResponse)
    const auditPayload = this.asRecord(aiResponse?.auditPayload)

    const confidenceCandidate =
      aiAudit?.confidence ?? auditPayload?.confidence ?? null
    const confidence =
      typeof confidenceCandidate === 'number'
        ? confidenceCandidate
        : typeof confidenceCandidate === 'string'
          ? Number(confidenceCandidate)
          : null

    return {
      intent:
        (typeof aiMemory?.intentKey === 'string' && aiMemory.intentKey) ||
        (typeof aiAudit?.intent === 'string' && aiAudit.intent) ||
        (typeof auditPayload?.intent === 'string' && auditPayload.intent) ||
        null,
      confidence: Number.isFinite(confidence) ? confidence : null,
      decisionPath: Array.isArray(aiAudit?.decisionPath)
        ? aiAudit.decisionPath.filter((entry) => typeof entry === 'string')
        : Array.isArray(auditPayload?.decisionPath)
          ? auditPayload.decisionPath.filter((entry) => typeof entry === 'string')
          : [],
    }
  }

  private estimateObservationConfidence(input: {
    messageElements: unknown[]
    detectedIntent: string | null
  }) {
    if (input.detectedIntent && input.messageElements.length > 0) {
      return 0.84
    }
    if (input.detectedIntent) {
      return 0.72
    }
    if (input.messageElements.length > 0) {
      return 0.6
    }
    return 0.48
  }

  private estimateObservationRelevance(input: {
    confidence: number | null
    messageElements: unknown[]
    hasReply: boolean
  }) {
    const base = input.confidence ?? 0.4
    const bonus = (input.messageElements.length > 0 ? 0.1 : 0) + (input.hasReply ? 0.15 : 0)
    return Math.min(1, Number((base + bonus).toFixed(2)))
  }

  private buildCandidateTitle(input: {
    titleOverride?: string
    detectedIntent?: string | null
    subject?: string | null
    problem?: string | null
  }) {
    if (input.titleOverride?.trim()) {
      return input.titleOverride.trim()
    }
    if (input.detectedIntent?.trim()) {
      return input.detectedIntent.trim()
    }
    if (input.subject?.trim()) {
      return input.subject.trim()
    }
    if (input.problem?.trim()) {
      return input.problem.trim().slice(0, 120)
    }
    return 'Conversation-derived knowledge candidate'
  }

  private async syncCandidateFromObservation(
    observation: {
      id: string
      tenantKey: string
      scope: KnowledgeDocumentScope
      userMessage: string
      redactedMessage: string | null
      detectedIntent: string | null
      problem: string | null
      contextSummary: string | null
      suggestedResponse: string | null
      operatorReply: string | null
      aiReply: string | null
      confidence: number | null
      dedupeHash: string | null
      clusterKey: string | null
      conversationId: string | null
      messageId: string | null
      metadata: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
    },
    options?: {
      actorUserId?: number
      titleOverride?: string
      summaryOverride?: string
    },
  ) {
    const existing = await this.prisma.knowledgeCandidate.findUnique({
      where: { observationId: observation.id },
    })

    const suggestedResponse = this.resolveObservationSuggestedResponse(observation)

    if (!suggestedResponse && !existing) {
      return {
        id: null,
        created: false,
      }
    }

    const nextData = {
      tenantKey: observation.tenantKey,
      scope: observation.scope,
      sourceType: KnowledgeSourceType.CONVERSATION_DERIVED,
      status: existing?.status ?? KnowledgeCandidateStatus.PENDING,
      title: this.buildCandidateTitle({
        titleOverride: options?.titleOverride,
        detectedIntent: observation.detectedIntent,
        subject: observation.contextSummary,
        problem: observation.problem,
      }),
      summary: options?.summaryOverride ?? observation.contextSummary ?? existing?.summary ?? null,
      excerpt: observation.userMessage,
      redactedExcerpt: observation.redactedMessage ?? null,
      detectedIntent: observation.detectedIntent ?? null,
      problem: observation.problem ?? null,
      contextSummary: observation.contextSummary ?? null,
      suggestedResponse,
      approvedResponse: existing?.approvedResponse ?? null,
      confidence: observation.confidence ?? existing?.confidence ?? null,
      dedupeHash: observation.dedupeHash ?? null,
      clusterKey: observation.clusterKey ?? null,
      piiDetected:
        (observation.redactedMessage ?? observation.userMessage) !==
        observation.userMessage,
      metadata: this.toJsonValue({
        ...(this.asRecord(existing?.metadata) ?? {}),
        ...(this.asRecord(observation.metadata) ?? {}),
        observationId: observation.id,
        source: 'knowledge-raw-event',
      }),
      conversationId: observation.conversationId,
      messageId: observation.messageId,
      createdByUserId: existing?.createdByUserId ?? options?.actorUserId ?? null,
      observationId: observation.id,
    } satisfies Prisma.KnowledgeCandidateUncheckedCreateInput

    if (!existing) {
      const created = await this.prisma.knowledgeCandidate.create({
        data: nextData,
      })
      return {
        id: created.id,
        created: true,
      }
    }

    const changed =
      existing.title !== nextData.title ||
      existing.summary !== nextData.summary ||
      existing.excerpt !== nextData.excerpt ||
      existing.redactedExcerpt !== nextData.redactedExcerpt ||
      existing.detectedIntent !== nextData.detectedIntent ||
      existing.problem !== nextData.problem ||
      existing.contextSummary !== nextData.contextSummary ||
      existing.suggestedResponse !== nextData.suggestedResponse ||
      existing.confidence !== nextData.confidence ||
      existing.dedupeHash !== nextData.dedupeHash ||
      existing.clusterKey !== nextData.clusterKey

    const updated = await this.prisma.knowledgeCandidate.update({
      where: { id: existing.id },
      data: {
        ...nextData,
        version: changed ? { increment: 1 } : undefined,
      },
    })

    return {
      id: updated.id,
      created: false,
    }
  }

  private resolveObservationSuggestedResponse(observation: {
    operatorReply: string | null
    suggestedResponse: string | null
    aiReply: string | null
  }) {
    return (
      observation.operatorReply ??
      observation.suggestedResponse ??
      observation.aiReply ??
      null
    )
  }

  private async listActiveKnowledgeDerivedArtifacts(input: {
    tenantKey: string
    scope: KnowledgeDocumentScope
    types: KnowledgeDerivedArtifactType[]
  }) {
    if (!input.types.length) {
      return []
    }

    return this.prisma.knowledgeDerivedArtifact.findMany({
      where: {
        tenantKey: input.tenantKey,
        scope: input.scope,
        status: KnowledgeDerivedArtifactStatus.ACTIVE,
        type: {
          in: input.types,
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        type: true,
        sourceDocumentId: true,
        content: true,
        metadata: true,
      },
    })
  }

  private async syncKnowledgeDerivedArtifactsForDocument(document: {
    id: string
    tenantKey: string
    scope: KnowledgeDocumentScope
    status: KnowledgeDocumentStatus
    title: string
    content: string
    tags: string[]
    metadata: Prisma.JsonValue | null
    approvedAt: Date | null
    updatedAt: Date
  }) {
    await this.prisma.knowledgeDerivedArtifact.deleteMany({
      where: {
        sourceDocumentId: document.id,
      },
    })

    if (
      document.status !== KnowledgeDocumentStatus.ACTIVE ||
      !document.approvedAt
    ) {
      return
    }

    const artifacts = this.buildKnowledgeDerivedArtifactsForDocument(document)
    if (!artifacts.length) {
      return
    }

    await this.prisma.knowledgeDerivedArtifact.createMany({
      data: artifacts.map((artifact) => ({
        tenantKey: document.tenantKey,
        scope: document.scope,
        type: artifact.type,
        status: KnowledgeDerivedArtifactStatus.ACTIVE,
        sourceDocumentId: document.id,
        content: artifact.content as Prisma.InputJsonValue,
        metadata: this.toJsonValue(artifact.metadata ?? {}),
      })),
    })
  }

  private buildKnowledgeDerivedArtifactsForDocument(document: {
    id: string
    title: string
    content: string
    tags: string[]
    metadata: Prisma.JsonValue | null
    updatedAt: Date
  }): KnowledgeDerivedArtifactDraft[] {
    const metadata = this.asRecord(document.metadata)
    const topicItems = this.mergeTenantTopicTaxonomyItems([
      ...this.extractExplicitTenantTopicTaxonomyEntries(
        metadata,
        document.id,
      ),
      ...(this.shouldExtractStructuredTenantTopicTaxonomyFromContent(metadata)
        ? this.extractStructuredTenantTopicTaxonomyEntriesFromContent(
            document.content,
            document.id,
          )
        : []),
      ...this.extractDerivedWebFactTopicTaxonomyEntries(document),
    ])
    const quoteProfiles = this.mergeTenantQuoteProfiles([
      ...this.extractExplicitTenantQuoteProfiles(
        metadata,
        document.id,
      ),
      ...this.extractStructuredTenantQuoteProfilesFromContent(
        document.content,
        document.id,
      ),
    ])

    const sourceKind = this.deriveDerivedArtifactSourceKind(document.metadata)
    const baseMetadata = {
      extractor: 'deterministic_document_derivation',
      sourceKind,
      sourceDocumentUpdatedAt: document.updatedAt.toISOString(),
    }

    return this.dedupeKnowledgeDerivedArtifactDrafts([
      ...topicItems.map((item) => ({
        type: KnowledgeDerivedArtifactType.TOPIC_TAXONOMY,
        content: item,
        metadata: {
          ...baseMetadata,
          derivedFromDocumentId:
            metadata?.derivedFromDocumentId ?? null,
        },
      })),
      ...quoteProfiles.map((profile) => ({
        type: KnowledgeDerivedArtifactType.QUOTE_PROFILE_HINTS,
        content: profile,
        metadata: baseMetadata,
      })),
      ...this.buildMeasurementCarrierArtifactsFromQuoteProfiles(
        quoteProfiles,
        baseMetadata,
      ),
      ...this.buildKeywordLexiconArtifactsFromTopicTaxonomyItems(
        topicItems,
        baseMetadata,
      ),
      ...this.buildKeywordLexiconArtifactsFromQuoteProfiles(
        quoteProfiles,
        baseMetadata,
      ),
    ])
  }

  private shouldExtractStructuredTenantTopicTaxonomyFromContent(
    metadata: Record<string, unknown> | null | undefined,
  ) {
    const sourceKind =
      typeof metadata?.sourceKind === 'string' && metadata.sourceKind.trim()
        ? metadata.sourceKind.trim()
        : typeof metadata?.documentKind === 'string' && metadata.documentKind.trim()
          ? metadata.documentKind.trim()
          : null

    return sourceKind !== 'tenant_quote_profiles'
  }

  private dedupeKnowledgeDerivedArtifactDrafts(
    drafts: KnowledgeDerivedArtifactDraft[],
  ) {
    const deduped = new Map<string, KnowledgeDerivedArtifactDraft>()

    for (const draft of drafts) {
      const rawContent = this.asRecord(draft.content)
      const key =
        typeof rawContent?.key === 'string' && rawContent.key.trim()
          ? rawContent.key.trim()
          : typeof rawContent?.label === 'string' && rawContent.label.trim()
            ? `${String(draft.type)}:${this.slugify(String(rawContent.label))}`
            : null
      if (!key) {
        continue
      }

      const identity = `${String(draft.type)}:${key}`
      const current = deduped.get(identity)
      if (!current) {
        deduped.set(identity, draft)
        continue
      }

      deduped.set(identity, {
        ...current,
        content: current.content,
        metadata: {
          ...(current.metadata ?? {}),
          ...(draft.metadata ?? {}),
        },
      })
    }

    return Array.from(deduped.values())
  }

  private deriveDerivedArtifactSourceKind(metadata: Prisma.JsonValue | null) {
    const record = this.asRecord(metadata)
    return typeof record?.sourceKind === 'string' && record.sourceKind.trim()
      ? record.sourceKind.trim()
      : typeof record?.documentKind === 'string' && record.documentKind.trim()
        ? record.documentKind.trim()
        : typeof record?.source === 'string' && record.source.trim()
          ? record.source.trim()
          : 'approved_document'
  }

  private extractStructuredTenantQuoteProfilesFromContent(
    content: string,
    sourceDocumentId: string,
  ): TenantQuoteProfile[] {
    const sections = this.splitMarkdownH2Sections(content)
    if (!sections.length) {
      return []
    }

    return sections
      .map((section) => {
        const raw: Record<string, unknown> = {
          label: section.heading,
          attributes: [],
        }
        let inAttributes = false

        for (const line of section.lines) {
          const normalizedLine = line.trim()
          if (!normalizedLine) {
            continue
          }

          if (/^-\s*atributos:\s*$/iu.test(normalizedLine)) {
            inAttributes = true
            continue
          }

          if (
            inAttributes &&
            /^\s*-\s+/u.test(line) &&
            !/^\s*-\s*(key|familia|aplica a topicos|aplica a tópicos|topic keys|estrategia de pricing|cierre operativo|terminos portadores de medida|términos portadores de medida)\s*:/iu.test(
              line,
            )
          ) {
            const attribute = this.parseStructuredQuoteProfileAttributeLine(
              normalizedLine,
            )
            if (attribute) {
              ;(raw.attributes as unknown[]).push(attribute)
            }
            continue
          }

          inAttributes = false
          const keyMatch = normalizedLine.match(/^-\s*key:\s*(.+)$/iu)
          if (keyMatch) {
            raw.key = keyMatch[1].trim()
            continue
          }
          const familyMatch = normalizedLine.match(/^-\s*familia:\s*(.+)$/iu)
          if (familyMatch) {
            raw.familyLabel = familyMatch[1].trim()
            continue
          }
          const topicLabelsMatch = normalizedLine.match(
            /^-\s*aplica a t[oó]picos:\s*(.+)$/iu,
          )
          if (topicLabelsMatch) {
            raw.appliesToTopicLabels = this.parseCommaSeparatedKnowledgeValues(
              topicLabelsMatch[1],
            )
            continue
          }
          const topicKeysMatch = normalizedLine.match(
            /^-\s*topic keys:\s*(.+)$/iu,
          )
          if (topicKeysMatch) {
            raw.appliesToTopicKeys = this.parseCommaSeparatedKnowledgeValues(
              topicKeysMatch[1],
            )
            continue
          }
          const pricingMatch = normalizedLine.match(
            /^-\s*estrategia de pricing:\s*(.+)$/iu,
          )
          if (pricingMatch) {
            raw.pricingStrategy = pricingMatch[1].trim()
            continue
          }
          const closureMatch = normalizedLine.match(
            /^-\s*cierre operativo:\s*(.+)$/iu,
          )
          if (closureMatch) {
            raw.closureMode = closureMatch[1].trim()
            continue
          }
          const carriersMatch = normalizedLine.match(
            /^-\s*t[eé]rminos portadores de medida:\s*(.+)$/iu,
          )
          if (carriersMatch) {
            raw.measurementCarrierTerms =
              this.parseCommaSeparatedKnowledgeValues(carriersMatch[1])
            continue
          }
        }

        return this.normalizeExplicitTenantQuoteProfileEntry(raw, sourceDocumentId)
      })
      .filter((entry): entry is TenantQuoteProfile => Boolean(entry))
  }

  private parseStructuredQuoteProfileAttributeLine(line: string) {
    const payload = line.replace(/^\s*-\s+/u, '').trim()
    if (!payload) {
      return null
    }

    const parts = payload.split(/\s+·\s+/u).map((part) => part.trim())
    if (parts.length < 4) {
      return null
    }

    const keyMatch = parts[1]?.match(/^\[([a-z0-9_]+)\]$/iu)
    const captureMatch = parts.find((part) => part.startsWith('capture:'))
    if (!keyMatch?.[1] || !captureMatch) {
      return null
    }

    const optionsPart = parts.find((part) => part.startsWith('options:'))
    return {
      key: keyMatch[1],
      label: parts[0],
      required: parts.includes('required'),
      captureKind: captureMatch.replace(/^capture:/u, '').trim(),
      taxonomyTag:
        parts
          .find((part) => part.startsWith('taxonomy:'))
          ?.replace(/^taxonomy:/u, '')
          .trim() || null,
      subjectPrefix:
        parts
          .find((part) => part.startsWith('prefix:'))
          ?.replace(/^prefix:/u, '')
          .trim() || null,
      options: optionsPart
        ? this.parseCommaSeparatedKnowledgeValues(
            optionsPart.replace(/^options:/u, ''),
          )
        : [],
    }
  }

  private extractStructuredTenantTopicTaxonomyEntriesFromContent(
    content: string,
    sourceDocumentId: string,
  ): TenantTopicTaxonomyItem[] {
    const sections = this.splitMarkdownH2Sections(content)
    if (!sections.length) {
      return []
    }

    return sections
      .map((section) => {
        const raw: Record<string, unknown> = {
          label: section.heading,
        }
        let matched = false

        for (const line of section.lines) {
          const normalizedLine = line.trim()
          if (!normalizedLine) {
            continue
          }

          const kindMatch = normalizedLine.match(/^-\s*kind:\s*(.+)$/iu)
          if (kindMatch) {
            raw.kind = kindMatch[1].trim()
            matched = true
            continue
          }
          const keyMatch = normalizedLine.match(/^-\s*key:\s*(.+)$/iu)
          if (keyMatch) {
            raw.key = keyMatch[1].trim()
            matched = true
            continue
          }
          const aliasesMatch = normalizedLine.match(/^-\s*aliases:\s*(.+)$/iu)
          if (aliasesMatch) {
            raw.aliases = this.parseCommaSeparatedKnowledgeValues(aliasesMatch[1])
            matched = true
            continue
          }
          const normalizationMatch = normalizedLine.match(
            /^-\s*normalization value:\s*(.+)$/iu,
          )
          if (normalizationMatch) {
            raw.normalizationValue = normalizationMatch[1].trim()
            matched = true
            continue
          }
          const familyMatch = normalizedLine.match(/^-\s*familia:\s*(.+)$/iu)
          if (familyMatch) {
            raw.familyLabel = familyMatch[1].trim()
            matched = true
            continue
          }
          const parentKeysMatch = normalizedLine.match(
            /^-\s*parent keys:\s*(.+)$/iu,
          )
          if (parentKeysMatch) {
            raw.parentKeys = this.parseCommaSeparatedKnowledgeValues(
              parentKeysMatch[1],
            )
            matched = true
            continue
          }
          const parentLabelsMatch = normalizedLine.match(
            /^-\s*parent labels:\s*(.+)$/iu,
          )
          if (parentLabelsMatch) {
            raw.parentLabels = this.parseCommaSeparatedKnowledgeValues(
              parentLabelsMatch[1],
            )
            matched = true
            continue
          }
          const tagsMatch = normalizedLine.match(/^-\s*tags:\s*(.+)$/iu)
          if (tagsMatch) {
            raw.tags = this.parseCommaSeparatedKnowledgeValues(tagsMatch[1])
            matched = true
          }
        }

        if (!matched) {
          return null
        }

        return this.normalizeExplicitTenantTopicTaxonomyEntry(raw, sourceDocumentId)
      })
      .filter((entry): entry is TenantTopicTaxonomyItem => Boolean(entry))
  }

  private extractDerivedWebFactTopicTaxonomyEntries(document: {
    id: string
    title: string
    tags: string[]
    metadata: Prisma.JsonValue | null
  }): TenantTopicTaxonomyItem[] {
    const metadata = this.asRecord(document.metadata)
    const factType =
      typeof metadata?.factType === 'string'
        ? this.normalizeKnowledgeSignalText(metadata.factType)
        : typeof metadata?.topicType === 'string'
          ? this.normalizeKnowledgeSignalText(metadata.topicType)
          : null
    const kind =
      factType === 'product_topic' || factType === 'product_variant'
        ? (factType as Exclude<TenantTopicTaxonomyKind, 'product_family'>)
        : Array.isArray(document.tags) && document.tags.includes('product_topic')
          ? 'product_topic'
          : Array.isArray(document.tags) && document.tags.includes('product_variant')
            ? 'product_variant'
            : null

    if (!kind) {
      return []
    }

    const label = this.extractTenantTopicTaxonomyLabel(document.title, metadata)
    if (!label) {
      return []
    }

    const normalizedLabel = this.normalizeKnowledgeSignalText(label)
    if (!normalizedLabel) {
      return []
    }

    const familyLabel =
      kind === 'product_topic' ? this.deriveTopicFamilyLabel(label) : null
    const familyKey =
      familyLabel && familyLabel !== normalizedLabel
        ? `product_family:${this.slugify(familyLabel)}`
        : familyLabel
          ? `product_family:${this.slugify(familyLabel)}`
          : null

    return [
      {
        key: `${kind}:${this.slugify(normalizedLabel)}`,
        label,
        kind,
        aliases: this.buildTenantTopicAliases({
          label,
          tags: Array.isArray(document.tags) ? document.tags : [],
          metadata,
        }).sort(),
        normalizationValue: this.resolveTenantTopicNormalizationValue({
          kind,
          label,
          metadata,
        }),
        parentKeys:
          kind === 'product_topic' && familyKey ? [familyKey] : [],
        parentLabels:
          kind === 'product_topic' && familyLabel ? [familyLabel] : [],
        familyLabel: familyLabel ?? null,
        tags: Array.from(
          new Set(
            (Array.isArray(document.tags) ? document.tags : [])
              .map((tag) => this.normalizeKnowledgeSignalText(tag))
              .filter(
                (tag) => tag && !this.isTopicTaxonomyGenericAlias(tag),
              ),
          ),
        ).sort(),
        sourceDocumentIds: [document.id],
      },
    ]
  }

  private splitMarkdownH2Sections(content: string) {
    const lines = String(content || '').split('\n')
    const sections: Array<{ heading: string; lines: string[] }> = []
    let current: { heading: string; lines: string[] } | null = null

    for (const line of lines) {
      const headingMatch = line.match(/^##\s+(.+)$/u)
      if (headingMatch) {
        if (current) {
          sections.push(current)
        }
        current = {
          heading: headingMatch[1].trim(),
          lines: [],
        }
        continue
      }

      if (current) {
        current.lines.push(line)
      }
    }

    if (current) {
      sections.push(current)
    }

    return sections
  }

  private parseCommaSeparatedKnowledgeValues(value: string) {
    return String(value || '')
      .split(',')
      .map((entry) => entry.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  }

  private buildMeasurementCarrierArtifactsFromQuoteProfiles(
    profiles: TenantQuoteProfile[],
    baseMetadata: Record<string, unknown>,
  ): KnowledgeDerivedArtifactDraft[] {
    return profiles
      .filter((profile) => profile.measurementCarrierTerms.length > 0)
      .map((profile) => ({
        type: KnowledgeDerivedArtifactType.MEASUREMENT_CARRIER_TERMS,
        content: {
          key: `measurement_carriers:${profile.key}`,
          label: profile.label,
          quoteProfileKey: profile.key,
          appliesToTopicKeys: profile.appliesToTopicKeys,
          appliesToTopicLabels: profile.appliesToTopicLabels,
          measurementCarrierTerms: profile.measurementCarrierTerms,
          sourceDocumentIds: profile.sourceDocumentIds,
        },
        metadata: {
          ...baseMetadata,
          quoteProfileKey: profile.key,
        },
      }))
  }

  private buildKeywordLexiconArtifactsFromTopicTaxonomyItems(
    items: TenantTopicTaxonomyItem[],
    baseMetadata: Record<string, unknown>,
  ): KnowledgeDerivedArtifactDraft[] {
    return items.map((item) => ({
      type: KnowledgeDerivedArtifactType.KEYWORD_LEXICON,
      content: {
        key: `lexicon:${item.key}`,
        label: item.label,
        aliases: Array.from(
          new Set(
            [item.label, ...(Array.isArray(item.aliases) ? item.aliases : [])]
              .map((alias) => this.normalizeKnowledgeSignalText(alias))
              .filter(Boolean),
          ),
        ).sort(),
        topicKey: item.key,
        quoteProfileKey: null,
        taxonomyTag: null,
        sourceDocumentIds: item.sourceDocumentIds,
      },
      metadata: baseMetadata,
    }))
  }

  private buildKeywordLexiconArtifactsFromQuoteProfiles(
    profiles: TenantQuoteProfile[],
    baseMetadata: Record<string, unknown>,
  ): KnowledgeDerivedArtifactDraft[] {
    const artifacts: KnowledgeDerivedArtifactDraft[] = []

    for (const profile of profiles) {
      artifacts.push({
        type: KnowledgeDerivedArtifactType.KEYWORD_LEXICON,
        content: {
          key: `lexicon:${profile.key}`,
          label: profile.label,
          aliases: Array.from(
            new Set(
              [
                profile.label,
                ...profile.appliesToTopicLabels,
                profile.familyLabel ?? '',
              ]
                .map((entry) => this.normalizeKnowledgeSignalText(entry))
                .filter(Boolean),
            ),
          ).sort(),
          topicKey: profile.appliesToTopicKeys[0] ?? null,
          quoteProfileKey: profile.key,
          taxonomyTag: null,
          sourceDocumentIds: profile.sourceDocumentIds,
        },
        metadata: baseMetadata,
      })

      for (const attribute of profile.attributes) {
        const aliases = new Set<string>()
        const normalizedLabel = this.normalizeKnowledgeSignalText(attribute.label)
        if (normalizedLabel) {
          aliases.add(normalizedLabel)
        }
        if (attribute.subjectPrefix) {
          const prefix = this.normalizeKnowledgeSignalText(attribute.subjectPrefix)
          if (prefix) {
            aliases.add(prefix)
          }
        }
        for (const option of attribute.options) {
          const value = this.normalizeKnowledgeSignalText(option.value)
          if (value) {
            aliases.add(value)
          }
          for (const alias of option.aliases) {
            const normalizedAlias = this.normalizeKnowledgeSignalText(alias)
            if (normalizedAlias) {
              aliases.add(normalizedAlias)
            }
          }
        }

        if (!aliases.size) {
          continue
        }

        artifacts.push({
          type: KnowledgeDerivedArtifactType.KEYWORD_LEXICON,
          content: {
            key: `lexicon:${profile.key}:${attribute.key}`,
            label: attribute.label,
            aliases: Array.from(aliases).sort(),
            topicKey: profile.appliesToTopicKeys[0] ?? null,
            quoteProfileKey: profile.key,
            taxonomyTag: attribute.taxonomyTag,
            sourceDocumentIds: profile.sourceDocumentIds,
          },
          metadata: {
            ...baseMetadata,
            quoteProfileKey: profile.key,
            attributeKey: attribute.key,
          },
        })
      }
    }

    return artifacts
  }

  private extractTenantTopicTaxonomyItemsFromArtifacts(
    artifacts: Array<{
      type: KnowledgeDerivedArtifactType
      sourceDocumentId: string
      content: Prisma.JsonValue
      metadata: Prisma.JsonValue | null
    }>,
  ) {
    const rawItems = new Map<
      string,
      {
        item: TenantTopicTaxonomyItem
        derivedFromDocumentId: string | null
      }
    >()

    for (const artifact of artifacts) {
      if (artifact.type !== KnowledgeDerivedArtifactType.TOPIC_TAXONOMY) {
        continue
      }

      const item = this.normalizeExplicitTenantTopicTaxonomyEntry(
        artifact.content,
        artifact.sourceDocumentId,
      )
      if (!item) {
        continue
      }

      const metadata = this.asRecord(artifact.metadata)
      rawItems.set(item.key, {
        item,
        derivedFromDocumentId:
          typeof metadata?.derivedFromDocumentId === 'string'
            ? metadata.derivedFromDocumentId
            : null,
      })
    }

    const sourceTopics = new Map<string, Set<string>>()
    const familyItems = new Map<string, TenantTopicTaxonomyItem>()

    for (const entry of rawItems.values()) {
      if (entry.item.kind === 'product_topic' && entry.derivedFromDocumentId) {
        const current =
          sourceTopics.get(entry.derivedFromDocumentId) ?? new Set<string>()
        current.add(entry.item.key)
        sourceTopics.set(entry.derivedFromDocumentId, current)
      }

      if (entry.item.kind !== 'product_topic' || !entry.item.familyLabel) {
        continue
      }

      const familyKey = `product_family:${this.slugify(entry.item.familyLabel)}`
      const current =
        familyItems.get(familyKey) ??
        {
          key: familyKey,
          label: entry.item.familyLabel,
          kind: 'product_family' as const,
          aliases: [entry.item.familyLabel],
          normalizationValue: entry.item.familyLabel,
          parentKeys: [],
          parentLabels: [],
          familyLabel: entry.item.familyLabel,
          tags: [],
          sourceDocumentIds: [],
        }

      current.aliases = Array.from(
        new Set([...current.aliases, ...entry.item.tags, entry.item.familyLabel]),
      ).sort()
      current.tags = Array.from(
        new Set([...current.tags, ...entry.item.tags]),
      ).sort()
      current.sourceDocumentIds = Array.from(
        new Set([...current.sourceDocumentIds, ...entry.item.sourceDocumentIds]),
      ).sort()
      familyItems.set(familyKey, current)

      entry.item.parentKeys = Array.from(
        new Set([...entry.item.parentKeys, familyKey]),
      ).sort()
      entry.item.parentLabels = Array.from(
        new Set([...entry.item.parentLabels, entry.item.familyLabel]),
      ).sort()
    }

    for (const entry of rawItems.values()) {
      if (entry.item.kind !== 'product_variant' || !entry.derivedFromDocumentId) {
        continue
      }

      const topicKeys = sourceTopics.get(entry.derivedFromDocumentId)
      if (!topicKeys?.size) {
        continue
      }

      for (const topicKey of topicKeys) {
        const parent = rawItems.get(topicKey)?.item
        if (!parent) {
          continue
        }

        entry.item.parentKeys = Array.from(
          new Set([...entry.item.parentKeys, parent.key, ...parent.parentKeys]),
        ).sort()
        entry.item.parentLabels = Array.from(
          new Set([
            ...entry.item.parentLabels,
            parent.label,
            ...parent.parentLabels,
          ]),
        ).sort()
        entry.item.familyLabel = entry.item.familyLabel || parent.familyLabel
      }
    }

    return this.mergeTenantTopicTaxonomyItems([
      ...familyItems.values(),
      ...Array.from(rawItems.values()).map((entry) => entry.item),
    ])
  }

  private applyDerivedKeywordLexiconToTopicTaxonomyItems(
    items: TenantTopicTaxonomyItem[],
    artifacts: Array<{
      type: KnowledgeDerivedArtifactType
      content: Prisma.JsonValue
      metadata?: Prisma.JsonValue | null
    }>,
  ) {
    const aliasMap = new Map<string, Set<string>>()

    for (const artifact of artifacts) {
      if (artifact.type !== KnowledgeDerivedArtifactType.KEYWORD_LEXICON) {
        continue
      }

      const raw = this.asRecord(artifact.content)
      const metadata = this.asRecord(artifact.metadata)
      if (
        typeof metadata?.attributeKey === 'string' &&
        metadata.attributeKey.trim().length > 0
      ) {
        continue
      }
      const topicKey =
        typeof raw?.topicKey === 'string' && raw.topicKey.trim()
          ? raw.topicKey.trim()
          : null
      if (!topicKey) {
        continue
      }

      const aliases = Array.isArray(raw?.aliases)
        ? raw.aliases
            .map((alias) => this.normalizeKnowledgeSignalText(String(alias || '')))
            .filter(Boolean)
        : []
      if (!aliases.length) {
        continue
      }

      const current = aliasMap.get(topicKey) ?? new Set<string>()
      for (const alias of aliases) {
        current.add(alias)
      }
      aliasMap.set(topicKey, current)
    }

    return items.map((item) => {
      const derivedAliases = aliasMap.get(item.key)
      if (!derivedAliases?.size) {
        return item
      }

      return {
        ...item,
        aliases: Array.from(
          new Set([...item.aliases, ...derivedAliases]),
        ).sort(),
      }
    })
  }

  private extractTenantQuoteProfilesFromArtifacts(
    artifacts: Array<{
      type: KnowledgeDerivedArtifactType
      sourceDocumentId: string
      content: Prisma.JsonValue
    }>,
  ) {
    return artifacts
      .filter(
        (artifact) =>
          artifact.type === KnowledgeDerivedArtifactType.QUOTE_PROFILE_HINTS,
      )
      .map((artifact) =>
        this.normalizeExplicitTenantQuoteProfileEntry(
          artifact.content,
          artifact.sourceDocumentId,
        ),
      )
      .filter((entry): entry is TenantQuoteProfile => Boolean(entry))
  }

  private applyDerivedMeasurementCarrierArtifactsToQuoteProfiles(
    profiles: TenantQuoteProfile[],
    artifacts: Array<{
      type: KnowledgeDerivedArtifactType
      content: Prisma.JsonValue
    }>,
  ) {
    const carriersByProfile = new Map<string, Set<string>>()

    for (const artifact of artifacts) {
      if (
        artifact.type !== KnowledgeDerivedArtifactType.MEASUREMENT_CARRIER_TERMS
      ) {
        continue
      }

      const raw = this.asRecord(artifact.content)
      const quoteProfileKey =
        typeof raw?.quoteProfileKey === 'string' && raw.quoteProfileKey.trim()
          ? raw.quoteProfileKey.trim()
          : null
      if (!quoteProfileKey) {
        continue
      }

      const terms = Array.isArray(raw?.measurementCarrierTerms)
        ? raw.measurementCarrierTerms
            .map((entry) => this.normalizeKnowledgeSignalText(String(entry || '')))
            .filter(Boolean)
        : []
      if (!terms.length) {
        continue
      }

      const current = carriersByProfile.get(quoteProfileKey) ?? new Set<string>()
      for (const term of terms) {
        current.add(term)
      }
      carriersByProfile.set(quoteProfileKey, current)
    }

    return profiles.map((profile) => {
      const derivedTerms = carriersByProfile.get(profile.key)
      if (!derivedTerms?.size) {
        return profile
      }

      return {
        ...profile,
        measurementCarrierTerms: Array.from(
          new Set([...profile.measurementCarrierTerms, ...derivedTerms]),
        ).sort(),
      }
    })
  }

  private buildTenantTopicTaxonomyItems(
    documents: Array<{
      id: string
      title: string
      tags: string[]
      metadata?: Prisma.JsonValue | null
    }>,
  ): TenantTopicTaxonomyItem[] {
    type RawTopicItem = {
      key: string
      label: string
      kind: Exclude<TenantTopicTaxonomyKind, 'product_family'>
      aliases: Set<string>
      normalizationValue: string | null
      tags: Set<string>
      sourceDocumentIds: Set<string>
      sourceFactDocumentIds: Set<string>
      derivedFromDocumentId: string | null
      familyLabel: string | null
      familyKey: string | null
      parentKeys: Set<string>
      parentLabels: Set<string>
    }

    const rawItems = new Map<string, RawTopicItem>()
    const sourceTopics = new Map<string, Set<string>>()
    const explicitItems: TenantTopicTaxonomyItem[] = []

    for (const document of documents) {
      const metadata = this.asRecord(document.metadata)
      explicitItems.push(
        ...this.extractExplicitTenantTopicTaxonomyEntries(
          metadata,
          document.id,
        ),
      )
      const factType =
        typeof metadata?.factType === 'string'
          ? this.normalizeKnowledgeSignalText(metadata.factType)
          : typeof metadata?.topicType === 'string'
            ? this.normalizeKnowledgeSignalText(metadata.topicType)
            : null
      const kind =
        factType === 'product_topic' || factType === 'product_variant'
          ? (factType as RawTopicItem['kind'])
          : Array.isArray(document.tags) && document.tags.includes('product_topic')
            ? 'product_topic'
            : Array.isArray(document.tags) && document.tags.includes('product_variant')
              ? 'product_variant'
              : null

      if (!kind) {
        continue
      }

      const label = this.extractTenantTopicTaxonomyLabel(document.title, metadata)
      if (!label) {
        continue
      }

      const normalizedLabel = this.normalizeKnowledgeSignalText(label)
      if (!normalizedLabel) {
        continue
      }

      const key = `${kind}:${this.slugify(normalizedLabel)}`
      const aliases = this.buildTenantTopicAliases({
        label,
        tags: Array.isArray(document.tags) ? document.tags : [],
        metadata,
      })
      const familyLabel =
        kind === 'product_topic'
          ? this.deriveTopicFamilyLabel(label)
          : null
      const familyKey =
        familyLabel && familyLabel !== normalizedLabel
          ? `product_family:${this.slugify(familyLabel)}`
          : familyLabel
            ? `product_family:${this.slugify(familyLabel)}`
            : null
      const rawItem =
        rawItems.get(key) ??
        {
          key,
          label,
          kind,
          aliases: new Set<string>(),
          normalizationValue: null,
          tags: new Set<string>(),
          sourceDocumentIds: new Set<string>(),
          sourceFactDocumentIds: new Set<string>(),
          derivedFromDocumentId:
            typeof metadata?.derivedFromDocumentId === 'string'
              ? String(metadata.derivedFromDocumentId)
              : null,
          familyLabel: familyLabel ?? null,
          familyKey,
          parentKeys: new Set<string>(),
          parentLabels: new Set<string>(),
        }

      for (const alias of aliases) {
        rawItem.aliases.add(alias)
      }
      const normalizationValue = this.resolveTenantTopicNormalizationValue({
        kind,
        label,
        metadata,
      })
      if (normalizationValue) {
        rawItem.normalizationValue = normalizationValue
      }
      for (const tag of Array.isArray(document.tags) ? document.tags : []) {
        const normalizedTag = this.normalizeKnowledgeSignalText(tag)
        if (normalizedTag && !this.isTopicTaxonomyGenericAlias(normalizedTag)) {
          rawItem.tags.add(normalizedTag)
        }
      }
      rawItem.sourceDocumentIds.add(document.id)
      if (rawItem.derivedFromDocumentId) {
        rawItem.sourceFactDocumentIds.add(rawItem.derivedFromDocumentId)
      }
      rawItems.set(key, rawItem)

      if (rawItem.derivedFromDocumentId && kind === 'product_topic') {
        const current =
          sourceTopics.get(rawItem.derivedFromDocumentId) ?? new Set<string>()
        current.add(key)
        sourceTopics.set(rawItem.derivedFromDocumentId, current)
      }
    }

    const familyItems = new Map<string, TenantTopicTaxonomyItem>()
    for (const item of rawItems.values()) {
      if (item.kind !== 'product_topic' || !item.familyLabel || !item.familyKey) {
        continue
      }

      const family =
        familyItems.get(item.familyKey) ??
        {
          key: item.familyKey,
          label: item.familyLabel,
          kind: 'product_family' as const,
          aliases: [],
          normalizationValue: item.familyLabel,
          parentKeys: [],
          parentLabels: [],
          familyLabel: item.familyLabel,
          tags: [],
          sourceDocumentIds: [],
        }
      const aliases = new Set(family.aliases)
      aliases.add(item.familyLabel)
      const singularFamilyAlias = this.singularizeTopicAlias(item.familyLabel)
      if (
        singularFamilyAlias &&
        !this.isTopicTaxonomyGenericAlias(singularFamilyAlias)
      ) {
        aliases.add(singularFamilyAlias)
      }
      for (const tag of item.tags) {
        if (!this.isTopicTaxonomyGenericAlias(tag)) {
          aliases.add(tag)
        }
      }
      family.aliases = Array.from(aliases).sort()
      family.tags = Array.from(new Set([...family.tags, ...item.tags])).sort()
      family.sourceDocumentIds = Array.from(
        new Set([...family.sourceDocumentIds, ...item.sourceDocumentIds]),
      ).sort()
      familyItems.set(item.familyKey, family)

      item.parentKeys.add(item.familyKey)
      item.parentLabels.add(item.familyLabel)
    }

    for (const item of rawItems.values()) {
      if (item.kind !== 'product_variant') {
        continue
      }

      for (const sourceId of item.sourceFactDocumentIds) {
        const topicKeys = sourceTopics.get(sourceId)
        if (!topicKeys?.size) {
          continue
        }

        for (const topicKey of topicKeys) {
          const topic = rawItems.get(topicKey)
          if (!topic) {
            continue
          }
          item.parentKeys.add(topic.key)
          item.parentLabels.add(topic.label)
          if (topic.familyKey && topic.familyLabel) {
            item.parentKeys.add(topic.familyKey)
            item.parentLabels.add(topic.familyLabel)
          }
        }
      }
    }

    const topicItems = Array.from(rawItems.values()).map((item) => {
      const parentKeys = Array.from(item.parentKeys).sort()
      const parentLabels = Array.from(item.parentLabels).sort()
      const familyParentKey = parentKeys.find((value) =>
        value.startsWith('product_family:'),
      )
      const resolvedFamilyLabel =
        item.familyLabel ??
        (familyParentKey ? familyItems.get(familyParentKey)?.label ?? null : null)

      return {
        key: item.key,
        label: item.label,
        kind: item.kind,
        aliases: Array.from(item.aliases).sort(),
        normalizationValue: item.normalizationValue ?? null,
        parentKeys,
        parentLabels,
        familyLabel: resolvedFamilyLabel,
        tags: Array.from(item.tags).sort(),
        sourceDocumentIds: Array.from(item.sourceDocumentIds).sort(),
      }
    })

    return this.mergeTenantTopicTaxonomyItems([
      ...explicitItems,
      ...familyItems.values(),
      ...topicItems,
    ]).sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
    )
  }

  private buildTenantQuoteProfiles(
    documents: Array<{
      id: string
      metadata: Prisma.JsonValue | null
    }>,
  ): TenantQuoteProfile[] {
    const profiles = documents.flatMap((document) =>
      this.extractExplicitTenantQuoteProfiles(
        this.asRecord(document.metadata),
        document.id,
      ),
    )

    return this.mergeTenantQuoteProfiles(profiles).sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
    )
  }

  private extractExplicitTenantQuoteProfiles(
    metadata: Record<string, unknown> | null,
    sourceDocumentId: string,
  ): TenantQuoteProfile[] {
    const rawEntries = Array.isArray(metadata?.quoteProfiles)
      ? metadata.quoteProfiles
      : []

    return rawEntries
      .map((entry) =>
        this.normalizeExplicitTenantQuoteProfileEntry(entry, sourceDocumentId),
      )
      .filter((entry): entry is TenantQuoteProfile => Boolean(entry))
  }

  private normalizeExplicitTenantQuoteProfileEntry(
    entry: unknown,
    sourceDocumentId: string,
  ): TenantQuoteProfile | null {
    const raw = this.asRecord(entry)
    const label =
      typeof raw?.label === 'string'
        ? String(raw.label).replace(/\s+/g, ' ').trim()
        : ''

    if (!label) {
      return null
    }

    const key =
      typeof raw?.key === 'string' && raw.key.trim()
        ? raw.key.trim()
        : `quote_profile:${this.slugify(label)}`

    const appliesToTopicKeys = Array.isArray(raw?.appliesToTopicKeys)
      ? raw.appliesToTopicKeys
          .filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0,
          )
          .map((value) => value.trim())
      : []

    const appliesToTopicLabels = Array.isArray(raw?.appliesToTopicLabels)
      ? raw.appliesToTopicLabels
          .filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0,
          )
          .map((value) => this.normalizeKnowledgeSignalText(value))
          .filter(Boolean)
      : []

    const familyLabel =
      typeof raw?.familyLabel === 'string' && raw.familyLabel.trim()
        ? this.normalizeKnowledgeSignalText(raw.familyLabel)
        : null

    const closureMode =
      raw?.closureMode === 'collect_then_handoff'
        ? 'collect_then_handoff'
        : 'collect_then_price_or_handoff'

    const pricingStrategy =
      raw?.pricingStrategy === 'immediate_unit_price' ||
      raw?.pricingStrategy === 'immediate_square_meter' ||
      raw?.pricingStrategy === 'parametric_exact_or_handoff' ||
      raw?.pricingStrategy === 'handoff_only'
        ? raw.pricingStrategy
        : closureMode === 'collect_then_price_or_handoff'
          ? 'parametric_exact_or_handoff'
          : 'handoff_only'

    const measurementCarrierTerms = Array.isArray(raw?.measurementCarrierTerms)
      ? raw.measurementCarrierTerms
          .filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0,
          )
          .map((value) => this.normalizeKnowledgeSignalText(value))
          .filter(Boolean)
      : []

    const attributes = this.normalizeExplicitTenantQuoteProfileAttributes(
      raw?.attributes,
    )

    if (!attributes.length) {
      return null
    }

    return {
      key,
      label,
      appliesToTopicKeys: Array.from(new Set(appliesToTopicKeys)),
      appliesToTopicLabels: Array.from(new Set(appliesToTopicLabels)),
      familyLabel,
      pricingStrategy,
      closureMode,
      measurementCarrierTerms: Array.from(new Set(measurementCarrierTerms)),
      attributes,
      sourceDocumentIds: [sourceDocumentId],
    }
  }

  private normalizeExplicitTenantQuoteProfileAttributes(
    value: unknown,
  ): TenantQuoteProfileAttribute[] {
    if (!Array.isArray(value)) {
      return []
    }

    const attributes = value
      .map((entry) => this.normalizeExplicitTenantQuoteProfileAttribute(entry))
      .filter((entry): entry is TenantQuoteProfileAttribute => Boolean(entry))

    const merged = new Map<string, TenantQuoteProfileAttribute>()
    for (const attribute of attributes) {
      const existing = merged.get(attribute.key)
      if (!existing) {
        merged.set(attribute.key, attribute)
        continue
      }

      const optionMap = new Map<string, TenantQuoteProfileAttributeOption>()
      for (const option of [...existing.options, ...attribute.options]) {
        if (!option.value) {
          continue
        }
        const optionKey = this.normalizeKnowledgeSignalText(option.value)
        const current = optionMap.get(optionKey)
        if (!current) {
          optionMap.set(optionKey, {
            value: option.value,
            aliases: Array.from(new Set(option.aliases)),
          })
          continue
        }
        current.aliases = Array.from(
          new Set([...current.aliases, ...option.aliases]),
        ).sort()
      }

      merged.set(attribute.key, {
        ...existing,
        label: existing.label || attribute.label,
        required: existing.required || attribute.required,
        captureKind:
          existing.captureKind === 'enum' && attribute.captureKind !== 'enum'
            ? attribute.captureKind
            : existing.captureKind,
        taxonomyTag: existing.taxonomyTag || attribute.taxonomyTag,
        options: Array.from(optionMap.values()).sort((left, right) =>
          left.value.localeCompare(right.value, undefined, { sensitivity: 'base' }),
        ),
        subjectPrefix: existing.subjectPrefix || attribute.subjectPrefix,
      })
    }

    return Array.from(merged.values())
  }

  private normalizeExplicitTenantQuoteProfileAttribute(
    entry: unknown,
  ): TenantQuoteProfileAttribute | null {
    const raw = this.asRecord(entry)
    const rawKey =
      typeof raw?.key === 'string'
        ? raw.key.trim()
        : typeof raw?.name === 'string'
          ? raw.name.trim()
          : ''
    const key =
      rawKey && /^[a-z0-9_]+$/i.test(rawKey)
        ? rawKey.toLowerCase()
        : this.slugify(rawKey || String(raw?.label || '')).replace(/-/g, '_')
    if (!key) {
      return null
    }

    const label =
      typeof raw?.label === 'string' && raw.label.trim()
        ? raw.label.trim()
        : key.replace(/_/g, ' ')

    const rawCaptureKind =
      typeof raw?.captureKind === 'string'
        ? raw.captureKind.trim()
        : typeof raw?.type === 'string'
          ? raw.type.trim()
          : ''
    const captureKind =
      rawCaptureKind === 'measurements' ||
      rawCaptureKind === 'quantity' ||
      rawCaptureKind === 'taxonomy_tag' ||
      rawCaptureKind === 'enum'
        ? rawCaptureKind
        : key === 'measurements'
          ? 'measurements'
          : key === 'quantity'
            ? 'quantity'
            : raw?.taxonomyTag
              ? 'taxonomy_tag'
              : 'enum'

    const taxonomyTag =
      typeof raw?.taxonomyTag === 'string' && raw.taxonomyTag.trim()
        ? raw.taxonomyTag.trim()
        : null

    const options = Array.isArray(raw?.options)
      ? raw.options
          .map((option) => this.normalizeExplicitTenantQuoteProfileAttributeOption(option))
          .filter((option): option is TenantQuoteProfileAttributeOption => Boolean(option))
      : []

    return {
      key,
      label,
      required: raw?.required !== false,
      captureKind,
      taxonomyTag,
      options,
      subjectPrefix:
        typeof raw?.subjectPrefix === 'string' && raw.subjectPrefix.trim()
          ? raw.subjectPrefix.trim()
          : null,
    }
  }

  private normalizeExplicitTenantQuoteProfileAttributeOption(
    entry: unknown,
  ): TenantQuoteProfileAttributeOption | null {
    if (typeof entry === 'string') {
      const normalized = this.normalizeKnowledgeSignalText(entry)
      if (!normalized) {
        return null
      }
      return {
        value: normalized,
        aliases: [normalized],
      }
    }

    const raw = this.asRecord(entry)
    const value =
      typeof raw?.value === 'string'
        ? this.normalizeKnowledgeSignalText(raw.value)
        : ''

    if (!value) {
      return null
    }

    const aliases = new Set<string>([value])
    if (Array.isArray(raw?.aliases)) {
      for (const alias of raw.aliases) {
        const normalized = this.normalizeKnowledgeSignalText(String(alias || ''))
        if (normalized) {
          aliases.add(normalized)
        }
      }
    }

    return {
      value,
      aliases: Array.from(aliases).sort(),
    }
  }

  private mergeTenantQuoteProfiles(
    items: TenantQuoteProfile[],
  ): TenantQuoteProfile[] {
    const merged = new Map<string, TenantQuoteProfile>()

    for (const item of items) {
      const existing = merged.get(item.key)
      if (!existing) {
        merged.set(item.key, {
          ...item,
          appliesToTopicKeys: [...item.appliesToTopicKeys],
          appliesToTopicLabels: [...item.appliesToTopicLabels],
          measurementCarrierTerms: [...item.measurementCarrierTerms],
          attributes: item.attributes.map((attribute) => ({
            ...attribute,
            options: attribute.options.map((option) => ({
              value: option.value,
              aliases: [...option.aliases],
            })),
          })),
          sourceDocumentIds: [...item.sourceDocumentIds],
        })
        continue
      }

      const attributeMap = new Map<string, TenantQuoteProfileAttribute>()
      for (const attribute of [...existing.attributes, ...item.attributes]) {
        const current = attributeMap.get(attribute.key)
        if (!current) {
          attributeMap.set(attribute.key, {
            ...attribute,
            options: attribute.options.map((option) => ({
              value: option.value,
              aliases: [...option.aliases],
            })),
          })
          continue
        }

        const optionMap = new Map<string, TenantQuoteProfileAttributeOption>()
        for (const option of [...current.options, ...attribute.options]) {
          const optionKey = this.normalizeKnowledgeSignalText(option.value)
          const existingOption = optionMap.get(optionKey)
          if (!existingOption) {
            optionMap.set(optionKey, {
              value: option.value,
              aliases: [...option.aliases],
            })
            continue
          }
          existingOption.aliases = Array.from(
            new Set([...existingOption.aliases, ...option.aliases]),
          ).sort()
        }

        attributeMap.set(attribute.key, {
          ...current,
          label: current.label || attribute.label,
          required: current.required || attribute.required,
          captureKind:
            current.captureKind === 'enum' && attribute.captureKind !== 'enum'
              ? attribute.captureKind
              : current.captureKind,
          taxonomyTag: current.taxonomyTag || attribute.taxonomyTag,
          options: Array.from(optionMap.values()),
          subjectPrefix: current.subjectPrefix || attribute.subjectPrefix,
        })
      }

      merged.set(item.key, {
        ...existing,
        label: existing.label || item.label,
        familyLabel: existing.familyLabel || item.familyLabel,
        pricingStrategy:
          existing.pricingStrategy === 'handoff_only' &&
          item.pricingStrategy !== 'handoff_only'
            ? item.pricingStrategy
            : existing.pricingStrategy,
        closureMode:
          existing.closureMode === 'collect_then_handoff'
            ? existing.closureMode
            : item.closureMode,
        appliesToTopicKeys: Array.from(
          new Set([...existing.appliesToTopicKeys, ...item.appliesToTopicKeys]),
        ),
        appliesToTopicLabels: Array.from(
          new Set([
            ...existing.appliesToTopicLabels,
            ...item.appliesToTopicLabels,
          ]),
        ),
        measurementCarrierTerms: Array.from(
          new Set([
            ...existing.measurementCarrierTerms,
            ...item.measurementCarrierTerms,
          ]),
        ),
        attributes: Array.from(attributeMap.values()).sort((left, right) =>
          left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
        ),
        sourceDocumentIds: Array.from(
          new Set([...existing.sourceDocumentIds, ...item.sourceDocumentIds]),
        ),
      })
    }

    return Array.from(merged.values())
  }

  private extractExplicitTenantTopicTaxonomyEntries(
    metadata: Record<string, unknown> | null,
    sourceDocumentId: string,
  ): TenantTopicTaxonomyItem[] {
    const rawEntries = Array.isArray(metadata?.topicTaxonomy)
      ? metadata.topicTaxonomy
      : []

    return rawEntries
      .map((entry) =>
        this.normalizeExplicitTenantTopicTaxonomyEntry(
          entry,
          sourceDocumentId,
        ),
      )
      .filter((entry): entry is TenantTopicTaxonomyItem => Boolean(entry))
  }

  private normalizeExplicitTenantTopicTaxonomyEntry(
    entry: unknown,
    sourceDocumentId: string,
  ): TenantTopicTaxonomyItem | null {
    const raw = this.asRecord(entry)
    const kind = this.normalizeTenantTopicTaxonomyKind(raw?.kind)
    const label =
      typeof raw?.label === 'string'
        ? this.normalizeKnowledgeSignalText(raw.label)
        : ''

    if (!kind || !label) {
      return null
    }

    const key =
      typeof raw?.key === 'string' && raw.key.trim()
        ? raw.key.trim()
        : `${kind}:${this.slugify(label)}`

    const aliases = new Set<string>()
    const addAlias = (value: unknown) => {
      const normalized = this.normalizeKnowledgeSignalText(String(value || ''))
      if (!normalized || this.isTopicTaxonomyGenericAlias(normalized)) {
        return
      }
      aliases.add(normalized)
      const singular = this.singularizeTopicAlias(normalized)
      if (singular && !this.isTopicTaxonomyGenericAlias(singular)) {
        aliases.add(singular)
      }
    }

    addAlias(label)
    if (Array.isArray(raw?.aliases)) {
      for (const alias of raw.aliases) {
        addAlias(alias)
      }
    }

    const parentKeys = Array.isArray(raw?.parentKeys)
      ? raw.parentKeys
          .filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0,
          )
          .map((value) => value.trim())
      : []
    const parentLabels = Array.isArray(raw?.parentLabels)
      ? raw.parentLabels
          .filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0,
          )
          .map((value) => this.normalizeKnowledgeSignalText(value))
          .filter(Boolean)
      : []
    const familyLabel =
      typeof raw?.familyLabel === 'string' && raw.familyLabel.trim()
        ? this.normalizeKnowledgeSignalText(raw.familyLabel)
        : kind === 'product_family'
          ? label
          : null
    const normalizationValue = this.resolveTenantTopicNormalizationValue({
      kind,
      label,
      metadata: raw,
    })
    const tags = Array.isArray(raw?.tags)
      ? raw.tags
          .filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0,
          )
          .map((value) => this.normalizeKnowledgeSignalText(value))
          .filter((value) => value && !this.isTopicTaxonomyGenericAlias(value))
      : []

    return {
      key,
      label,
      kind,
      aliases: Array.from(aliases).sort(),
      normalizationValue,
      parentKeys: Array.from(new Set(parentKeys)).sort(),
      parentLabels: Array.from(new Set(parentLabels)).sort(),
      familyLabel,
      tags: Array.from(new Set(tags)).sort(),
      sourceDocumentIds: [sourceDocumentId],
    }
  }

  private extractTenantTopicTaxonomyLabel(
    title: string,
    metadata: Record<string, unknown> | null,
  ) {
    const factValue =
      typeof metadata?.factValue === 'string'
        ? this.normalizeKnowledgeSignalText(metadata.factValue)
        : null
    if (factValue) {
      return factValue
    }

    const cleanedTitle = this.normalizeKnowledgeSignalText(
      String(title || '')
        .replace(/^Dato web\s*·\s*(?:Variante|Producto)\s*·\s*/iu, '')
        .trim(),
    )
    return cleanedTitle || null
  }

  private buildTenantTopicAliases(input: {
    label: string
    tags: string[]
    metadata: Record<string, unknown> | null
  }) {
    const aliases = new Set<string>()
    const addAlias = (value: string | null | undefined) => {
      const normalized = this.normalizeKnowledgeSignalText(value || '')
      if (!normalized || this.isTopicTaxonomyGenericAlias(normalized)) {
        return
      }
      aliases.add(normalized)
      const singular = this.singularizeTopicAlias(normalized)
      if (singular && !this.isTopicTaxonomyGenericAlias(singular)) {
        aliases.add(singular)
      }
    }

    addAlias(input.label)
    if (typeof input.metadata?.factKey === 'string') {
      addAlias(String(input.metadata.factKey))
    }
    for (const tag of input.tags) {
      addAlias(tag)
    }

    return Array.from(aliases)
  }

  private resolveTenantTopicNormalizationValue(input: {
    kind: TenantTopicTaxonomyKind
    label: string
    metadata: Record<string, unknown> | null
  }) {
    const explicit =
      typeof input.metadata?.normalizationValue === 'string'
        ? this.normalizeKnowledgeSignalText(input.metadata.normalizationValue)
        : null
    if (explicit) {
      return explicit
    }

    if (input.kind === 'product_family' || input.kind === 'product_variant') {
      return this.normalizeKnowledgeSignalText(input.label)
    }

    return null
  }

  private normalizeTenantTopicTaxonomyKind(value: unknown) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z]+/g, '_')
      .replace(/^_+|_+$/g, '')
    return normalized === 'product_family' ||
      normalized === 'product_topic' ||
      normalized === 'product_variant'
      ? (normalized as TenantTopicTaxonomyKind)
      : null
  }

  private mergeTenantTopicTaxonomyItems(items: TenantTopicTaxonomyItem[]) {
    const merged = new Map<string, TenantTopicTaxonomyItem>()

    for (const item of items) {
      const current = merged.get(item.key)
      if (!current) {
        merged.set(item.key, {
          ...item,
          aliases: Array.from(new Set(item.aliases)).sort(),
          parentKeys: Array.from(new Set(item.parentKeys)).sort(),
          parentLabels: Array.from(new Set(item.parentLabels)).sort(),
          tags: Array.from(new Set(item.tags)).sort(),
          sourceDocumentIds: Array.from(new Set(item.sourceDocumentIds)).sort(),
        })
        continue
      }

      merged.set(item.key, {
        ...current,
        label: current.label || item.label,
        kind: current.kind || item.kind,
        aliases: Array.from(new Set([...current.aliases, ...item.aliases])).sort(),
        normalizationValue:
          current.normalizationValue || item.normalizationValue || null,
        parentKeys: Array.from(
          new Set([...current.parentKeys, ...item.parentKeys]),
        ).sort(),
        parentLabels: Array.from(
          new Set([...current.parentLabels, ...item.parentLabels]),
        ).sort(),
        familyLabel: current.familyLabel || item.familyLabel || null,
        tags: Array.from(new Set([...current.tags, ...item.tags])).sort(),
        sourceDocumentIds: Array.from(
          new Set([...current.sourceDocumentIds, ...item.sourceDocumentIds]),
        ).sort(),
      })
    }

    return Array.from(merged.values())
  }

  private deriveTopicFamilyLabel(label: string) {
    const normalized = this.normalizeKnowledgeSignalText(label)
    if (!normalized) {
      return null
    }

    const deIndex = normalized.indexOf(' de ')
    if (deIndex > 0) {
      return normalized.slice(0, deIndex).trim() || normalized
    }

    const tokens = normalized.split(/\s+/).filter(Boolean)
    if (tokens.length >= 2) {
      return this.singularizeTopicAlias(tokens[0]) || tokens[0]
    }

    return this.singularizeTopicAlias(normalized) || normalized
  }

  private singularizeTopicAlias(value: string) {
    const normalized = this.normalizeKnowledgeSignalText(value)
    if (!normalized) {
      return ''
    }

    if (normalized.endsWith('es') && normalized.length > 4) {
      return normalized.slice(0, -2)
    }
    if (normalized.endsWith('s') && normalized.length > 3) {
      return normalized.slice(0, -1)
    }
    return normalized
  }

  private isTopicTaxonomyGenericAlias(value: string) {
    return new Set([
      'product topic',
      'product variant',
      'product page',
      'faq page',
      'contact page',
      'hours page',
      'payments page',
      'website url',
      'derived web fact',
      'source',
    ]).has(this.normalizeKnowledgeSignalText(value))
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    return value as Record<string, unknown>
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

  private normalizeVisibleChannel(input: string) {
    const normalized = this.normalizeEnum(input)
    if (normalized === 'facebook' || normalized === 'instagram') {
      return 'meta'
    }
    return normalized
  }

  private deriveDocumentOriginCategory(document: {
    sourceType: KnowledgeSourceType
    sourceFilePath?: string | null
    metadata?: Prisma.JsonValue | null
  }) {
    const metadata = this.asRecord(document.metadata)
    if (metadata?.documentKind === 'derived_web_fact') {
      return 'website_url_derived'
    }
    if (document.sourceType === KnowledgeSourceType.WEB_URL) {
      return 'website_url'
    }
    if (document.sourceType === KnowledgeSourceType.ADMIN_CURATED) {
      return 'manual_entry'
    }
    if (document.sourceType === KnowledgeSourceType.BACKEND_DATASET) {
      return 'dataset_snapshot'
    }
    if (
      document.sourceType === KnowledgeSourceType.CONVERSATION_DERIVED
    ) {
      return 'conversation_approved'
    }
    if (document.sourceFilePath) {
      return 'uploaded_document'
    }
    return 'trusted_doc'
  }

  private deriveDocumentContentType(document: {
    sourceType: KnowledgeSourceType
    sourceFilePath?: string | null
    metadata?: Prisma.JsonValue | null
  }) {
    const metadata = this.asRecord(document.metadata)
    if (metadata?.documentKind === 'derived_web_fact') {
      return 'structured_fact'
    }
    if (document.sourceType === KnowledgeSourceType.WEB_URL) {
      return 'web_page'
    }
    if (document.sourceFilePath) {
      return 'document_file'
    }
    if (document.sourceType === KnowledgeSourceType.BACKEND_DATASET) {
      return 'dataset_snapshot'
    }
    if (document.sourceType === KnowledgeSourceType.CONVERSATION_DERIVED) {
      return 'conversation_response'
    }

    if (Array.isArray(metadata?.messageElements) && metadata.messageElements.length) {
      return 'multimodal_extract'
    }

    return 'plain_text'
  }

  private deriveCandidateOriginCategory(candidate: {
    sourceType: KnowledgeSourceType
    status: KnowledgeCandidateStatus
  }) {
    if (candidate.sourceType === KnowledgeSourceType.ADMIN_CURATED) {
      return 'manual_candidate'
    }
    if (candidate.sourceType === KnowledgeSourceType.BACKEND_DATASET) {
      return 'dataset_candidate'
    }
    if (candidate.status === KnowledgeCandidateStatus.APPROVED) {
      return 'conversation_approved'
    }
    return 'conversation_suggested'
  }

  private deriveCandidateContentType(candidate: {
    observation?: { messageElements?: Prisma.JsonValue | null } | null
  }) {
    const messageElements = Array.isArray(candidate.observation?.messageElements)
      ? candidate.observation?.messageElements
      : []

    return messageElements.length > 0
      ? 'multimodal_extract'
      : 'conversation_response'
  }

  private sortAndPaginateList<T>(
    items: T[],
    input: {
      page?: number
      pageSize?: number
      defaultPageSize: number
      orderBy?: string
      orderDir?: 'asc' | 'desc'
      defaultOrderBy: string
      selectors: Record<string, (item: T) => unknown>
    },
  ): PaginatedKnowledgeList<T> {
    const orderBy = input.orderBy && input.selectors[input.orderBy]
      ? input.orderBy
      : input.defaultOrderBy
    const orderDir = input.orderDir === 'asc' ? 'asc' : 'desc'
    const selector = input.selectors[orderBy] ?? input.selectors[input.defaultOrderBy]
    const sortedItems = [...items].sort((left, right) => {
      const leftValue = selector(left)
      const rightValue = selector(right)
      const comparison = this.compareSortValues(leftValue, rightValue)
      return orderDir === 'asc' ? comparison : comparison * -1
    })

    const pageSize = this.normalizePositiveInteger(input.pageSize, input.defaultPageSize)
    const total = sortedItems.length
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1
    const requestedPage = this.normalizePositiveInteger(input.page, 1)
    const page = Math.min(requestedPage, totalPages)
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize

    return {
      items: sortedItems.slice(startIndex, endIndex),
      total,
      page,
      pageSize,
      totalPages,
      hasMore: endIndex < total,
      orderBy,
      orderDir,
    }
  }

  private normalizePositiveInteger(value: number | undefined, fallback: number) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : fallback
  }

  private compareSortValues(left: unknown, right: unknown) {
    if (left == null && right == null) {
      return 0
    }
    if (left == null) {
      return 1
    }
    if (right == null) {
      return -1
    }

    const leftDate = this.toComparableDate(left)
    const rightDate = this.toComparableDate(right)
    if (leftDate != null && rightDate != null) {
      return leftDate - rightDate
    }

    if (typeof left === 'number' && typeof right === 'number') {
      return left - right
    }

    return String(left).localeCompare(String(right), undefined, {
      sensitivity: 'base',
      numeric: true,
    })
  }

  private toComparableDate(value: unknown) {
    if (value instanceof Date) {
      return value.getTime()
    }
    if (typeof value === 'string') {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.getTime()
      }
    }
    return null
  }

  private scoreDocument(
    document: {
      title: string
      summary: string | null
      content: string
      tags: string[]
      metadata?: Prisma.JsonValue | null
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

    score += this.scoreBusinessFaqDocument(document, normalizedSearch)
    score += this.scoreProductDocument(document, normalizedSearch)

    return score
  }

  private scoreBusinessFaqDocument(
    document: {
      title: string
      summary: string | null
      content: string
      tags: string[]
      metadata?: Prisma.JsonValue | null
    },
    normalizedSearch: string,
  ) {
    const faqTopic = this.detectBusinessFaqTopic(normalizedSearch)
    if (!faqTopic) {
      return 0
    }

    const title = this.normalizeKnowledgeText(document.title)
    const summary = this.normalizeKnowledgeText(document.summary ?? '')
    const content = this.normalizeKnowledgeText(document.content)
    const tags = (document.tags ?? []).map((tag) => this.normalizeKnowledgeText(tag))
    const metadata = this.asRecord(document.metadata)
    const sourceUrl = this.normalizeKnowledgeText(
      typeof metadata?.url === 'string' ? metadata.url : '',
    )
    const pageKinds = Array.isArray(metadata?.pageKinds)
      ? metadata.pageKinds
          .filter((value): value is string => typeof value === 'string')
          .map((value) => this.normalizeKnowledgeText(value))
      : []
    const factType =
      typeof metadata?.factType === 'string'
        ? this.normalizeKnowledgeText(metadata.factType)
        : null
    const isDerivedFact = metadata?.documentKind === 'derived_web_fact'
    let score = 0

    if (faqTopic === 'location') {
      if (isDerivedFact && (factType === 'location' || factType === 'local_commercial')) {
        score += 18
      }
      if (pageKinds.includes('contact_page') || pageKinds.includes('faq_page')) {
        score += 5
      }
      if (/\b(contacto|preguntas frecuentes|faq)\b/.test(title)) {
        score += 8
      }
      if (/\/contacto(?:\.html)?$/.test(sourceUrl)) {
        score += 8
      }
      if (
        /\b(nos encontramos en|estamos en|donde estan ubicados|direccion|ubicacion|local comercial|no contamos con local comercial|atencion totalmente en linea|visitas? a domicilio)\b/.test(
          `${summary} ${content}`,
        )
      ) {
        score += 10
      }
      if (
        /\b(venta e instalacion|venta e instalación|fabricacion|fabricación|solicita tu presupuesto|productos|servicios|aberturas|cortinas|persianas)\b/.test(
          `${summary} ${content}`,
        ) &&
        !/\b(nos encontramos en|estamos en|direccion|ubicacion|local comercial|no contamos con local comercial)\b/.test(
          `${summary} ${content}`,
        )
      ) {
        score -= 4
      }
    }

    if (faqTopic === 'contact') {
      if (
        isDerivedFact &&
        (factType === 'contact_phone' || factType === 'contact_email')
      ) {
        score += 18
      }
      if (pageKinds.includes('contact_page')) {
        score += 5
      }
      if (/\b(contacto|preguntas frecuentes|faq)\b/.test(title)) {
        score += 6
      }
      if (/\/contacto(?:\.html)?$/.test(sourceUrl)) {
        score += 6
      }
    }

    if (faqTopic === 'business_hours') {
      if (isDerivedFact && factType === 'business_hours') {
        score += 18
      }
      if (pageKinds.includes('hours_page') || pageKinds.includes('faq_page')) {
        score += 5
      }
      if (/\b(contacto|preguntas frecuentes|faq|horario)\b/.test(title)) {
        score += 6
      }
      if (/\b(horario|lun|lunes|vie|viernes|sab)\b/.test(`${summary} ${content}`)) {
        score += 6
      }
    }

    if (faqTopic === 'payment_methods') {
      if (isDerivedFact && factType === 'payment_methods') {
        score += 18
      }
      if (pageKinds.includes('payments_page') || pageKinds.includes('faq_page')) {
        score += 5
      }
      if (/\b(pago|medios de pago|formas de pago)\b/.test(`${title} ${summary}`)) {
        score += 6
      }
    }

    return score
  }

  private detectBusinessFaqTopic(normalizedSearch: string) {
    if (
      /\b(de donde son|donde estan|donde estan ubicados|ubicacion|direccion|local comercial|sucursal|showroom)\b/.test(
        normalizedSearch,
      )
    ) {
      return 'location'
    }
    if (
      /\b(telefono|whatsapp|contacto|numero|hablar con alguien)\b/.test(
        normalizedSearch,
      )
    ) {
      return 'contact'
    }
    if (
      /\b(horario|horarios|cuando abren|cuando cierran|atienden)\b/.test(
        normalizedSearch,
      )
    ) {
      return 'business_hours'
    }
    if (
      /\b(medios de pago|formas de pago|tarjeta|transferencia|efectivo|cuotas)\b/.test(
        normalizedSearch,
      )
    ) {
      return 'payment_methods'
    }
    return null
  }

  private detectKnowledgeProductSignals(normalizedSearch: string) {
    const normalized = this.normalizeKnowledgeSignalText(normalizedSearch)
    if (!normalized) {
      return []
    }

    const matches = new Map<
      string,
      {
        label: string
        factType: Extract<KnowledgeWebDerivedFactType, 'product_topic' | 'product_variant'>
      }
    >()

    for (const definition of KNOWLEDGE_WEB_PRODUCT_SIGNAL_DEFINITIONS) {
      if (!definition.matchers.some((matcher) => matcher.test(normalized))) {
        continue
      }
      matches.set(definition.label, {
        label: definition.label,
        factType: definition.factType,
      })
    }

    return Array.from(matches.values())
  }

  private scoreProductDocument(
    document: {
      title: string
      summary: string | null
      content: string
      tags: string[]
      metadata?: Prisma.JsonValue | null
    },
    normalizedSearch: string,
  ) {
    const productSignals = this.detectKnowledgeProductSignals(normalizedSearch)
    if (!productSignals.length) {
      return 0
    }

    const title = this.normalizeKnowledgeSignalText(document.title)
    const summary = this.normalizeKnowledgeSignalText(document.summary ?? '')
    const content = this.normalizeKnowledgeSignalText(document.content)
    const metadata = this.asRecord(document.metadata)
    const sourceUrl = this.normalizeKnowledgeSignalText(
      typeof metadata?.url === 'string' ? metadata.url : '',
    )
    const pageKinds = Array.isArray(metadata?.pageKinds)
      ? metadata.pageKinds
          .filter((value): value is string => typeof value === 'string')
          .map((value) => this.normalizeKnowledgeSignalText(value))
      : []
    const factType =
      typeof metadata?.factType === 'string'
        ? this.normalizeKnowledgeSignalText(metadata.factType)
        : null
    const factValue =
      typeof metadata?.factValue === 'string'
        ? this.normalizeKnowledgeSignalText(metadata.factValue)
        : null
    const isDerivedFact = metadata?.documentKind === 'derived_web_fact'

    let score = 0
    for (const signal of productSignals) {
      const normalizedLabel = this.normalizeKnowledgeSignalText(signal.label)
      const labelTokens = normalizedLabel
        .split(/\s+/)
        .filter((token) => token.length >= 4)
      const labelInTitle = title.includes(normalizedLabel)
      const labelInSummary = summary.includes(normalizedLabel)
      const labelInContent = content.includes(normalizedLabel)
      const labelInUrl = labelTokens.some((token) => sourceUrl.includes(token))
      const factMatches =
        Boolean(factValue) &&
        (() => {
          const normalizedFactValue = String(factValue).trim()
          return (
            normalizedFactValue === normalizedLabel ||
            normalizedFactValue.includes(normalizedLabel) ||
            normalizedLabel.includes(normalizedFactValue)
          )
        })()

      if (isDerivedFact && factType === signal.factType) {
        score += 12
      }
      if (factMatches) {
        score += 12
      }
      if (pageKinds.includes('product_page')) {
        score += 4
      }
      if (labelInTitle) {
        score += 8
      }
      if (labelInSummary) {
        score += 6
      }
      if (labelInContent) {
        score += 4
      }
      if (labelInUrl) {
        score += 4
      }
    }

    return score
  }

  private buildSnippet(content: string, search: string) {
    const normalizedContent = content.trim()
    if (!normalizedContent) {
      return ''
    }

    const normalizedSearch = search.trim().toLowerCase()
    const faqTopic = this.detectBusinessFaqTopic(
      this.normalizeKnowledgeText(normalizedSearch),
    )
    const faqSnippet = faqTopic
      ? this.buildBusinessFaqSnippet(normalizedContent, faqTopic)
      : null
    if (faqSnippet) {
      return faqSnippet
    }

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

  private buildBusinessFaqSnippet(
    content: string,
    faqTopic: 'location' | 'contact' | 'business_hours' | 'payment_methods',
  ) {
    const patternsByTopic: Record<
      typeof faqTopic,
      RegExp[]
    > = {
      location: [
        /\b¿?\s*d[oó]nde est[aá]n ubicados\??/iu,
        /\bnos encontramos en\b/iu,
        /\bestamos en\b/iu,
        /\bno contamos con local comercial\b/iu,
        /\bvisitas? dentro de montevideo\b/iu,
      ],
      contact: [
        /\b(cu[aá]l es su n[uú]mero de contacto|n[uú]mero de contacto)\b/iu,
        /\bwhatsapp\b/iu,
        /\btel[eé]fono\b/iu,
        /\bemail\b/iu,
      ],
      business_hours: [
        /\b(cu[aá]l es su horario de atenci[oó]n|horario de atenci[oó]n)\b/iu,
        /\bde lunes a viernes\b/iu,
        /\blun\s*-\s*vie\b/iu,
        /\bs[aá]b(?:ado)?s?\b/iu,
      ],
      payment_methods: [
        /\b(aceptan tarjetas? de cr[eé]dito|medios de pago|formas de pago)\b/iu,
        /\bfinanciaci[oó]n\b/iu,
        /\btransferencia\b/iu,
        /\befectivo\b/iu,
      ],
    }

    const patterns = patternsByTopic[faqTopic] ?? []
    for (const pattern of patterns) {
      const match = pattern.exec(content)
      if (!match || typeof match.index !== 'number') {
        continue
      }

      const start = Math.max(match.index - 80, 0)
      const end = Math.min(match.index + 520, content.length)
      return content.slice(start, end).trim()
    }

    return null
  }

  private scoreKnowledgeCandidate(content: string, normalizedQuery: string) {
    if (!normalizedQuery.trim()) {
      return 0
    }

    const haystack = this.normalizeKnowledgeText(content)
    if (!haystack) {
      return 0
    }

    let score = 0
    if (haystack.includes(normalizedQuery)) {
      score += 24
    }

    const tokens = normalizedQuery.split(/\s+/).filter((token) => token.length >= 3)
    for (const token of tokens) {
      if (haystack.includes(token)) {
        score += token.length >= 6 ? 5 : 3
      }
    }

    return score
  }

  private async buildSuggestionFeedbackSummaryMap(candidateIds: string[]) {
    if (candidateIds.length === 0) {
      return new Map<string, KnowledgeSuggestionFeedbackCounts>()
    }

    const summary = new Map<string, KnowledgeSuggestionFeedbackCounts>()
    const rows = await this.prisma.knowledgeSuggestionFeedback.groupBy({
      by: ['candidateId', 'outcome'],
      where: {
        candidateId: {
          in: candidateIds,
        },
      },
      _count: {
        _all: true,
      },
    })

    for (const row of rows) {
      const current = summary.get(row.candidateId) ?? {
        used: 0,
        edited: 0,
        discarded: 0,
      }

      if (row.outcome === KnowledgeSuggestionFeedbackOutcome.USED) {
        current.used = row._count._all
      } else if (row.outcome === KnowledgeSuggestionFeedbackOutcome.EDITED) {
        current.edited = row._count._all
      } else if (row.outcome === KnowledgeSuggestionFeedbackOutcome.DISCARDED) {
        current.discarded = row._count._all
      }

      summary.set(row.candidateId, current)
    }

    return summary
  }

  private buildSuggestionFeedbackMetrics(
    counts?: Partial<KnowledgeSuggestionFeedbackCounts> | null,
  ): KnowledgeSuggestionFeedbackMetrics {
    const used = Number(counts?.used ?? 0)
    const edited = Number(counts?.edited ?? 0)
    const discarded = Number(counts?.discarded ?? 0)
    const total = used + edited + discarded
    const applied = used + edited

    return {
      used,
      edited,
      discarded,
      total,
      applied,
      adoptionRate: total > 0 ? Number((applied / total).toFixed(4)) : 0,
      discardRate: total > 0 ? Number((discarded / total).toFixed(4)) : 0,
    }
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
    const resolved = await this.fetchKnowledgeUrlSource({
      url: source.url,
      titleOverride: source.title,
      summaryOverride: null,
      refreshPolicy: this.normalizeKnowledgeUrlRefreshPolicy(
        this.asRecord(source.metadata)?.refreshPolicy as string | undefined,
      ),
      previousMetadata: null,
      metadata: source.metadata ?? {},
      sourceLabel: 'tenant-web-ingestion',
    })

    return this.upsertKnowledgeDocument({
      tenantKey,
      scope: this.mapScope(source.scope),
      sourceType: KnowledgeSourceType.WEB_URL,
      sourceKey: source.sourceKey,
      title: resolved.title,
      summary: resolved.summary,
      content: resolved.content,
      tags: source.tags ?? [],
      piiRiskLevel: 'low',
      metadata: resolved.metadata,
      actorUserId,
    })
  }

  private extractKnowledgeWebLines(content: string) {
    return String(content || '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length >= 2)
  }

  private isKnowledgeFaqQuestionLine(line: string) {
    const normalized = this.normalizeKnowledgeText(line)
    return (
      /^\¿?.+\?$/.test(line.trim()) ||
      /\b(cual|cuál|como|cómo|donde|dónde|tienen|cuentan|aceptan)\b/.test(
        normalized,
      )
    )
  }

  private extractKnowledgeFaqAnswer(
    lines: string[],
    questionPatterns: RegExp[],
  ) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (!questionPatterns.some((pattern) => pattern.test(line))) {
        continue
      }

      const answers: string[] = []
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const candidate = lines[cursor]
        if (!candidate) {
          continue
        }
        if (this.isKnowledgeFaqQuestionLine(candidate)) {
          break
        }
        if (
          /^(menu|inicio|catalogo|catálogo|contactanos|contacto|preguntas frecuentes)$/iu.test(
            candidate,
          )
        ) {
          break
        }
        answers.push(candidate)
        if (answers.length >= 3) {
          break
        }
      }

      if (answers.length) {
        return answers.join(' ')
      }
    }

    return null
  }

  private extractKnowledgeLabeledValue(
    lines: string[],
    labelPatterns: RegExp[],
  ) {
    for (let index = 0; index < lines.length - 1; index += 1) {
      const line = lines[index]
      if (!labelPatterns.some((pattern) => pattern.test(line))) {
        continue
      }

      for (let cursor = index + 1; cursor < Math.min(index + 4, lines.length); cursor += 1) {
        const candidate = lines[cursor]
        if (!candidate || this.isKnowledgeFaqQuestionLine(candidate)) {
          break
        }
        if (
          /^(menu|inicio|catalogo|catálogo|contactanos|contacto|preguntas frecuentes)$/iu.test(
            candidate,
          )
        ) {
          break
        }
        return candidate
      }
    }

    return null
  }

  private extractKnowledgePhone(content: string, lines: string[]) {
    const phonePattern = /\+?\d[\d\s-]{6,}\d/u
    const faqAnswer = this.extractKnowledgeFaqAnswer(lines, [
      /\b(n[uú]mero de contacto|telefono|teléfono|whatsapp)\b/iu,
    ])
    const phoneFromFaq = faqAnswer?.match(phonePattern)?.[0] ?? null
    if (phoneFromFaq) {
      return phoneFromFaq.trim()
    }

    const labeled = this.extractKnowledgeLabeledValue(lines, [
      /^tel[eé]fono$/iu,
      /^whatsapp$/iu,
    ])
    const phoneFromLabel = labeled?.match(phonePattern)?.[0] ?? null
    if (phoneFromLabel) {
      return phoneFromLabel.trim()
    }

    return content.match(phonePattern)?.[0]?.trim() ?? null
  }

  private extractKnowledgeEmail(content: string) {
    return (
      content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0]?.trim() ?? null
    )
  }

  private buildKnowledgeFactTitle(
    factType: Extract<KnowledgeWebDerivedFactType, 'product_topic' | 'product_variant'>,
    label: string,
  ) {
    return `Dato web · ${factType === 'product_variant' ? 'Variante' : 'Producto'} · ${label}`
  }

  private extractKnowledgeProductContextSnippet(
    text: string,
    matchers: readonly RegExp[],
  ) {
    const lines = this.extractKnowledgeWebLines(text)
    const normalizedLines = lines.map((line) => ({
      original: line,
      normalized: this.normalizeKnowledgeSignalText(line),
    }))

    for (let index = 0; index < normalizedLines.length; index += 1) {
      const entry = normalizedLines[index]
      if (!matchers.some((matcher) => matcher.test(entry.normalized))) {
        continue
      }

      const previous = index > 0 ? normalizedLines[index - 1].original : null
      const current = entry.original
      const next = index < normalizedLines.length - 1 ? normalizedLines[index + 1].original : null
      const snippet = [previous, current, next].filter(Boolean).join(' ')
      return snippet.slice(0, 320)
    }

    return null
  }

  private extractKnowledgeProductFacts(input: {
    url: string
    title: string
    summary: string | null
    content: string
    pageKinds: Set<KnowledgeWebPageKind>
  }) {
    const signalText = this.normalizeKnowledgeSignalText(
      [input.url, input.title, input.summary ?? '', input.content].join(' '),
    )
    const titleUrlSignalText = this.normalizeKnowledgeSignalText(
      [input.url, input.title].join(' '),
    )
    const titleUrlLooksProduct = KNOWLEDGE_WEB_PRODUCT_SIGNAL_DEFINITIONS.some(
      (definition) =>
        definition.matchers.some((matcher) => matcher.test(titleUrlSignalText)),
    )
    const blockedByUtilityPage =
      input.pageKinds.has('contact_page') ||
      input.pageKinds.has('hours_page') ||
      input.pageKinds.has('payments_page')
    const shouldTreatAsProductPage =
      titleUrlLooksProduct ||
      (!blockedByUtilityPage &&
        KNOWLEDGE_WEB_PRODUCT_SIGNAL_DEFINITIONS.some((definition) =>
          definition.matchers.some((matcher) => matcher.test(signalText)),
        ))

    if (!shouldTreatAsProductPage) {
      return []
    }

    input.pageKinds.add('product_page')
    const facts: KnowledgeWebDerivedFact[] = []
    const seenKeys = new Set<string>()

    for (const definition of KNOWLEDGE_WEB_PRODUCT_SIGNAL_DEFINITIONS) {
      const matchedInTitleOrUrl = definition.matchers.some((matcher) =>
        matcher.test(titleUrlSignalText),
      )
      const matchedInPage = definition.matchers.some((matcher) => matcher.test(signalText))
      if (!matchedInPage) {
        continue
      }

      const factKey = definition.label
      if (seenKeys.has(factKey)) {
        continue
      }
      seenKeys.add(factKey)

      const snippet =
        this.extractKnowledgeProductContextSnippet(
          `${input.title}\n${input.summary ?? ''}\n${input.content}`,
          definition.matchers,
        ) ||
        input.summary ||
        input.title
      const compactSnippet = snippet.replace(/\s+/g, ' ').trim()
      facts.push({
        factType: definition.factType,
        title: this.buildKnowledgeFactTitle(definition.factType, definition.label),
        summary: compactSnippet,
        content: compactSnippet,
        tags: ['web_fact', ...definition.tags],
        confidence: matchedInTitleOrUrl ? 0.93 : 0.82,
        extractionMethod: 'pattern_match',
        factKey,
        factValue: definition.label,
        topicType: definition.factType,
      })
    }

    return facts
  }

  private buildKnowledgeWebPageAnalysis(input: {
    url: string
    title: string
    summary: string | null
    content: string
  }): KnowledgeWebPageAnalysis {
    const normalizedUrl = this.normalizeKnowledgeText(input.url)
    const normalizedTitle = this.normalizeKnowledgeText(input.title)
    const normalizedSummary = this.normalizeKnowledgeText(input.summary ?? '')
    const normalizedContent = this.normalizeKnowledgeText(input.content)
    const lines = this.extractKnowledgeWebLines(input.content)
    const pageKinds = new Set<KnowledgeWebPageKind>()
    const facts: KnowledgeWebDerivedFact[] = []

    const faqQuestionCount = lines.filter((line) =>
      this.isKnowledgeFaqQuestionLine(line),
    ).length

    const locationAnswer = this.extractKnowledgeFaqAnswer(lines, [
      /\b(d[oó]nde est[aá]n ubicados)\b/iu,
      /\b(de d[oó]nde son)\b/iu,
    ])
    const localCommercialAnswer = this.extractKnowledgeFaqAnswer(lines, [
      /\b(cuentan con local comercial)\b/iu,
      /\b(tienen local comercial)\b/iu,
    ])
    const hoursAnswer =
      this.extractKnowledgeFaqAnswer(lines, [
        /\b(cu[aá]l es su horario de atenci[oó]n)\b/iu,
      ]) ||
      this.extractKnowledgeLabeledValue(lines, [/^horario$/iu]) ||
      lines.find((line) =>
        /\b(lunes a viernes|lun\s*-\s*vie|s[aá]b(?:ados?)?|domingo|domingos|\d{1,2}[:.]\d{2})\b/iu.test(
          line,
        ),
      ) ||
      null
    const paymentMethodsAnswer = this.extractKnowledgeFaqAnswer(lines, [
      /\b(aceptan tarjetas? de cr[eé]dito)\b/iu,
      /\b(medios de pago|formas de pago)\b/iu,
    ])
    const phone = this.extractKnowledgePhone(input.content, lines)
    const email = this.extractKnowledgeEmail(input.content)

    if (
      /\/contacto(?:\.html)?$/.test(input.url) ||
      /\b(contacto|contactanos|cont[aá]ctanos)\b/.test(normalizedTitle) ||
      Boolean(locationAnswer || localCommercialAnswer || phone || email)
    ) {
      pageKinds.add('contact_page')
    }

    if (
      /\b(faq|preguntas frecuentes)\b/.test(normalizedTitle) ||
      /\b(preguntas frecuentes)\b/.test(normalizedContent) ||
      faqQuestionCount >= 2
    ) {
      pageKinds.add('faq_page')
    }

    if (
      /\/horario/.test(input.url) ||
      /\bhorario\b/.test(normalizedTitle) ||
      /\b(cu[aá]l es su horario de atenci[oó]n)\b/.test(normalizedContent)
    ) {
      pageKinds.add('hours_page')
    }

    if (
      /\/(?:pagos?|medios-de-pago|formas-de-pago)/.test(input.url) ||
      /\b(medios de pago|formas de pago|tarjetas?|financiaci[oó]n)\b/.test(
        normalizedTitle,
      ) ||
      Boolean(paymentMethodsAnswer)
    ) {
      pageKinds.add('payments_page')
    }

    if (locationAnswer && (pageKinds.has('contact_page') || pageKinds.has('faq_page'))) {
      facts.push({
        factType: 'location',
        title: 'Dato web · Ubicación',
        summary: locationAnswer,
        content: locationAnswer,
        tags: ['web_fact', 'location'],
        confidence: 0.96,
        extractionMethod: 'faq_answer',
      })
    } else if (
      pageKinds.has('contact_page') &&
      /\bmontevideo,\s*uruguay\b/.test(normalizedContent)
    ) {
      facts.push({
        factType: 'location',
        title: 'Dato web · Ubicación',
        summary: 'Nos encontramos en Montevideo, Uruguay.',
        content: 'Nos encontramos en Montevideo, Uruguay.',
        tags: ['web_fact', 'location'],
        confidence: 0.72,
        extractionMethod: 'pattern_match',
      })
    }

    if (
      localCommercialAnswer &&
      (pageKinds.has('contact_page') || pageKinds.has('faq_page'))
    ) {
      facts.push({
        factType: 'local_commercial',
        title: 'Dato web · Local comercial',
        summary: localCommercialAnswer,
        content: localCommercialAnswer,
        tags: ['web_fact', 'location', 'local_commercial'],
        confidence: 0.95,
        extractionMethod: 'faq_answer',
      })
    }

    if (phone && pageKinds.has('contact_page')) {
      facts.push({
        factType: 'contact_phone',
        title: 'Dato web · Teléfono de contacto',
        summary: phone,
        content: phone,
        tags: ['web_fact', 'contact', 'phone'],
        confidence: 0.94,
        extractionMethod: 'label_value',
      })
    }

    if (email && pageKinds.has('contact_page')) {
      facts.push({
        factType: 'contact_email',
        title: 'Dato web · Email de contacto',
        summary: email,
        content: email,
        tags: ['web_fact', 'contact', 'email'],
        confidence: 0.94,
        extractionMethod: 'pattern_match',
      })
    }

    if (hoursAnswer && (pageKinds.has('contact_page') || pageKinds.has('hours_page') || pageKinds.has('faq_page'))) {
      facts.push({
        factType: 'business_hours',
        title: 'Dato web · Horario de atención',
        summary: hoursAnswer,
        content: hoursAnswer,
        tags: ['web_fact', 'business_hours'],
        confidence: 0.93,
        extractionMethod: /\bcual es su horario\b/iu.test(input.content)
          ? 'faq_answer'
          : 'label_value',
      })
    }

    if (paymentMethodsAnswer && (pageKinds.has('faq_page') || pageKinds.has('payments_page'))) {
      facts.push({
        factType: 'payment_methods',
        title: 'Dato web · Medios de pago',
        summary: paymentMethodsAnswer,
        content: paymentMethodsAnswer,
        tags: ['web_fact', 'payment_methods'],
        confidence: 0.91,
        extractionMethod: 'faq_answer',
      })
    }

    facts.push(
      ...this.extractKnowledgeProductFacts({
        url: input.url,
        title: input.title,
        summary: input.summary,
        content: input.content,
        pageKinds,
      }),
    )

    return {
      pageKinds: [...pageKinds],
      facts,
    }
  }

  private buildKnowledgeWebFactSourceKey(
    url: string,
    factType: KnowledgeWebDerivedFactType,
    factKey?: string | null,
  ) {
    const normalizedFactKey = String(factKey || '')
      .trim()
      .toLowerCase()
    if (!normalizedFactKey) {
      return `${this.buildKnowledgeWebSourceKey(url)}:fact:${factType}`
    }

    const slug =
      this.slugify(normalizedFactKey).slice(0, 64) ||
      createHash('sha1').update(normalizedFactKey).digest('hex').slice(0, 12)
    return `${this.buildKnowledgeWebSourceKey(url)}:fact:${factType}:${slug}`
  }

  private buildKnowledgeWebFactSourceKeyPrefix(url: string) {
    return `${this.buildKnowledgeWebSourceKey(url)}:fact:`
  }

  private async syncKnowledgeUrlDerivedFacts(input: {
    tenantKey: string
    scope: KnowledgeDocumentScope
    actorUserId: number
    url: string
    sourceDocumentId: string
    sourceDocumentTitle: string
    pageKinds: KnowledgeWebPageKind[]
    facts: KnowledgeWebDerivedFact[]
    tags: string[]
    sourceLabel: string
  }) {
    const prefix = this.buildKnowledgeWebFactSourceKeyPrefix(input.url)
    const existing = await this.prisma.knowledgeDocument.findMany({
      where: {
        tenantKey: input.tenantKey,
        scope: input.scope,
        sourceType: KnowledgeSourceType.WEB_URL,
        sourceKey: {
          startsWith: prefix,
        },
      },
      select: {
        id: true,
        sourceKey: true,
      },
    })

    const nextKeys = new Set<string>()
    for (const fact of input.facts) {
      const sourceKey = this.buildKnowledgeWebFactSourceKey(
        input.url,
        fact.factType,
        fact.factKey,
      )
      nextKeys.add(sourceKey)
      const factTags = Array.from(
        new Set([
          ...input.tags,
          ...input.pageKinds,
          ...fact.tags,
        ]),
      )

      await this.upsertKnowledgeDocument({
        tenantKey: input.tenantKey,
        scope: input.scope,
        sourceType: KnowledgeSourceType.WEB_URL,
        sourceKey,
        title: fact.title,
        summary: fact.summary,
        content: fact.content,
        tags: factTags,
        piiRiskLevel: 'low',
        metadata: {
          documentKind: 'derived_web_fact',
          factType: fact.factType,
          factKey: fact.factKey ?? null,
          factValue: fact.factValue ?? fact.content,
          topicType: fact.topicType ?? null,
          confidence: fact.confidence,
          extractionMethod: fact.extractionMethod,
          derivedFromUrl: input.url,
          derivedFromDocumentId: input.sourceDocumentId,
          derivedFromDocumentTitle: input.sourceDocumentTitle,
          pageKinds: input.pageKinds,
          source: `${input.sourceLabel}:derived_fact`,
        },
        actorUserId: input.actorUserId,
      })
    }

    const staleIds = existing
      .filter((document) => !nextKeys.has(document.sourceKey))
      .map((document) => document.id)

    if (staleIds.length) {
      await this.prisma.knowledgeDocument.deleteMany({
        where: {
          id: {
            in: staleIds,
          },
        },
      })
    }

    return {
      count: input.facts.length,
      factTypes: input.facts.map((fact) => fact.factType),
    }
  }

  private buildKnowledgeWebSourceKey(url: string) {
    const normalizedUrl = this.normalizeKnowledgeUrl(url)
    return `web:${createHash('sha1').update(normalizedUrl).digest('hex').slice(0, 16)}`
  }

  private normalizeKnowledgeUrl(url: string) {
    const parsed = new URL(url.trim())
    parsed.hash = ''
    return parsed.toString()
  }

  private normalizeKnowledgeUrlRefreshPolicy(
    policy?: string | null,
  ): KnowledgeUrlRefreshPolicy {
    return KNOWLEDGE_URL_REFRESH_POLICIES.includes(
      policy as KnowledgeUrlRefreshPolicy,
    )
      ? (policy as KnowledgeUrlRefreshPolicy)
      : 'daily'
  }

  private buildNextKnowledgeUrlRefreshAt(
    policy: KnowledgeUrlRefreshPolicy,
    reference = new Date(),
  ) {
    if (policy === 'manual' || policy === 'on_demand') {
      return null
    }

    const next = new Date(reference)
    next.setHours(next.getHours() + (policy === 'daily' ? 24 : 24 * 7))
    return next.toISOString()
  }

  private readKnowledgeUrlMetadata(metadata: Prisma.JsonValue | null | undefined) {
    const record = this.asRecord(metadata)
    return {
      url: typeof record?.url === 'string' ? record.url : null,
      refreshPolicy: this.normalizeKnowledgeUrlRefreshPolicy(
        typeof record?.refreshPolicy === 'string' ? record.refreshPolicy : undefined,
      ),
      etag: typeof record?.etag === 'string' ? record.etag : null,
      lastModified:
        typeof record?.lastModified === 'string' ? record.lastModified : null,
      lastFetchedAt:
        typeof record?.lastFetchedAt === 'string' ? record.lastFetchedAt : null,
      lastCheckedAt:
        typeof record?.lastCheckedAt === 'string' ? record.lastCheckedAt : null,
      nextRefreshAt:
        typeof record?.nextRefreshAt === 'string' ? record.nextRefreshAt : null,
      source: typeof record?.source === 'string' ? record.source : null,
    }
  }

  private isKnowledgeUrlRefreshDue(metadata: Prisma.JsonValue | null | undefined) {
    const urlMetadata = this.readKnowledgeUrlMetadata(metadata)
    if (!urlMetadata.url) {
      return false
    }
    if (urlMetadata.refreshPolicy === 'manual' || urlMetadata.refreshPolicy === 'on_demand') {
      return false
    }
    if (!urlMetadata.nextRefreshAt) {
      return true
    }

    const nextRefreshAt = new Date(urlMetadata.nextRefreshAt)
    if (Number.isNaN(nextRefreshAt.getTime())) {
      return true
    }
    return nextRefreshAt.getTime() <= Date.now()
  }

  private async fetchKnowledgeUrlSource(input: {
    url: string
    titleOverride?: string | null
    summaryOverride?: string | null
    refreshPolicy: KnowledgeUrlRefreshPolicy
    previousMetadata?: {
      etag?: string | null
      lastModified?: string | null
    } | null
    metadata?: Record<string, unknown>
    sourceLabel?: string
  }) {
    const normalizedUrl = this.normalizeKnowledgeUrl(input.url)
    const headers: Record<string, string> = {}
    if (input.previousMetadata?.etag) {
      headers['if-none-match'] = input.previousMetadata.etag
    }
    if (input.previousMetadata?.lastModified) {
      headers['if-modified-since'] = input.previousMetadata.lastModified
    }

    const response = await fetch(normalizedUrl, { headers })
    const now = new Date()
    const refreshPolicy = this.normalizeKnowledgeUrlRefreshPolicy(input.refreshPolicy)
    if (response.status === 304) {
      return {
        notModified: true,
        url: normalizedUrl,
        title: input.titleOverride?.trim() || normalizedUrl,
        summary: input.summaryOverride?.trim() || null,
        content: '',
        rawHtml: null,
        metadata: {
          ...(input.metadata ?? {}),
          url: normalizedUrl,
          source: input.sourceLabel || 'admin-web-url',
          refreshPolicy,
          lastCheckedAt: now.toISOString(),
          nextRefreshAt: this.buildNextKnowledgeUrlRefreshAt(refreshPolicy, now),
          etag: input.previousMetadata?.etag ?? null,
          lastModified: input.previousMetadata?.lastModified ?? null,
          fetchStatus: 'not_modified',
        },
      }
    }

    if (!response.ok) {
      throw new Error(`knowledge.webFetchFailed:${response.status}`)
    }

    const raw = await response.text()
    const contentType = response.headers.get('content-type') || null
    const isHtml =
      typeof contentType === 'string'
        ? contentType.toLowerCase().includes('html')
        : /<html[\s>]/i.test(raw) || /<body[\s>]/i.test(raw)
    const content = isHtml ? this.extractReadableHtml(raw) : raw.trim().slice(0, 24000)
    const title = input.titleOverride?.trim()
      || (isHtml ? this.extractHtmlTitle(raw) : null)
      || normalizedUrl
    const summary =
      input.summaryOverride?.trim()
      || (isHtml ? this.extractHtmlDescription(raw) : null)
      || this.extractSummary(content)
      || null

    const analysis = this.buildKnowledgeWebPageAnalysis({
      url: normalizedUrl,
      title,
      summary,
      content,
    })

    return {
      notModified: false,
      url: normalizedUrl,
      title,
      summary,
      content,
      rawHtml: isHtml ? raw : null,
      analysis,
      metadata: {
        ...(input.metadata ?? {}),
        url: normalizedUrl,
        source: input.sourceLabel || 'admin-web-url',
        documentKind: 'web_page',
        pageKinds: analysis.pageKinds,
        structuredFacts: analysis.facts.map((fact) => ({
          factType: fact.factType,
          factKey: fact.factKey ?? null,
          value: fact.content,
          factValue: fact.factValue ?? fact.content,
          topicType: fact.topicType ?? null,
          confidence: fact.confidence,
          extractionMethod: fact.extractionMethod,
        })),
        refreshPolicy,
        fetchedContentType: contentType,
        fetchStatus: 'ok',
        lastFetchedAt: now.toISOString(),
        lastCheckedAt: now.toISOString(),
        nextRefreshAt: this.buildNextKnowledgeUrlRefreshAt(refreshPolicy, now),
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
      },
    }
  }

  private normalizeCrawlOptions(
    input: CreateKnowledgeUrlDto | Prisma.JsonValue | null | undefined,
  ) {
    const record =
      input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
    const crawlRecord =
      record.crawl && typeof record.crawl === 'object'
        ? (record.crawl as Record<string, unknown>)
        : record

    const enabled =
      typeof crawlRecord.crawl === 'boolean'
        ? crawlRecord.crawl
        : typeof crawlRecord.enabled === 'boolean'
          ? crawlRecord.enabled
          : false

    const maxDepth =
      typeof crawlRecord.crawlMaxDepth === 'number'
        ? Math.max(0, Math.min(5, Math.floor(crawlRecord.crawlMaxDepth)))
        : typeof crawlRecord.maxDepth === 'number'
          ? Math.max(0, Math.min(5, Math.floor(crawlRecord.maxDepth)))
          : 1

    const maxPages =
      typeof crawlRecord.crawlMaxPages === 'number'
        ? Math.max(1, Math.min(200, Math.floor(crawlRecord.crawlMaxPages)))
        : typeof crawlRecord.maxPages === 'number'
          ? Math.max(1, Math.min(200, Math.floor(crawlRecord.maxPages)))
          : 25

    const sameDomainOnly =
      typeof crawlRecord.crawlSameDomainOnly === 'boolean'
        ? crawlRecord.crawlSameDomainOnly
        : typeof crawlRecord.sameDomainOnly === 'boolean'
          ? crawlRecord.sameDomainOnly
          : true

    const respectRobots =
      typeof crawlRecord.crawlRespectRobots === 'boolean'
        ? crawlRecord.crawlRespectRobots
        : typeof crawlRecord.respectRobots === 'boolean'
          ? crawlRecord.respectRobots
          : true

    const excludePatterns = Array.isArray(crawlRecord.crawlExclude)
      ? crawlRecord.crawlExclude.filter((item) => typeof item === 'string')
      : Array.isArray(crawlRecord.excludePatterns)
        ? crawlRecord.excludePatterns.filter((item) => typeof item === 'string')
        : []

    const rootUrl =
      typeof crawlRecord.rootUrl === 'string' ? crawlRecord.rootUrl.trim() : null

    return {
      enabled,
      maxDepth,
      maxPages,
      sameDomainOnly,
      respectRobots,
      excludePatterns,
      rootUrl,
    }
  }

  private normalizeCrawlUrl(rawUrl: string) {
    const next = new URL(rawUrl)
    next.hash = ''
    return next.toString()
  }

  private extractLinksFromHtml(html: string, baseUrl: string) {
    const links = new Set<string>()
    const hrefRegex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi
    let match: RegExpExecArray | null
    while ((match = hrefRegex.exec(html))) {
      const raw = match[1]?.trim()
      if (!raw || raw.startsWith('#')) {
        continue
      }
      if (/^(mailto|tel|javascript):/i.test(raw)) {
        continue
      }
      try {
        const resolved = new URL(raw, baseUrl)
        if (!/^https?:$/i.test(resolved.protocol)) {
          continue
        }
        links.add(this.normalizeCrawlUrl(resolved.toString()))
      } catch {
        continue
      }
    }
    return Array.from(links)
  }

  private buildRobotsRules(text: string) {
    const disallows: string[] = []
    const lines = text.split('\n')
    let applies = false
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) {
        continue
      }
      const [keyRaw, valueRaw] = line.split(':', 2)
      if (!keyRaw || valueRaw === undefined) {
        continue
      }
      const key = keyRaw.trim().toLowerCase()
      const value = valueRaw.trim()
      if (key === 'user-agent') {
        applies = value === '*' || value.toLowerCase() === 'codex-bot'
        continue
      }
      if (key === 'disallow' && applies) {
        if (value) {
          disallows.push(value)
        }
      }
    }
    return {
      disallows,
    }
  }

  private async fetchRobotsRules(origin: string) {
    try {
      const robotsUrl = new URL('/robots.txt', origin)
      const response = await fetch(robotsUrl.toString())
      if (!response.ok) {
        return null
      }
      const text = await response.text()
      return this.buildRobotsRules(text)
    } catch {
      return null
    }
  }

  private isRobotsAllowed(url: string, rules: { disallows: string[] } | null) {
    if (!rules || !rules.disallows.length) {
      return true
    }
    const parsed = new URL(url)
    const path = parsed.pathname || '/'
    return !rules.disallows.some((rule) => rule && path.startsWith(rule))
  }

  private shouldExcludeUrl(url: string, patterns: string[]) {
    if (!patterns.length) {
      return false
    }
    return patterns.some((pattern) => {
      if (!pattern) {
        return false
      }
      if (pattern.startsWith('re:')) {
        try {
          const regex = new RegExp(pattern.slice(3))
          return regex.test(url)
        } catch {
          return false
        }
      }
      return url.includes(pattern)
    })
  }

  private isSameDomain(root: URL, target: URL) {
    return (
      target.hostname === root.hostname ||
      target.hostname.endsWith(`.${root.hostname}`)
    )
  }

  private async crawlKnowledgeUrlSources(input: {
    tenantKey: string
    scope: KnowledgeDocumentScope
    actorUserId: number
    rootUrl: string
    rootDocumentId: string
    refreshPolicy: KnowledgeUrlRefreshPolicy
    tags: string[]
    metadata: Record<string, unknown>
    options: {
      maxDepth: number
      maxPages: number
      sameDomainOnly: boolean
      respectRobots: boolean
      excludePatterns: string[]
    }
    rootRawHtml: string | null
  }) {
    const root = new URL(input.rootUrl)
    const rootKey = this.buildKnowledgeWebSourceKey(input.rootUrl)
    const visited = new Set<string>([this.normalizeCrawlUrl(input.rootUrl)])
    const queue: Array<{ url: string; depth: number; from: string | null }> = []
    const created: string[] = []
    const maxAdditionalPages = Math.max(0, input.options.maxPages - 1)
    const robotsRules = input.options.respectRobots
      ? await this.fetchRobotsRules(root.origin)
      : null

    if (input.rootRawHtml) {
      const links = this.extractLinksFromHtml(input.rootRawHtml, input.rootUrl)
      for (const link of links) {
        queue.push({ url: link, depth: 1, from: input.rootUrl })
      }
    }

    while (queue.length && created.length < maxAdditionalPages) {
      const next = queue.shift()
      if (!next) {
        continue
      }
      const normalizedUrl = this.normalizeCrawlUrl(next.url)
      if (visited.has(normalizedUrl)) {
        continue
      }
      visited.add(normalizedUrl)

      let parsed: URL
      try {
        parsed = new URL(normalizedUrl)
      } catch {
        continue
      }
      if (input.options.sameDomainOnly && !this.isSameDomain(root, parsed)) {
        continue
      }
      if (this.shouldExcludeUrl(normalizedUrl, input.options.excludePatterns)) {
        continue
      }
      if (input.options.respectRobots && !this.isRobotsAllowed(normalizedUrl, robotsRules)) {
        continue
      }

      let resolved: Awaited<ReturnType<KnowledgeService['fetchKnowledgeUrlSource']>>
      try {
        resolved = await this.fetchKnowledgeUrlSource({
          url: normalizedUrl,
          titleOverride: null,
          summaryOverride: null,
          refreshPolicy: input.refreshPolicy,
          previousMetadata: null,
          metadata: {
            ...input.metadata,
            crawlRootUrl: input.rootUrl,
            crawlDepth: next.depth,
            discoveredFrom: next.from,
          },
          sourceLabel: 'admin-web-crawl',
        })
      } catch {
        continue
      }

      if (resolved.notModified) {
        continue
      }

      const sourceKey = this.buildKnowledgeWebSourceKey(resolved.url)
      if (sourceKey === rootKey) {
        continue
      }

      const document = await this.upsertKnowledgeDocument({
        tenantKey: input.tenantKey,
        scope: input.scope,
        sourceType: KnowledgeSourceType.WEB_URL,
        sourceKey,
        title: resolved.title,
        summary: resolved.summary,
        content: resolved.content,
        tags: input.tags,
        piiRiskLevel: 'low',
        metadata: {
          ...input.metadata,
          ...resolved.metadata,
          crawlRootUrl: input.rootUrl,
          crawlDepth: next.depth,
          discoveredFrom: next.from,
          source: 'admin-web-crawl',
        },
        actorUserId: input.actorUserId,
      })
      created.push(document.id)

      await this.syncKnowledgeUrlDerivedFacts({
        tenantKey: input.tenantKey,
        scope: input.scope,
        actorUserId: input.actorUserId,
        url: resolved.url,
        sourceDocumentId: document.id,
        sourceDocumentTitle: resolved.title,
        pageKinds: resolved.analysis?.pageKinds ?? [],
        facts: resolved.analysis?.facts ?? [],
        tags: input.tags,
        sourceLabel: 'admin-web-crawl',
      })

      if (next.depth < input.options.maxDepth && resolved.rawHtml) {
        const links = this.extractLinksFromHtml(resolved.rawHtml, resolved.url)
        for (const link of links) {
          if (created.length + queue.length >= maxAdditionalPages) {
            break
          }
          queue.push({ url: link, depth: next.depth + 1, from: resolved.url })
        }
      }
    }

    return {
      createdCount: created.length,
      createdIds: created,
    }
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
    await this.syncKnowledgeDerivedArtifactsForDocument(document)
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

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { OpenAiClientService } from '../common/openai/openai-client.service'
import { buildKnowledgeDocumentChunks } from './knowledge-chunking'

type EmbeddingProjection = {
  provider: string
  model: string
  dimensions: number
  vector: number[]
  contentHash: string
  latencyMs: number
  cacheHit: boolean
  providerError: string | null
}

type EmbeddingModeSummary = {
  provider: string
  mode: 'semantic' | 'fallback'
  model: string
  dimensions: number
}

@Injectable()
export class KnowledgeEmbeddingsService {
  private static readonly OPENAI_TIMEOUT_MS = 12_000
  private static readonly DEFAULT_CACHE_SIZE = 2_000
  private readonly projectionCache = new Map<string, EmbeddingProjection>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly openAiClient: OpenAiClientService,
  ) {}

  async indexDocument(document: {
    tenantKey: string
    id: string
    scope: string
    sourceType: string
    title: string
    summary: string | null
    content: string
    tags: string[]
    metadata?: unknown
  }) {
    const projection = await this.projectDocument(document)

    await this.prisma.knowledgeDocumentEmbedding.upsert({
      where: { documentId: document.id },
      update: {
        provider: projection.provider,
        model: projection.model,
        dimensions: projection.dimensions,
        contentHash: projection.contentHash,
        vector: projection.vector,
      },
      create: {
        documentId: document.id,
        provider: projection.provider,
        model: projection.model,
        dimensions: projection.dimensions,
        contentHash: projection.contentHash,
        vector: projection.vector,
      },
    })

    const chunkResult = await this.indexDocumentChunks(document)

    return {
      ...projection,
      chunksIndexed: chunkResult.indexed,
    }
  }

  async indexDocuments(documents: Array<{
    tenantKey: string
    id: string
    scope: string
    sourceType: string
    title: string
    summary: string | null
    content: string
    tags: string[]
    metadata?: unknown
  }>) {
    let chunkCount = 0
    for (const document of documents) {
      const result = await this.indexDocument(document)
      chunkCount += Number(result?.chunksIndexed || 0)
    }

    return {
      indexed: documents.length,
      chunksIndexed: chunkCount,
    }
  }

  async projectQuery(query: string) {
    return this.projectText(query)
  }

  async projectQueryProjection(query: string) {
    return this.embedTextProjection(query)
  }

  async projectText(input: string) {
    const projection = await this.embedTextProjection(input)
    return projection.vector
  }

  describeProjectionMode(projection: {
    provider?: string | null
    model?: string | null
    dimensions?: number | null
  } | null): EmbeddingModeSummary {
    const provider =
      typeof projection?.provider === 'string' && projection.provider.trim()
        ? projection.provider.trim().toLowerCase()
        : 'local'
    return {
      provider,
      mode: provider === 'openai' ? 'semantic' : 'fallback',
      model:
        typeof projection?.model === 'string' && projection.model.trim()
          ? projection.model.trim()
          : provider === 'openai'
            ? this.getModel('openai')
            : this.getModel('local'),
      dimensions:
        typeof projection?.dimensions === 'number' &&
        Number.isFinite(projection.dimensions) &&
        projection.dimensions > 0
          ? projection.dimensions
          : this.getDimensions(provider === 'openai' ? 'openai' : 'local'),
    }
  }

  cosineSimilarity(left: number[], right: number[]) {
    if (!left.length || !right.length || left.length !== right.length) {
      return 0
    }

    let dot = 0
    let leftNorm = 0
    let rightNorm = 0

    for (let index = 0; index < left.length; index += 1) {
      dot += left[index] * right[index]
      leftNorm += left[index] * left[index]
      rightNorm += right[index] * right[index]
    }

    if (!leftNorm || !rightNorm) {
      return 0
    }

    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
  }

  private async projectDocument(document: {
    title: string
    summary: string | null
    content: string
    tags: string[]
  }): Promise<EmbeddingProjection> {
    const serialized = [
      document.title,
      document.summary ?? '',
      document.tags.join(' '),
      document.content,
    ]
      .filter(Boolean)
      .join('\n')

    return this.embedTextProjection(serialized)
  }

  private async indexDocumentChunks(document: {
    tenantKey: string
    id: string
    scope: string
    sourceType: string
    title: string
    summary: string | null
    content: string
    tags: string[]
    metadata?: unknown
  }) {
    const chunks = buildKnowledgeDocumentChunks({
      id: document.id,
      content: document.content,
    })

    if (!chunks.length) {
      await this.prisma.knowledgeDocumentChunk.deleteMany({
        where: { documentId: document.id },
      })
      return { indexed: 0 }
    }

    const chunkKeys: string[] = []

    for (const chunk of chunks) {
      const projection = await this.embedTextProjection(
        [
          document.title,
          document.summary ?? '',
          document.tags.join(' '),
          chunk.text,
        ]
          .filter(Boolean)
          .join('\n'),
      )
      chunkKeys.push(chunk.id)
      await this.prisma.knowledgeDocumentChunk.upsert({
        where: { chunkKey: chunk.id },
        update: {
          tenantKey: document.tenantKey,
          scope: document.scope as never,
          sourceType: document.sourceType as never,
          chunkIndex: chunk.index,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
          charLength: chunk.text.length,
          content: chunk.text,
          tags: document.tags,
          metadata:
            document.metadata && typeof document.metadata === 'object'
              ? (document.metadata as never)
              : undefined,
          provider: projection.provider,
          model: projection.model,
          dimensions: projection.dimensions,
          contentHash: projection.contentHash,
          vector: projection.vector,
        },
        create: {
          chunkKey: chunk.id,
          tenantKey: document.tenantKey,
          documentId: document.id,
          scope: document.scope as never,
          sourceType: document.sourceType as never,
          chunkIndex: chunk.index,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
          charLength: chunk.text.length,
          content: chunk.text,
          tags: document.tags,
          metadata:
            document.metadata && typeof document.metadata === 'object'
              ? (document.metadata as never)
              : undefined,
          provider: projection.provider,
          model: projection.model,
          dimensions: projection.dimensions,
          contentHash: projection.contentHash,
          vector: projection.vector,
        },
      })
    }

    await this.prisma.knowledgeDocumentChunk.deleteMany({
      where: {
        documentId: document.id,
        chunkKey: { notIn: chunkKeys },
      },
    })

    return {
      indexed: chunkKeys.length,
    }
  }

  private async embedTextProjection(input: string): Promise<EmbeddingProjection> {
    const serialized = String(input || '')
    const contentHash = createHash('sha256').update(serialized).digest('hex')
    const cached = this.projectionCache.get(contentHash)

    if (cached) {
      return {
        ...cached,
        cacheHit: true,
      }
    }

    const provider = await this.resolveProvider()
    const startedAt = Date.now()

    if (provider === 'openai') {
      const projection = await this.embedWithOpenAi(serialized, contentHash)
      if (projection) {
        return this.memoizeProjection(projection, contentHash)
      }
    }

    return this.memoizeProjection(
      {
      provider: 'local',
      model: 'local-hash-v1',
      dimensions: this.getDimensions('local'),
      vector: this.embedTextLocal(serialized),
      contentHash,
      latencyMs: Date.now() - startedAt,
      cacheHit: false,
      providerError:
        provider === 'openai' ? 'knowledge_embedding_provider_fallback' : null,
    },
      contentHash,
    )
  }

  private embedTextLocal(input: string) {
    const dimensions = this.getDimensions('local')
    const vector = Array.from({ length: dimensions }, () => 0)
    const tokens = input
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 2)

    for (const token of tokens) {
      const hash = this.hashToken(token)
      const slot = hash % dimensions
      const sign = hash % 2 === 0 ? 1 : -1
      vector[slot] += sign * (1 + token.length / 12)
    }

    const norm = Math.sqrt(vector.reduce((acc, value) => acc + value * value, 0))
    if (!norm) {
      return vector
    }

    return vector.map((value) => Number((value / norm).toFixed(6)))
  }

  private async embedWithOpenAi(
    input: string,
    contentHash: string,
  ): Promise<EmbeddingProjection | null> {
    const apiKey = await this.resolveOpenAiApiKey()
    if (!apiKey) {
      return null
    }

    try {
      const startedAt = Date.now()
      const payload = await this.openAiClient.requestJson<{ data?: Array<{ embedding?: number[] }> }>('/embeddings', {
        apiKey,
        timeoutMs: KnowledgeEmbeddingsService.OPENAI_TIMEOUT_MS,
        body: {
          model: this.getModel('openai'),
          input,
          encoding_format: 'float',
          dimensions: this.getDimensions('openai'),
        },
      })
      const vector = Array.isArray(payload?.data?.[0]?.embedding)
        ? payload.data[0].embedding.filter((value) => typeof value === 'number')
        : []
      if (!vector.length) {
        throw new Error('knowledge_embedding_openai_empty_vector')
      }

      return {
        provider: 'openai',
        model: this.getModel('openai'),
        dimensions: vector.length,
        vector,
        contentHash,
        latencyMs: Date.now() - startedAt,
        cacheHit: false,
        providerError: null,
      }
    } catch (error) {
      console.warn('[knowledge] Falling back to local embeddings', error)
      return null
    }
  }

  private hashToken(token: string) {
    const digest = createHash('sha1').update(token).digest()
    return digest.readUInt32BE(0)
  }

  private async resolveProvider() {
    const configured = String(
      this.config.get<string>('KNOWLEDGE_EMBEDDING_PROVIDER') || 'auto',
    )
      .trim()
      .toLowerCase()
    if (configured === 'local') {
      return 'local'
    }
    const runtime = await this.openAiClient.resolveRuntimeConfig()
    const openAiReady =
      runtime.enabled !== false && runtime.provider === 'openai' && runtime.openAiApiKey
    if (configured === 'openai') {
      return openAiReady ? 'openai' : 'local'
    }

    return openAiReady ? 'openai' : 'local'
  }

  private getModel(provider: 'local' | 'openai') {
    if (provider === 'openai') {
      return (
        this.config.get<string>('KNOWLEDGE_EMBEDDING_MODEL') ||
        'text-embedding-3-small'
      )
    }

    return 'local-hash-v1'
  }

  private getDimensions(provider: 'local' | 'openai') {
    const fallback = provider === 'openai' ? 256 : 128
    const raw = Number(
      this.config.get<string>('KNOWLEDGE_EMBEDDING_DIMENSIONS') || fallback,
    )
    return Number.isFinite(raw) && raw > 0 ? raw : fallback
  }

  private async resolveOpenAiApiKey() {
    const runtime = await this.openAiClient.resolveRuntimeConfig()
    return runtime.enabled !== false && runtime.provider === 'openai'
      ? runtime.openAiApiKey?.trim() || null
      : null
  }

  private memoizeProjection(
    projection: EmbeddingProjection,
    contentHash: string,
  ): EmbeddingProjection {
    const cachedProjection = {
      ...projection,
      cacheHit: false,
    }
    this.projectionCache.set(contentHash, cachedProjection)
    if (
      this.projectionCache.size >
      Number(
        this.config.get<number>('KNOWLEDGE_EMBEDDING_CACHE_SIZE') ||
          KnowledgeEmbeddingsService.DEFAULT_CACHE_SIZE,
      )
    ) {
      const oldestKey = this.projectionCache.keys().next().value
      if (typeof oldestKey === 'string') {
        this.projectionCache.delete(oldestKey)
      }
    }
    return cachedProjection
  }
}

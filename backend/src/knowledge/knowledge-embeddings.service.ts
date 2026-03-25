import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'

type EmbeddingProjection = {
  provider: string
  model: string
  dimensions: number
  vector: number[]
  contentHash: string
}

@Injectable()
export class KnowledgeEmbeddingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async indexDocument(document: {
    id: string
    title: string
    summary: string | null
    content: string
    tags: string[]
  }) {
    const projection = this.projectDocument(document)

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

    return projection
  }

  async indexDocuments(documents: Array<{
    id: string
    title: string
    summary: string | null
    content: string
    tags: string[]
  }>) {
    for (const document of documents) {
      await this.indexDocument(document)
    }

    return {
      indexed: documents.length,
    }
  }

  projectQuery(query: string) {
    return this.embedText(query)
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

  private projectDocument(document: {
    title: string
    summary: string | null
    content: string
    tags: string[]
  }): EmbeddingProjection {
    const serialized = [
      document.title,
      document.summary ?? '',
      document.tags.join(' '),
      document.content,
    ]
      .filter(Boolean)
      .join('\n')

    return {
      provider: this.getProvider(),
      model: this.getModel(),
      dimensions: this.getDimensions(),
      vector: this.embedText(serialized),
      contentHash: createHash('sha256').update(serialized).digest('hex'),
    }
  }

  private embedText(input: string) {
    const dimensions = this.getDimensions()
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

  private hashToken(token: string) {
    const digest = createHash('sha1').update(token).digest()
    return digest.readUInt32BE(0)
  }

  private getProvider() {
    return this.config.get<string>('KNOWLEDGE_EMBEDDING_PROVIDER') || 'local'
  }

  private getModel() {
    return this.config.get<string>('KNOWLEDGE_EMBEDDING_MODEL') || 'local-hash-v1'
  }

  private getDimensions() {
    const raw = Number(this.config.get<string>('KNOWLEDGE_EMBEDDING_DIMENSIONS') || 128)
    return Number.isFinite(raw) && raw > 0 ? raw : 128
  }
}

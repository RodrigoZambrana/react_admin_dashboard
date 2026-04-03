import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createHash } from 'node:crypto';

type UpsertKnowledgeVectorInput = {
  id: string;
  tenantId: string;
  summary: string;
  category: string;
};

@Injectable()
export class QdrantStoreService {
  private readonly client: QdrantClient | null;
  private readonly collectionName = 'knowledge';

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('QDRANT_URL');
    this.client = url
      ? new QdrantClient({ url, checkCompatibility: false })
      : null;
  }

  async healthCheck() {
    if (!this.client) {
      return {
        status: 'error' as const,
        detail: 'QDRANT_URL is not configured',
      };
    }

    const collections = await this.client.getCollections();

    return {
      status: 'ok' as const,
      collections: collections.collections.length,
    };
  }

  async ensureCollection() {
    if (!this.client) {
      return;
    }

    const collections = await this.client.getCollections();
    const exists = collections.collections.some(
      (collection) => collection.name === this.collectionName,
    );

    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: 16,
          distance: 'Cosine',
        },
      });
    }
  }

  async upsert(input: UpsertKnowledgeVectorInput) {
    if (!this.client) {
      return null;
    }

    await this.ensureCollection();
    const vector = createDeterministicVector(`${input.tenantId}:${input.summary}`);

    await this.client.upsert(this.collectionName, {
      wait: false,
      points: [
        {
          id: input.id,
          vector,
          payload: {
            tenantId: input.tenantId,
            category: input.category,
            summary: input.summary,
          },
        },
      ],
    });

    return input.id;
  }
}

function createDeterministicVector(input: string) {
  const digest = createHash('sha256').update(input).digest();
  return Array.from({ length: 16 }, (_, index) => {
    const value = digest[index] ?? 0;
    return Number((value / 255).toFixed(6));
  });
}

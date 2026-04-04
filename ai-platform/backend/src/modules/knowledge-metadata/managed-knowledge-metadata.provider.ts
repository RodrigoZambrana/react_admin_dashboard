import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { KnowledgeMetadataVersionRepository } from '../persistence/repositories/knowledge-metadata-version.repository';
import { RuntimeManagedResourceVersion } from '../runtime-resources/runtime-managed-resource.types';
import { FileSystemKnowledgeMetadataSeedSource } from './filesystem-knowledge-metadata.seed-source';
import { KnowledgeMetadataProvider } from './knowledge-metadata.provider';
import {
  KnowledgeMetadataKey,
  KnowledgeMetadataResource,
  parseKnowledgeMetadataKey,
  parseKnowledgeMetadataResource,
} from './knowledge-metadata.types';

@Injectable()
export class ManagedKnowledgeMetadataProvider extends KnowledgeMetadataProvider {
  constructor(
    private readonly knowledgeMetadataVersionRepository: KnowledgeMetadataVersionRepository,
    private readonly seedSource: FileSystemKnowledgeMetadataSeedSource,
  ) {
    super();
  }

  async getActive(
    key: KnowledgeMetadataKey,
  ): Promise<
    RuntimeManagedResourceVersion<KnowledgeMetadataKey, KnowledgeMetadataResource> | null
  > {
    await this.ensureBootstrapSeeded();
    const resource = await this.knowledgeMetadataVersionRepository.getActiveByKey(key);
    return resource ? this.mapRecord(resource) : null;
  }

  async listActive(): Promise<
    Array<RuntimeManagedResourceVersion<KnowledgeMetadataKey, KnowledgeMetadataResource>>
  > {
    await this.ensureBootstrapSeeded();
    const resources = await this.knowledgeMetadataVersionRepository.listActive();
    return resources.map((resource) => this.mapRecord(resource));
  }

  private async ensureBootstrapSeeded() {
    const hasAnyVersions =
      await this.knowledgeMetadataVersionRepository.hasAnyVersions();

    if (hasAnyVersions) {
      return;
    }

    const seeds = await this.seedSource.listSeeds();

    for (const seed of seeds) {
      await this.knowledgeMetadataVersionRepository.createVersion({
        key: seed.key,
        resource: seed.value as Prisma.InputJsonValue,
        metadata: seed.metadata as Prisma.InputJsonValue,
        createdBy: seed.createdBy,
        activate: true,
      });
    }
  }

  private mapRecord(record: {
    id: string;
    key: string;
    resource: unknown;
    version: number;
    status: string;
    metadata: unknown;
    createdAt: Date;
    createdBy: string | null;
  }): RuntimeManagedResourceVersion<
    KnowledgeMetadataKey,
    KnowledgeMetadataResource
  > {
    return {
      id: record.id,
      key: parseKnowledgeMetadataKey(record.key),
      value: parseKnowledgeMetadataResource(record.resource),
      version: record.version,
      status: record.status as RuntimeManagedResourceVersion<
        KnowledgeMetadataKey,
        KnowledgeMetadataResource
      >['status'],
      metadata: record.metadata as RuntimeManagedResourceVersion<
        KnowledgeMetadataKey,
        KnowledgeMetadataResource
      >['metadata'],
      createdAt: record.createdAt,
      createdBy: record.createdBy,
    };
  }
}

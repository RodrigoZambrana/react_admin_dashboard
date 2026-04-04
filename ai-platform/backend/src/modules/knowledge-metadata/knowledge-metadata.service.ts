import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { KnowledgeMetadataVersionRepository } from '../persistence/repositories/knowledge-metadata-version.repository';
import { KnowledgeMetadataProvider } from './knowledge-metadata.provider';
import {
  KnowledgeMetadataKey,
  KnowledgeMetadataResource,
  parseKnowledgeMetadataKey,
  parseKnowledgeMetadataResource,
} from './knowledge-metadata.types';

@Injectable()
export class KnowledgeMetadataService {
  constructor(
    @Inject(KnowledgeMetadataProvider)
    private readonly knowledgeMetadataProvider: KnowledgeMetadataProvider,
    private readonly knowledgeMetadataVersionRepository: KnowledgeMetadataVersionRepository,
    private readonly logger: PipelineLoggerService,
  ) {}

  async getActiveResource(key: KnowledgeMetadataKey = 'default') {
    const resource = await this.knowledgeMetadataProvider.getActive(key);

    this.logger.debug(
      JSON.stringify({
        stage: 'knowledge_metadata.retrieve',
        key,
        version: resource?.version ?? null,
      }),
    );

    return resource;
  }

  async getActivePolicy(key: KnowledgeMetadataKey = 'default') {
    return (await this.getActiveResource(key))?.value ?? null;
  }

  async listVersions(key?: KnowledgeMetadataKey) {
    await this.knowledgeMetadataProvider.listActive();
    return this.knowledgeMetadataVersionRepository.list(key);
  }

  async listActiveResources() {
    const resources = await this.knowledgeMetadataProvider.listActive();

    return resources.map((resource) => ({
      id: resource.id,
      key: resource.key,
      resource: resource.value,
      version: resource.version,
      status: resource.status,
      metadata: resource.metadata,
      createdAt: resource.createdAt,
      createdBy: resource.createdBy,
    }));
  }

  async createVersion(input: {
    key: KnowledgeMetadataKey;
    resource: KnowledgeMetadataResource;
    createdBy?: string;
    activate?: boolean;
  }) {
    const key = parseKnowledgeMetadataKey(input.key);
    const resource = parseKnowledgeMetadataResource(input.resource);
    const version = await this.knowledgeMetadataVersionRepository.createVersion({
      key,
      resource: resource as Prisma.InputJsonValue,
      createdBy: input.createdBy,
      activate: input.activate,
    });

    this.logger.log(
      JSON.stringify({
        stage: 'knowledge_metadata.versioned',
        key: version.key,
        version: version.version,
        status: version.status,
      }),
    );

    return version;
  }
}

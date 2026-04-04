import { Injectable } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RuntimeManagedResourceSeedSource } from '../runtime-resources/runtime-managed-resource.seed-source';
import { RuntimeManagedResourceSeed } from '../runtime-resources/runtime-managed-resource.types';
import {
  KnowledgeMetadataKey,
  KnowledgeMetadataResource,
  knowledgeMetadataKeySchema,
  knowledgeMetadataResourceSchema,
} from './knowledge-metadata.types';

@Injectable()
export class FileSystemKnowledgeMetadataSeedSource extends RuntimeManagedResourceSeedSource<
  KnowledgeMetadataKey,
  KnowledgeMetadataResource
> {
  private readonly seeds = this.loadSeeds();

  async getSeed(
    key: KnowledgeMetadataKey,
  ): Promise<
    RuntimeManagedResourceSeed<KnowledgeMetadataKey, KnowledgeMetadataResource> | null
  > {
    return this.seeds.get(key) ?? null;
  }

  async listSeeds(): Promise<
    Array<RuntimeManagedResourceSeed<KnowledgeMetadataKey, KnowledgeMetadataResource>>
  > {
    return Array.from(this.seeds.values());
  }

  private loadSeeds() {
    const directory = resolve(__dirname, '../../resources/knowledge-metadata');
    const entries = readdirSync(directory).filter((entry) => entry.endsWith('.json'));

    return new Map(
      entries.map((entry) => {
        const key = knowledgeMetadataKeySchema.parse(entry.replace(/\.json$/, ''));
        const resource = knowledgeMetadataResourceSchema.parse(
          JSON.parse(readFileSync(resolve(directory, entry), 'utf8')),
        );

        return [
          key,
          {
            key,
            value: resource,
            createdBy: 'system:knowledge-metadata-seed',
            metadata: {
              origin: 'seed' as const,
              seedKey: key,
              source: 'filesystem',
            },
          },
        ];
      }),
    );
  }
}

import { Injectable } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RuntimeManagedResourceSeedSource } from '../runtime-resources/runtime-managed-resource.seed-source';
import { RuntimeManagedResourceSeed } from '../runtime-resources/runtime-managed-resource.types';
import { PromptTemplateKey, promptTemplateKeySchema } from './prompt.types';

@Injectable()
export class FileSystemPromptTemplateSeedSource extends RuntimeManagedResourceSeedSource<
  PromptTemplateKey,
  string
> {
  private readonly seeds = this.loadSeeds();

  async getSeed(
    key: PromptTemplateKey,
  ): Promise<RuntimeManagedResourceSeed<PromptTemplateKey, string> | null> {
    return this.seeds.get(key) ?? null;
  }

  async listSeeds(): Promise<
    Array<RuntimeManagedResourceSeed<PromptTemplateKey, string>>
  > {
    return Array.from(this.seeds.values());
  }

  private loadSeeds() {
    const directory = resolve(__dirname, '../../resources/prompts');
    const entries = readdirSync(directory).filter((entry) => entry.endsWith('.txt'));

    return new Map(
      entries.map((entry) => {
        const key = promptTemplateKeySchema.parse(entry.replace(/\.txt$/, ''));

        return [
          key,
          {
            key,
            value: readFileSync(resolve(directory, entry), 'utf8').trim(),
            createdBy: 'system:prompt-seed',
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

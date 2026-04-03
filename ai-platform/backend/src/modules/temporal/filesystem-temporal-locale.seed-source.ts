import { Injectable } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  TemporalLocaleResource,
  temporalLocaleResourceSchema,
} from './temporal-locale.types';
import { RuntimeManagedResourceSeedSource } from '../runtime-resources/runtime-managed-resource.seed-source';
import { RuntimeManagedResourceSeed } from '../runtime-resources/runtime-managed-resource.types';

@Injectable()
export class FileSystemTemporalLocaleSeedSource extends RuntimeManagedResourceSeedSource<
  string,
  TemporalLocaleResource
> {
  private readonly resources = this.loadResources();

  async getSeed(
    key: string,
  ): Promise<RuntimeManagedResourceSeed<string, TemporalLocaleResource> | null> {
    const normalizedLocale = normalizeLocaleCode(key);

    if (!normalizedLocale) {
      return null;
    }

    const resource =
      this.resources.get(normalizedLocale) ??
      this.resources.get(normalizedLocale.split('-')[0]);

    if (!resource) {
      return null;
    }

    return {
      key: resource.locale.toLowerCase(),
      value: resource,
      createdBy: 'system:temporal-seed',
      metadata: {
        origin: 'seed',
        seedKey: resource.locale.toLowerCase(),
        source: 'filesystem',
      },
    };
  }

  async listSeeds(): Promise<
    Array<RuntimeManagedResourceSeed<string, TemporalLocaleResource>>
  > {
    return Array.from(this.resources.values()).map((resource) => ({
      key: resource.locale.toLowerCase(),
      value: resource,
      createdBy: 'system:temporal-seed',
      metadata: {
        origin: 'seed',
        seedKey: resource.locale.toLowerCase(),
        source: 'filesystem',
      },
    }));
  }

  private loadResources() {
    const directory = resolve(__dirname, '../../resources/temporal/locales');
    const entries = readdirSync(directory).filter((entry) => entry.endsWith('.json'));

    return new Map(
      entries.map((entry) => {
        const raw = readFileSync(resolve(directory, entry), 'utf8');
        const resource = temporalLocaleResourceSchema.parse(JSON.parse(raw));

        return [resource.locale.toLowerCase(), resource];
      }),
    );
  }
}

function normalizeLocaleCode(locale?: string | null) {
  const normalized = locale?.trim().toLowerCase();
  return normalized ? normalized : null;
}

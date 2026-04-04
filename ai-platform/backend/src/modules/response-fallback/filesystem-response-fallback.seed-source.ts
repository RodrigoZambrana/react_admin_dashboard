import { Injectable } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RuntimeManagedResourceSeedSource } from '../runtime-resources/runtime-managed-resource.seed-source';
import { RuntimeManagedResourceSeed } from '../runtime-resources/runtime-managed-resource.types';
import {
  ResponseFallbackCatalogResource,
  responseFallbackCatalogResourceSchema,
} from './response-fallback.types';

@Injectable()
export class FileSystemResponseFallbackSeedSource extends RuntimeManagedResourceSeedSource<
  string,
  ResponseFallbackCatalogResource
> {
  private readonly resources = this.loadResources();

  async getSeed(
    key: string,
  ): Promise<
    RuntimeManagedResourceSeed<string, ResponseFallbackCatalogResource> | null
  > {
    const normalizedLocale = normalizeLocaleCode(key);

    if (!normalizedLocale) {
      return null;
    }

    const resource =
      this.resources.get(normalizedLocale) ??
      this.resources.get(normalizedLocale.split('-')[0]) ??
      this.resources.get('default');

    if (!resource) {
      return null;
    }

    return {
      key: resource.locale.toLowerCase(),
      value: resource,
      createdBy: 'system:response-fallback-seed',
      metadata: {
        origin: 'seed',
        seedKey: resource.locale.toLowerCase(),
        source: 'filesystem',
      },
    };
  }

  async listSeeds(): Promise<
    Array<RuntimeManagedResourceSeed<string, ResponseFallbackCatalogResource>>
  > {
    return Array.from(this.resources.values()).map((resource) => ({
      key: resource.locale.toLowerCase(),
      value: resource,
      createdBy: 'system:response-fallback-seed',
      metadata: {
        origin: 'seed',
        seedKey: resource.locale.toLowerCase(),
        source: 'filesystem',
      },
    }));
  }

  private loadResources() {
    const directory = resolve(
      __dirname,
      '../../resources/response-fallback/locales',
    );
    const entries = readdirSync(directory).filter((entry) => entry.endsWith('.json'));

    return new Map(
      entries.map((entry) => {
        const raw = readFileSync(resolve(directory, entry), 'utf8');
        const resource = responseFallbackCatalogResourceSchema.parse(
          JSON.parse(raw),
        );

        return [resource.locale.toLowerCase(), resource];
      }),
    );
  }
}

function normalizeLocaleCode(locale?: string | null) {
  const normalized = locale?.trim().toLowerCase();
  return normalized ? normalized : null;
}

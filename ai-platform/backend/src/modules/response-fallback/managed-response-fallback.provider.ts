import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { RuntimeManagedResourceVersion } from '../runtime-resources/runtime-managed-resource.types';
import { ResponseFallbackVersionRepository } from '../persistence/repositories/response-fallback-version.repository';
import {
  ResponseFallbackCatalogResource,
  responseFallbackCatalogResourceSchema,
} from './response-fallback.types';
import { ResponseFallbackProvider } from './response-fallback.provider';
import { FileSystemResponseFallbackSeedSource } from './filesystem-response-fallback.seed-source';

@Injectable()
export class ManagedResponseFallbackProvider extends ResponseFallbackProvider {
  private seedCatalogCache:
    | Map<string, ResponseFallbackCatalogResource>
    | null = null;

  constructor(
    private readonly responseFallbackVersionRepository: ResponseFallbackVersionRepository,
    private readonly seedSource: FileSystemResponseFallbackSeedSource,
  ) {
    super();
  }

  async getActive(
    key: string,
  ): Promise<
    RuntimeManagedResourceVersion<string, ResponseFallbackCatalogResource> | null
  > {
    await this.ensureBootstrapSeeded();
    const resource = await this.findActiveRecord(key);
    const seedCatalogs = await this.getSeedCatalogs();

    return resource ? this.mapRecord(resource, seedCatalogs) : null;
  }

  async listActive() {
    await this.ensureBootstrapSeeded();
    const resources = await this.responseFallbackVersionRepository.listActive();
    const seedCatalogs = await this.getSeedCatalogs();

    return resources.map((resource) => this.mapRecord(resource, seedCatalogs));
  }

  async resolveCatalog(locale?: string | null) {
    const resolved =
      (await this.getActive(locale ?? 'default')) ??
      (await this.getActive('default'));

    if (!resolved) {
      throw new Error('No active response fallback catalog is available.');
    }

    return resolved.value;
  }

  private async ensureBootstrapSeeded() {
    const hasAnyVersions =
      await this.responseFallbackVersionRepository.hasAnyVersions();

    if (hasAnyVersions) {
      return;
    }

    const seeds = await this.seedSource.listSeeds();

    for (const seed of seeds) {
      await this.responseFallbackVersionRepository.createVersion({
        locale: seed.key,
        resource: seed.value as Prisma.InputJsonValue,
        metadata: seed.metadata as Prisma.InputJsonValue,
        createdBy: seed.createdBy,
        activate: true,
      });
    }
  }

  private async getSeedCatalogs() {
    if (this.seedCatalogCache) {
      return this.seedCatalogCache;
    }

    const seeds = await this.seedSource.listSeeds();
    const catalogMap = new Map<string, ResponseFallbackCatalogResource>();

    for (const seed of seeds) {
      catalogMap.set(
        seed.key,
        responseFallbackCatalogResourceSchema.parse(seed.value),
      );
    }

    this.seedCatalogCache = catalogMap;
    return catalogMap;
  }

  private async findActiveRecord(locale: string) {
    const normalizedLocale = normalizeLocaleCode(locale);

    if (!normalizedLocale) {
      return this.responseFallbackVersionRepository.getActiveByLocale('default');
    }

    return (
      (await this.responseFallbackVersionRepository.getActiveByLocale(
        normalizedLocale,
      )) ??
      (normalizedLocale.includes('-')
        ? this.responseFallbackVersionRepository.getActiveByLocale(
            normalizedLocale.split('-')[0],
          )
        : null) ??
      this.responseFallbackVersionRepository.getActiveByLocale('default')
    );
  }

  private mapRecord(record: {
    id: string;
    locale: string;
    resource: unknown;
    version: number;
    status: string;
    metadata: unknown;
    createdAt: Date;
    createdBy: string | null;
  }, seedCatalogs: Map<string, ResponseFallbackCatalogResource>): RuntimeManagedResourceVersion<string, ResponseFallbackCatalogResource> {
    const mergedResource = mergeCatalogWithSeeds(
      record.locale,
      record.resource,
      seedCatalogs,
    );

    return {
      id: record.id,
      key: record.locale,
      value: responseFallbackCatalogResourceSchema.parse(mergedResource),
      version: record.version,
      status: record.status as RuntimeManagedResourceVersion<
        string,
        ResponseFallbackCatalogResource
      >['status'],
      metadata: record.metadata as RuntimeManagedResourceVersion<
        string,
        ResponseFallbackCatalogResource
      >['metadata'],
      createdAt: record.createdAt,
      createdBy: record.createdBy,
    };
  }
}

function normalizeLocaleCode(locale?: string | null) {
  const normalized = locale?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function mergeCatalogWithSeeds(
  locale: string,
  resource: unknown,
  seedCatalogs: Map<string, ResponseFallbackCatalogResource>,
) {
  const normalizedLocale = normalizeLocaleCode(locale) ?? 'default';
  const defaultSeed = seedCatalogs.get('default');
  const localeSeed =
    seedCatalogs.get(normalizedLocale) ??
    (normalizedLocale.includes('-')
      ? seedCatalogs.get(normalizedLocale.split('-')[0])
      : null);

  const base = mergeDeep(defaultSeed ?? {}, localeSeed ?? {});
  return mergeDeep(base, resource);
}

function mergeDeep<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override ?? base) as T;
  }

  const result: Record<string, unknown> = {
    ...base,
  };

  for (const [key, overrideValue] of Object.entries(override)) {
    const baseValue = result[key];

    if (Array.isArray(overrideValue)) {
      result[key] = [...overrideValue];
      continue;
    }

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = mergeDeep(baseValue, overrideValue);
      continue;
    }

    result[key] = overrideValue;
  }

  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

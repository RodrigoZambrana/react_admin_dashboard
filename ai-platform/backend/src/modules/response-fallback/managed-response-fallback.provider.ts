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

    return resource ? this.mapRecord(resource) : null;
  }

  async listActive() {
    await this.ensureBootstrapSeeded();
    const resources = await this.responseFallbackVersionRepository.listActive();

    return resources.map((resource) => this.mapRecord(resource));
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
  }): RuntimeManagedResourceVersion<string, ResponseFallbackCatalogResource> {
    return {
      id: record.id,
      key: record.locale,
      value: responseFallbackCatalogResourceSchema.parse(record.resource),
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

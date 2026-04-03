import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { TemporalLocaleVersionRepository } from '../persistence/repositories/temporal-locale-version.repository';
import { TemporalLocaleProvider } from './temporal-locale.provider';
import {
  TemporalLocaleResource,
  temporalLocaleResourceSchema,
} from './temporal-locale.types';
import { FileSystemTemporalLocaleSeedSource } from './filesystem-temporal-locale.seed-source';
import { RuntimeManagedResourceVersion } from '../runtime-resources/runtime-managed-resource.types';

@Injectable()
export class ManagedTemporalLocaleProvider extends TemporalLocaleProvider {
  constructor(
    private readonly temporalLocaleVersionRepository: TemporalLocaleVersionRepository,
    private readonly seedSource: FileSystemTemporalLocaleSeedSource,
  ) {
    super();
  }

  async getActive(
    key: string,
  ): Promise<RuntimeManagedResourceVersion<string, TemporalLocaleResource> | null> {
    await this.ensureBootstrapSeeded();
    const resource = await this.findActiveRecord(key);

    return resource ? this.mapRecord(resource) : null;
  }

  async listActive() {
    await this.ensureBootstrapSeeded();
    const resources = await this.temporalLocaleVersionRepository.listActive();

    return resources.map((resource) => this.mapRecord(resource));
  }

  async listResources(): Promise<TemporalLocaleResource[]> {
    const resources = await this.listActive();
    return resources.map((resource) => resource.value);
  }

  async getSupportedLocales(): Promise<string[]> {
    const resources = await this.listActive();
    return resources.map((resource) => resource.key);
  }

  async resolveResource(
    locale?: string | null,
  ): Promise<TemporalLocaleResource | undefined> {
    if (!locale?.trim()) {
      return undefined;
    }

    const resolved = await this.getActive(locale);
    return resolved?.value;
  }

  async resolveResources(locale?: string | null): Promise<TemporalLocaleResource[]> {
    const resolved = await this.resolveResource(locale);

    return resolved ? [resolved] : this.listResources();
  }

  private async ensureBootstrapSeeded() {
    const hasAnyVersions =
      await this.temporalLocaleVersionRepository.hasAnyVersions();

    if (hasAnyVersions) {
      return;
    }

    const seeds = await this.seedSource.listSeeds();

    for (const seed of seeds) {
      await this.temporalLocaleVersionRepository.createVersion({
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
      return null;
    }

    return (
      (await this.temporalLocaleVersionRepository.getActiveByLocale(
        normalizedLocale,
      )) ??
      (normalizedLocale.includes('-')
        ? this.temporalLocaleVersionRepository.getActiveByLocale(
            normalizedLocale.split('-')[0],
          )
        : null)
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
  }): RuntimeManagedResourceVersion<string, TemporalLocaleResource> {
    return {
      id: record.id,
      key: record.locale,
      value: temporalLocaleResourceSchema.parse(record.resource),
      version: record.version,
      status: record.status as RuntimeManagedResourceVersion<
        string,
        TemporalLocaleResource
      >['status'],
      metadata: record.metadata as RuntimeManagedResourceVersion<
        string,
        TemporalLocaleResource
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

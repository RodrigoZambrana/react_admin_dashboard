import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { TemporalLocaleVersionRepository } from '../persistence/repositories/temporal-locale-version.repository';
import { TemporalLocaleProvider } from './temporal-locale.provider';
import {
  TemporalLocaleResource,
  temporalLocaleResourceSchema,
} from './temporal-locale.types';

@Injectable()
export class TemporalLocaleService {
  constructor(
    @Inject(TemporalLocaleProvider)
    private readonly temporalLocaleProvider: TemporalLocaleProvider,
    private readonly temporalLocaleVersionRepository: TemporalLocaleVersionRepository,
    private readonly logger: PipelineLoggerService,
  ) {}

  async listVersions(locale?: string) {
    await this.temporalLocaleProvider.listActive();
    return this.temporalLocaleVersionRepository.list(locale);
  }

  async listActiveLocales() {
    const resources = await this.temporalLocaleProvider.listActive();

    return resources.map((resource) => ({
      id: resource.id,
      locale: resource.key,
      resource: resource.value,
      version: resource.version,
      status: resource.status,
      metadata: resource.metadata,
      createdAt: resource.createdAt,
      createdBy: resource.createdBy,
    }));
  }

  async createVersion(input: {
    locale: string;
    resource: TemporalLocaleResource;
    createdBy?: string;
    activate?: boolean;
  }) {
    const resource = temporalLocaleResourceSchema.parse(input.resource);
    const created = await this.temporalLocaleVersionRepository.createVersion({
      locale: input.locale,
      resource: resource as Prisma.InputJsonValue,
      createdBy: input.createdBy,
      activate: input.activate,
      metadata: {
        origin: 'admin',
      } as Prisma.InputJsonValue,
    });

    this.logger.log(
      JSON.stringify({
        stage: 'temporal_locale.versioned',
        locale: created.locale,
        version: created.version,
        status: created.status,
      }),
    );

    return created;
  }

  async activateVersion(versionId: string, createdBy?: string) {
    const existing = await this.temporalLocaleVersionRepository.findById(versionId);

    if (!existing) {
      throw new NotFoundException(
        `Temporal locale version ${versionId} was not found`,
      );
    }

    if (existing.status === 'ACTIVE') {
      return existing;
    }

    const resource = temporalLocaleResourceSchema.parse(existing.resource);
    const created = await this.temporalLocaleVersionRepository.createVersion({
      locale: existing.locale,
      resource: resource as Prisma.InputJsonValue,
      createdBy,
      activate: true,
      metadata: {
        ...(existing.metadata as Record<string, unknown> | null | undefined),
        origin: 'admin',
        activatedFromVersionId: existing.id,
        activatedFromVersion: existing.version,
      } as Prisma.InputJsonValue,
    });

    this.logger.log(
      JSON.stringify({
        stage: 'temporal_locale.activated',
        locale: created.locale,
        version: created.version,
        sourceVersionId: existing.id,
        sourceVersion: existing.version,
      }),
    );

    return created;
  }
}

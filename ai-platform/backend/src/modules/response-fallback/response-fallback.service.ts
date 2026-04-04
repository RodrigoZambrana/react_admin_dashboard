import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { ResponseFallbackVersionRepository } from '../persistence/repositories/response-fallback-version.repository';
import { ResponseFallbackProvider } from './response-fallback.provider';
import {
  ResponseFallbackCatalogResource,
  ResponseFallbackTemplateKey,
  responseFallbackCatalogResourceSchema,
} from './response-fallback.types';

@Injectable()
export class ResponseFallbackService {
  constructor(
    @Inject(ResponseFallbackProvider)
    private readonly responseFallbackProvider: ResponseFallbackProvider,
    private readonly responseFallbackVersionRepository: ResponseFallbackVersionRepository,
    private readonly logger: PipelineLoggerService,
  ) {}

  async resolveCatalog(locale?: string | null) {
    const catalog = await this.responseFallbackProvider.resolveCatalog(locale);

    this.logger.debug(
      JSON.stringify({
        stage: 'response_fallback.retrieve',
        locale: locale ?? 'default',
        resolvedLocale: catalog.locale,
      }),
    );

    return catalog;
  }

  async render(input: {
    locale?: string | null;
    templateKey: ResponseFallbackTemplateKey;
    variables?: Record<string, string | number | null | undefined>;
  }) {
    const catalog = await this.resolveCatalog(input.locale);
    const template = catalog.templates[input.templateKey];

    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      const value = input.variables?.[key];
      return value === undefined || value === null ? '' : String(value);
    });
  }

  async getActionLabel(locale: string | undefined, toolName: string | null | undefined) {
    const catalog = await this.resolveCatalog(locale);

    if (toolName === 'create_booking') {
      return catalog.actionLabels.create_booking;
    }

    if (toolName === 'create_quote') {
      return catalog.actionLabels.create_quote;
    }

    if (toolName === 'get_product') {
      return catalog.actionLabels.get_product;
    }

    return catalog.actionLabels.default;
  }

  async getDefaults(locale?: string | null) {
    return (await this.resolveCatalog(locale)).defaults;
  }

  async listVersions(locale?: string) {
    await this.responseFallbackProvider.listActive();
    return this.responseFallbackVersionRepository.list(locale);
  }

  async listActiveCatalogs() {
    const catalogs = await this.responseFallbackProvider.listActive();

    return catalogs.map((catalog) => ({
      id: catalog.id,
      locale: catalog.key,
      resource: catalog.value,
      version: catalog.version,
      status: catalog.status,
      metadata: catalog.metadata,
      createdAt: catalog.createdAt,
      createdBy: catalog.createdBy,
    }));
  }

  async createVersion(input: {
    locale: string;
    resource: ResponseFallbackCatalogResource;
    createdBy?: string;
    activate?: boolean;
  }) {
    const resource = responseFallbackCatalogResourceSchema.parse(input.resource);
    const created = await this.responseFallbackVersionRepository.createVersion({
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
        stage: 'response_fallback.versioned',
        locale: created.locale,
        version: created.version,
        status: created.status,
      }),
    );

    return created;
  }
}

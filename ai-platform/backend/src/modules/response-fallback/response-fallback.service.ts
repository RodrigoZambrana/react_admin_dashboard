import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { ResponseFallbackVersionRepository } from '../persistence/repositories/response-fallback-version.repository';
import { ResponseFallbackProvider } from './response-fallback.provider';
import { resolveBootstrapTemplateFallback } from './response-fallback-bootstrap.catalogs';
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
    variationSeed?: string | null;
  }) {
    const catalog = await this.resolveCatalog(input.locale);
    const template = this.resolveTemplate(
      catalog,
      input.templateKey,
      input.variationSeed,
      input.locale,
    );

    return template.value.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_, key: string) => {
        const value = input.variables?.[key];
        return value === undefined || value === null ? '' : String(value);
      },
    );
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

  async startsWithGreeting(locale: string | null | undefined, value: string) {
    const normalizedValue = value.trim().toLowerCase();

    if (!normalizedValue) {
      return false;
    }

    const catalog = await this.resolveCatalog(locale);
    const cues = catalog.greetingCues ?? [];

    return cues.some((cue) => normalizedValue.startsWith(cue.toLowerCase()));
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

  async activateVersion(versionId: string, createdBy?: string) {
    const existing = await this.responseFallbackVersionRepository.findById(
      versionId,
    );

    if (!existing) {
      throw new NotFoundException(
        `Response fallback version ${versionId} was not found`,
      );
    }

    if (existing.status === 'ACTIVE') {
      return existing;
    }

    const resource = responseFallbackCatalogResourceSchema.parse(existing.resource);
    const created = await this.responseFallbackVersionRepository.createVersion({
      locale: existing.locale,
      resource: resource as Prisma.InputJsonValue,
      metadata: {
        ...(typeof existing.metadata === 'object' && existing.metadata
          ? (existing.metadata as Record<string, unknown>)
          : {}),
        origin: 'admin',
        activatedFromVersionId: existing.id,
        activatedFromVersion: existing.version,
      } as Prisma.InputJsonValue,
      createdBy,
      activate: true,
    });

    this.logger.log(
      JSON.stringify({
        stage: 'response_fallback.activated',
        locale: created.locale,
        version: created.version,
        sourceVersionId: existing.id,
        sourceVersion: existing.version,
      }),
    );

    return created;
  }

  private resolveTemplate(
    catalog: ResponseFallbackCatalogResource,
    templateKey: ResponseFallbackTemplateKey,
    variationSeed?: string | null,
    requestedLocale?: string | null,
  ) {
    const configuredVariants = catalog.templateVariants?.[templateKey] ?? [];
    const normalizedSeed = variationSeed?.trim();

    if (configuredVariants.length === 0 || !normalizedSeed) {
      this.logger.debug(
        JSON.stringify({
          stage: 'response_fallback.render',
          locale: catalog.locale,
          templateKey,
          variantCount: configuredVariants.length,
          selectedVariantIndex: null,
        }),
      );

      return {
        value: this.resolveTemplateValue(catalog, templateKey, requestedLocale),
        selectedVariantIndex: null as number | null,
      };
    }

    const selectedVariantIndex =
      this.computeDeterministicIndex(
        `${catalog.locale}:${templateKey}:${normalizedSeed}`,
        configuredVariants.length,
      );

    this.logger.debug(
      JSON.stringify({
        stage: 'response_fallback.render',
        locale: catalog.locale,
        templateKey,
        variantCount: configuredVariants.length,
        selectedVariantIndex,
      }),
    );

    return {
      value:
        configuredVariants[selectedVariantIndex] ??
        this.resolveTemplateValue(catalog, templateKey, requestedLocale),
      selectedVariantIndex,
    };
  }

  private resolveTemplateValue(
    catalog: ResponseFallbackCatalogResource,
    templateKey: ResponseFallbackTemplateKey,
    requestedLocale?: string | null,
  ) {
    const resolved = resolveBootstrapTemplateFallback({
      templateKey,
      requestedLocale,
      resolvedLocale: catalog.locale,
      configuredValue: catalog.templates[templateKey],
    });

    if (resolved) {
      return resolved;
    }

    throw new Error(`Fallback template "${templateKey}" is not configured`);
  }

  private computeDeterministicIndex(seed: string, length: number) {
    let hash = 0;

    for (const character of seed) {
      hash = Math.imul(hash, 31) + character.charCodeAt(0);
      hash |= 0;
    }

    return Math.abs(hash) % length;
  }
}

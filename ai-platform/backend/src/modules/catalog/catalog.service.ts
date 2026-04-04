import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogSourceKind,
  CatalogSyncStatus,
  ManagedResourceStatus,
  Prisma,
} from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { CatalogItemRepository } from '../persistence/repositories/catalog-item.repository';
import { CatalogSourceRepository } from '../persistence/repositories/catalog-source.repository';
import {
  buildCatalogSearchText,
  normalizeCatalogText,
  tokenizeCatalogText,
} from './catalog-mapping.utils';
import { CatalogRestSourceAdapter } from './catalog-rest-source.adapter';
import { CatalogStructuredSourceService } from './catalog-structured-source.service';
import {
  createRestCatalogSourceSchema,
  CreateRestCatalogSourceInput,
  ProductCatalogMatch,
  RestCatalogSourceConfig,
} from './catalog.types';

@Injectable()
export class CatalogService {
  constructor(
    private readonly catalogSourceRepository: CatalogSourceRepository,
    private readonly catalogItemRepository: CatalogItemRepository,
    private readonly catalogStructuredSourceService: CatalogStructuredSourceService,
    private readonly catalogRestSourceAdapter: CatalogRestSourceAdapter,
    private readonly logger: PipelineLoggerService,
  ) {}

  listSources(filters?: {
    status?: ManagedResourceStatus;
    kind?: CatalogSourceKind;
    limit?: number;
  }) {
    return this.catalogSourceRepository.list(filters);
  }

  async getSource(sourceId: string) {
    const source = await this.catalogSourceRepository.findById(sourceId);

    if (!source) {
      throw new NotFoundException(`Catalog source ${sourceId} was not found`);
    }

    return source;
  }

  async createUploadedSource(input: {
    title?: string;
    file: {
      originalName: string;
      mimeType?: string | null;
      buffer: Buffer;
    };
    activate?: boolean;
    createdBy?: string;
    language?: string;
  }) {
    const extracted = await this.catalogStructuredSourceService.extractItemsFromUpload({
      originalName: input.file.originalName,
      mimeType: input.file.mimeType ?? null,
      buffer: input.file.buffer,
      language: input.language ?? null,
    });

    const created = await this.catalogSourceRepository.create({
      title:
        input.title?.trim() ||
        deriveCatalogTitle(input.file.originalName),
      kind: CatalogSourceKind.UPLOADED_STRUCTURED,
      status: ManagedResourceStatus.DRAFT,
      syncStatus: CatalogSyncStatus.PENDING,
      sourceName: extracted.sourceName,
      mimeType: extracted.mimeType ?? null,
      metadata: {
        createdBy: input.createdBy ?? 'admin-ui',
        originKind: CatalogSourceKind.UPLOADED_STRUCTURED,
      } as Prisma.InputJsonValue,
    });

    await this.catalogSourceRepository.markSyncing(created.id);

    await this.catalogItemRepository.replaceForSource({
      sourceId: created.id,
      items: extracted.items.map((item) => ({
        externalId: item.externalId ?? null,
        sku: item.sku ?? null,
        name: item.name,
        description: item.description ?? null,
        price: item.price ?? null,
        currency: item.currency ?? null,
        availability: item.availability ?? null,
        attributes: (item.attributes ?? {}) as Prisma.InputJsonValue,
        searchText: item.searchText || buildCatalogSearchText(item),
      })),
    });

    const ready = await this.catalogSourceRepository.markReady({
      sourceId: created.id,
      status:
        input.activate ?? true
          ? ManagedResourceStatus.ACTIVE
          : ManagedResourceStatus.DRAFT,
      itemCount: extracted.items.length,
      metadata: {
        createdBy: input.createdBy ?? 'admin-ui',
        originKind: CatalogSourceKind.UPLOADED_STRUCTURED,
      } as Prisma.InputJsonValue,
    });

    this.logger.log(
      JSON.stringify({
        stage: 'catalog.uploaded',
        sourceId: ready.id,
        kind: ready.kind,
        itemCount: ready.itemCount,
        status: ready.status,
      }),
    );

    return ready;
  }

  async createRestSource(input: CreateRestCatalogSourceInput) {
    const parsed = createRestCatalogSourceSchema.parse(input);
    const created = await this.catalogSourceRepository.create({
      title: parsed.title.trim(),
      kind: CatalogSourceKind.REST,
      status: ManagedResourceStatus.DRAFT,
      syncStatus: CatalogSyncStatus.PENDING,
      endpointUrl: parsed.endpointUrl,
      sourceConfig: parsed as Prisma.InputJsonValue,
      metadata: {
        createdBy: parsed.createdBy ?? 'admin-ui',
        originKind: CatalogSourceKind.REST,
      } as Prisma.InputJsonValue,
    });

    return this.syncRestSource(created.id, {
      activate: parsed.activate,
      createdBy: parsed.createdBy,
    });
  }

  async syncSource(sourceId: string, activate?: boolean) {
    const source = await this.getSource(sourceId);

    if (source.kind !== CatalogSourceKind.REST) {
      return source;
    }

    return this.syncRestSource(sourceId, {
      activate: activate ?? source.status === ManagedResourceStatus.ACTIVE,
    });
  }

  activateSource(sourceId: string) {
    return this.catalogSourceRepository.activate(sourceId);
  }

  archiveSource(sourceId: string) {
    return this.catalogSourceRepository.archive(sourceId);
  }

  async findMatch(input: {
    sku?: string;
    query?: string | null;
  }): Promise<ProductCatalogMatch> {
    const sku = input.sku?.trim();

    if (sku) {
      const items = await this.catalogItemRepository.listByActiveSources(500);
      const exactSku = items.find(
        (item) => item.sku && item.sku.toLowerCase() === sku.toLowerCase(),
      );

      if (exactSku) {
        return {
          matched: true,
          matchedBy: 'sku',
          score: 100,
          product: mapCatalogItemRecord(exactSku),
        };
      }
    }

    const query = input.query?.trim();

    if (!query) {
      return {
        matched: false,
        matchedBy: null,
        product: null,
        score: 0,
      };
    }

    const normalizedQuery = normalizeCatalogText(query);
    const queryTokens = tokenizeCatalogText(query);
    const items = await this.catalogItemRepository.listByActiveSources(500);
    const candidates = items
      .map((item) => ({
        item,
        score: scoreCatalogItem({
          normalizedQuery,
          queryTokens,
          name: item.name,
          searchText: item.searchText,
        }),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score);
    const best = candidates[0];

    if (!best) {
      return {
        matched: false,
        matchedBy: null,
        product: null,
        score: 0,
      };
    }

    return {
      matched: true,
      matchedBy: 'query',
      product: mapCatalogItemRecord(best.item),
      score: best.score,
    };
  }

  private async syncRestSource(
    sourceId: string,
    options?: { activate?: boolean; createdBy?: string },
  ) {
    const source = await this.getSource(sourceId);

    if (source.kind !== CatalogSourceKind.REST) {
      throw new BadRequestException(
        `Catalog source ${sourceId} is not a REST-backed source`,
      );
    }

    const sourceConfig = source.sourceConfig as RestCatalogSourceConfig | null;

    if (!sourceConfig) {
      throw new BadRequestException(
        `Catalog source ${sourceId} does not contain REST configuration`,
      );
    }

    await this.catalogSourceRepository.markSyncing(sourceId);

    try {
      const items = await this.catalogRestSourceAdapter.fetchItems(sourceConfig);

      await this.catalogItemRepository.replaceForSource({
        sourceId,
        items: items.map((item) => ({
          externalId: item.externalId ?? null,
          sku: item.sku ?? null,
          name: item.name,
          description: item.description ?? null,
          price: item.price ?? null,
          currency: item.currency ?? null,
          availability: item.availability ?? null,
          attributes: (item.attributes ?? {}) as Prisma.InputJsonValue,
          searchText: item.searchText || buildCatalogSearchText(item),
        })),
      });

      const ready = await this.catalogSourceRepository.markReady({
        sourceId,
        status:
          (options?.activate ?? source.status === ManagedResourceStatus.ACTIVE)
            ? ManagedResourceStatus.ACTIVE
            : ManagedResourceStatus.DRAFT,
        itemCount: items.length,
        metadata: {
          ...(typeof source.metadata === 'object' && source.metadata
            ? (source.metadata as Record<string, unknown>)
            : {}),
          createdBy: options?.createdBy ?? 'admin-ui',
          originKind: CatalogSourceKind.REST,
        } as Prisma.InputJsonValue,
      });

      this.logger.log(
        JSON.stringify({
          stage: 'catalog.rest_synced',
          sourceId: ready.id,
          endpointUrl: ready.endpointUrl,
          itemCount: ready.itemCount,
          status: ready.status,
        }),
      );

      return ready;
    } catch (error) {
      await this.catalogSourceRepository.markFailed(
        sourceId,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }
}

function scoreCatalogItem(input: {
  normalizedQuery: string;
  queryTokens: string[];
  name: string;
  searchText: string;
}) {
  const normalizedName = normalizeCatalogText(input.name);
  const normalizedSearch = normalizeCatalogText(input.searchText);
  const searchTokens = tokenizeCatalogText(input.searchText);
  const overlap = searchTokens.filter((token) =>
    input.queryTokens.includes(token),
  ).length;

  if (input.normalizedQuery.includes(normalizedName)) {
    return 95;
  }

  if (
    input.queryTokens.length >= 2 &&
    overlap >= input.queryTokens.length &&
    overlap >= Math.min(2, searchTokens.length)
  ) {
    return 82;
  }

  if (
    input.queryTokens.length >= 2 &&
    input.queryTokens.every((token) => normalizedSearch.includes(token))
  ) {
    return 72;
  }

  return 0;
}

function mapCatalogItemRecord(item: Awaited<
  ReturnType<CatalogItemRepository['listByActiveSources']>
>[number]) {
  return {
    id: item.id,
    sourceId: item.sourceId,
    sourceKind: item.source.kind,
    sourceTitle: item.source.title,
    externalId: item.externalId ?? null,
    sku: item.sku ?? null,
    name: item.name,
    description: item.description ?? null,
    price: item.price ?? null,
    currency: item.currency ?? null,
    availability: item.availability ?? null,
    attributes:
      item.attributes && typeof item.attributes === 'object'
        ? (item.attributes as Record<string, unknown>)
        : null,
  };
}

function deriveCatalogTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'Uploaded catalog';
}

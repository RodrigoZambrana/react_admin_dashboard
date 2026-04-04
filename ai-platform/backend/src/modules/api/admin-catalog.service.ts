import { BadRequestException, Injectable } from '@nestjs/common';
import { CatalogSourceKind, ManagedResourceStatus } from '@prisma/client';

import { CatalogService } from '../catalog/catalog.service';

@Injectable()
export class AdminCatalogService {
  constructor(private readonly catalogService: CatalogService) {}

  listSources(input: { status?: string; kind?: string; limit?: number }) {
    return this.catalogService.listSources({
      status: input.status ? this.parseStatus(input.status) : undefined,
      kind: input.kind ? this.parseKind(input.kind) : undefined,
      limit: normalizeLimit(input.limit, 50),
    });
  }

  getSource(sourceId: string) {
    return this.catalogService.getSource(sourceId);
  }

  createUploadedSource(input: {
    title?: string;
    language?: string;
    createdBy?: string;
    activate?: boolean;
    file: {
      originalName: string;
      mimeType?: string | null;
      buffer: Buffer;
    };
  }) {
    return this.catalogService.createUploadedSource(input);
  }

  createRestSource(input: {
    title: string;
    endpointUrl: string;
    queryParam?: string;
    skuParam?: string;
    itemsPath?: string;
    headers?: Record<string, string>;
    fieldMap?: Record<string, string>;
    createdBy?: string;
    activate?: boolean;
  }) {
    return this.catalogService.createRestSource({
      title: input.title,
      endpointUrl: input.endpointUrl,
      queryParam: input.queryParam,
      skuParam: input.skuParam,
      itemsPath: input.itemsPath,
      headers: input.headers ?? {},
      fieldMap: input.fieldMap ?? {},
      createdBy: input.createdBy,
      activate: input.activate ?? true,
    });
  }

  syncSource(sourceId: string, activate?: boolean) {
    return this.catalogService.syncSource(sourceId, activate);
  }

  activateSource(sourceId: string) {
    return this.catalogService.activateSource(sourceId);
  }

  archiveSource(sourceId: string) {
    return this.catalogService.archiveSource(sourceId);
  }

  private parseStatus(value: string) {
    const normalized = value.trim().toUpperCase();

    if (
      normalized === ManagedResourceStatus.DRAFT ||
      normalized === ManagedResourceStatus.ACTIVE ||
      normalized === ManagedResourceStatus.ARCHIVED
    ) {
      return normalized as ManagedResourceStatus;
    }

    throw new BadRequestException(`Unsupported catalog source status "${value}"`);
  }

  private parseKind(value: string) {
    const normalized = value.trim().toUpperCase();

    if (
      normalized === CatalogSourceKind.UPLOADED_STRUCTURED ||
      normalized === CatalogSourceKind.REST
    ) {
      return normalized as CatalogSourceKind;
    }

    throw new BadRequestException(`Unsupported catalog source kind "${value}"`);
  }
}

function normalizeLimit(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value) || !value || value < 1) {
    return fallback;
  }

  return Math.min(Math.floor(value), 100);
}

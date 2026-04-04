import { BadRequestException, Injectable } from '@nestjs/common';

import { StructuredCatalogUploadAdapter } from '../tenant-resources/structured-catalog-upload.adapter';
import { CatalogItemCandidate } from './catalog.types';
import {
  buildCatalogSearchText,
  mapStructuredRowToCatalogItem,
} from './catalog-mapping.utils';

@Injectable()
export class CatalogStructuredSourceService {
  constructor(
    private readonly structuredCatalogUploadAdapter: StructuredCatalogUploadAdapter,
  ) {}

  async extractItemsFromUpload(input: {
    originalName: string;
    mimeType?: string | null;
    buffer: Buffer;
    language?: string | null;
  }) {
    const extracted = await this.structuredCatalogUploadAdapter.extractFromUpload({
      sourceName: input.originalName,
      mimeType: input.mimeType ?? null,
      buffer: input.buffer,
      language: input.language ?? null,
    });

    if (extracted.contentType !== 'table') {
      throw new BadRequestException(
        'Structured catalog uploads must produce tabular rows',
      );
    }

    const items = extracted.rows
      .map((row) => mapStructuredRowToCatalogItem(row))
      .filter((item): item is CatalogItemCandidate => Boolean(item))
      .map((item) => ({
        ...item,
        attributes: item.attributes ?? {},
      }));

    if (items.length === 0) {
      throw new BadRequestException(
        'Structured catalog upload did not produce usable catalog items',
      );
    }

    return {
      mimeType: extracted.mimeType ?? input.mimeType ?? null,
      sourceName: extracted.sourceName ?? input.originalName,
      items: items.map((item) => ({
        ...item,
        searchText: buildCatalogSearchText(item),
      })),
    };
  }
}

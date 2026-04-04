import { Injectable } from '@nestjs/common';

import { CatalogService } from '../catalog/catalog.service';

export type ProductCatalogEntry = {
  id: string;
  sourceId: string;
  sourceKind: string;
  sourceTitle: string;
  externalId?: string | null;
  sku?: string | null;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  availability?: string | null;
  attributes?: Record<string, unknown> | null;
};

export class ProductCatalogNoMatchError extends Error {
  constructor(query: string) {
    super(`No product match found for query "${query}"`);
  }
}

@Injectable()
export class ProductCatalogService {
  constructor(private readonly catalogService: CatalogService) {}

  async findMatch(input: { sku?: string; query?: string | null }) {
    return this.catalogService.findMatch(input);
  }
}

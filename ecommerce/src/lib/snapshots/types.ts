import type { CategorySummary, ProductSummary, StorefrontConfig } from "@/types/storefront";

export interface SnapshotProductCollections {
  featured: ProductSummary[];
  newest: ProductSummary[];
  bestSellers: ProductSummary[];
  byCategory: Record<string, ProductSummary[]>;
}

export interface StorefrontSnapshot {
  version: number;
  capturedAt: string;
  config: StorefrontConfig;
  categories: CategorySummary[];
  products: SnapshotProductCollections;
}

export interface StorefrontSnapshotRecord {
  value: StorefrontSnapshot;
  storedAt: string;
}

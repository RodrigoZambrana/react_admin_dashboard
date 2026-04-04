import {
  CatalogSourceKind,
  CatalogSyncStatus,
  ManagedResourceStatus,
} from '@prisma/client';
import { z } from 'zod';

export const catalogSourceKindSchema = z.nativeEnum(CatalogSourceKind);
export const catalogSyncStatusSchema = z.nativeEnum(CatalogSyncStatus);
export const catalogLifecycleStatusSchema = z.nativeEnum(ManagedResourceStatus);

export const restCatalogFieldMapSchema = z.object({
  externalId: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  price: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  availability: z.string().min(1).optional(),
});

export const createRestCatalogSourceSchema = z.object({
  title: z.string().min(1).max(200),
  endpointUrl: z.string().url(),
  queryParam: z.string().min(1).optional(),
  skuParam: z.string().min(1).optional(),
  itemsPath: z.string().min(1).optional(),
  headers: z.record(z.string().min(1), z.string()).default({}),
  fieldMap: restCatalogFieldMapSchema.default({}),
  activate: z.boolean().default(true),
  createdBy: z.string().min(1).max(120).optional(),
});

export type CreateRestCatalogSourceInput = z.infer<
  typeof createRestCatalogSourceSchema
>;

export type CatalogProduct = {
  id: string;
  sourceId: string;
  sourceKind: CatalogSourceKind;
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

export type ProductCatalogMatch =
  | {
      matched: false;
      matchedBy: null;
      product: null;
      score: 0;
    }
  | {
      matched: true;
      matchedBy: 'sku' | 'query';
      product: CatalogProduct;
      score: number;
    };

export type CatalogItemCandidate = {
  externalId?: string | null;
  sku?: string | null;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  availability?: string | null;
  attributes?: Record<string, unknown>;
};

export type RestCatalogSourceConfig = Omit<
  CreateRestCatalogSourceInput,
  'title' | 'activate' | 'createdBy'
>;

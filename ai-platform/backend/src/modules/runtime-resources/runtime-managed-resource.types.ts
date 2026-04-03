import { z } from 'zod';

export const managedResourceStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
]);

export type ManagedResourceStatus = z.infer<typeof managedResourceStatusSchema>;

export const managedResourceOriginSchema = z.enum([
  'seed',
  'admin',
  'import',
  'system',
]);

export const managedResourceMetadataSchema = z
  .object({
    origin: managedResourceOriginSchema,
    seedKey: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
    checksum: z.string().min(1).optional(),
  })
  .passthrough();

export type ManagedResourceMetadata = z.infer<
  typeof managedResourceMetadataSchema
>;

export type RuntimeManagedResourceSeed<TKey extends string, TValue> = {
  key: TKey;
  value: TValue;
  createdBy?: string;
  metadata?: ManagedResourceMetadata;
};

export type RuntimeManagedResourceVersion<TKey extends string, TValue> = {
  id: string;
  key: TKey;
  value: TValue;
  version: number;
  status: ManagedResourceStatus;
  metadata: ManagedResourceMetadata | null;
  createdAt: Date;
  createdBy: string | null;
};

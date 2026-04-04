import { z } from 'zod';

export const knowledgeMetadataKeySchema = z.enum(['default']);
export type KnowledgeMetadataKey = z.infer<typeof knowledgeMetadataKeySchema>;

export const knowledgeStageMetadataPolicySchema = z.object({
  enabled: z.boolean().default(true),
  minConfidence: z.number().min(0).max(1).default(0.6),
  defaultTags: z.array(z.string()).default([]),
});

export const knowledgeMetadataResourceSchema = z.object({
  enabledStages: z.array(z.string().min(1)).min(1),
  metadataAllowList: z.array(z.string()).default([]),
  stagePolicies: z.record(knowledgeStageMetadataPolicySchema).default({}),
});

export type KnowledgeMetadataResource = z.infer<
  typeof knowledgeMetadataResourceSchema
>;

export function parseKnowledgeMetadataKey(value: unknown): KnowledgeMetadataKey {
  return knowledgeMetadataKeySchema.parse(value);
}

export function parseKnowledgeMetadataResource(
  value: unknown,
): KnowledgeMetadataResource {
  return knowledgeMetadataResourceSchema.parse(value);
}

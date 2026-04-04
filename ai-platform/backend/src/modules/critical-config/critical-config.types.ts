import { z } from 'zod';

export const criticalConfigKeySchema = z.enum(['ai_runtime', 'learning']);
export type CriticalConfigKey = z.infer<typeof criticalConfigKeySchema>;

export const aiCredentialSourceSchema = z.object({
  strategy: z.enum(['none', 'env']),
  envKey: z.string().min(1).nullable().optional(),
});

export const aiRuntimeResourceSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  timeoutMs: z.number().int().positive(),
  credentials: aiCredentialSourceSchema,
  providerOptions: z.record(z.unknown()).default({}),
});

export const learningRuntimeResourceSchema = z.object({
  enabled: z.boolean().default(true),
  observedStages: z.array(z.string().min(1)).min(1),
  minConfidence: z.number().min(0).max(1).default(0.6),
  maxBodyLength: z.number().int().positive().default(240),
  maxSummaryLength: z.number().int().positive().default(180),
  persistEmbeddings: z.boolean().default(true),
});

export type AiRuntimeResource = z.infer<typeof aiRuntimeResourceSchema>;
export type LearningRuntimeResource = z.infer<
  typeof learningRuntimeResourceSchema
>;

export type CriticalConfigResourceMap = {
  ai_runtime: AiRuntimeResource;
  learning: LearningRuntimeResource;
};

export type CriticalConfigValue = AiRuntimeResource | LearningRuntimeResource;

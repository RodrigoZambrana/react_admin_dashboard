import { z } from 'zod';
import {
  buildDefaultTenantCapabilitiesResource,
  TenantCapabilitiesResource,
  tenantCapabilitiesResourceSchema,
} from '../tenant-capabilities/tenant-capability.types';

export const criticalConfigKeySchema = z.enum([
  'ai_runtime',
  'learning',
  'async_intake',
  'tenant_capabilities',
]);
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

export const asyncIntakeLexiconSchema = z.object({
  leadingTokens: z.array(z.string().min(1)).default([]),
  trailingTokens: z.array(z.string().min(1)).default([]),
  slotPatterns: z.array(z.string().min(1)).default([]),
});

export const asyncIntakeRuntimeResourceSchema = z.object({
  stabilization: z.object({
    defaultDelayMs: z.number().int().positive().default(900),
    maxWindowMs: z.number().int().positive().default(2600),
    fragmentContinuationDelayMs: z.number().int().positive().default(1700),
    trailingThoughtDelayMs: z.number().int().positive().default(1500),
    shortMessageDelayMs: z.number().int().positive().default(1300),
    mediumIncompleteDelayMs: z.number().int().positive().default(1000),
    longCompletedDelayMs: z.number().int().nonnegative().default(350),
    shortMessageLengthThreshold: z.number().int().positive().default(24),
    mediumMessageLengthThreshold: z.number().int().positive().default(120),
    longCompletedLengthThreshold: z.number().int().positive().default(50),
  }),
  replyProjection: z.object({
    minDelayMs: z.number().int().nonnegative().default(900),
    maxDelayMs: z.number().int().positive().default(2600),
    charDelayMs: z.number().int().nonnegative().default(18),
  }),
  lexicons: z.record(z.string().min(1), asyncIntakeLexiconSchema).default({}),
});

export type AiRuntimeResource = z.infer<typeof aiRuntimeResourceSchema>;
export type LearningRuntimeResource = z.infer<
  typeof learningRuntimeResourceSchema
>;
export type AsyncIntakeRuntimeResource = z.infer<
  typeof asyncIntakeRuntimeResourceSchema
>;
export type AsyncIntakeLexicon = z.infer<typeof asyncIntakeLexiconSchema>;
export type TenantCapabilityRuntimeResource = TenantCapabilitiesResource;

export function buildDefaultAsyncIntakeRuntimeResource(): AsyncIntakeRuntimeResource {
  return {
    stabilization: {
      defaultDelayMs: 900,
      maxWindowMs: 2600,
      fragmentContinuationDelayMs: 1700,
      trailingThoughtDelayMs: 1500,
      shortMessageDelayMs: 1300,
      mediumIncompleteDelayMs: 1000,
      longCompletedDelayMs: 350,
      shortMessageLengthThreshold: 24,
      mediumMessageLengthThreshold: 120,
      longCompletedLengthThreshold: 50,
    },
    replyProjection: {
      minDelayMs: 900,
      maxDelayMs: 2600,
      charDelayMs: 18,
    },
    lexicons: {
      default: {
        leadingTokens: [],
        trailingTokens: [],
        slotPatterns: [
          '\\d+(?:[.,]\\d+)?\\s*(?:x|por)\\s*\\d+(?:[.,]\\d+)?(?:\\s*(?:cm|cms|m|mt|mts|mm))?',
          '\\d+\\s*(?:unidad(?:es)?|unid(?:ades)?|u)\\b',
        ],
      },
      es: {
        leadingTokens: [
          'de',
          'del',
          'con',
          'sin',
          'para',
          'por',
          'en',
          'y',
          'o',
          'pero',
          'si',
          'sí',
        ],
        trailingTokens: ['de', 'con', 'para', 'porque', 'por', 'y', 'o', 'que', 'si', 'sí', 'pero'],
        slotPatterns: [],
      },
      en: {
        leadingTokens: ['with', 'without', 'for', 'by', 'and', 'or', 'but', 'if'],
        trailingTokens: ['with', 'for', 'because', 'by', 'and', 'or', 'that', 'if', 'but'],
        slotPatterns: [],
      },
    },
  };
}

export function buildDefaultTenantCapabilityRuntimeResource(): TenantCapabilityRuntimeResource {
  return buildDefaultTenantCapabilitiesResource();
}

export type CriticalConfigResourceMap = {
  ai_runtime: AiRuntimeResource;
  learning: LearningRuntimeResource;
  async_intake: AsyncIntakeRuntimeResource;
  tenant_capabilities: TenantCapabilityRuntimeResource;
};

export type CriticalConfigValue =
  | AiRuntimeResource
  | LearningRuntimeResource
  | AsyncIntakeRuntimeResource
  | TenantCapabilityRuntimeResource;

export function parseCriticalConfigValue<TKey extends CriticalConfigKey>(
  key: TKey,
  value: unknown,
): CriticalConfigResourceMap[TKey] {
  if (key === 'ai_runtime') {
    return aiRuntimeResourceSchema.parse(value) as CriticalConfigResourceMap[TKey];
  }

  if (key === 'async_intake') {
    return asyncIntakeRuntimeResourceSchema.parse(
      value,
    ) as CriticalConfigResourceMap[TKey];
  }

  if (key === 'tenant_capabilities') {
    return tenantCapabilitiesResourceSchema.parse(
      value,
    ) as CriticalConfigResourceMap[TKey];
  }

  return learningRuntimeResourceSchema.parse(
    value,
  ) as CriticalConfigResourceMap[TKey];
}

import { z } from 'zod';

export const interpretationResultSchema = z.object({
  intent: z.string().min(1),
  entities: z.record(z.unknown()),
  language: z.string().min(2),
  confidence: z.number().min(0).max(1),
});

export type InterpretationResult = z.infer<typeof interpretationResultSchema>;

export const interpretationAttemptSchema = z.object({
  interpretation: interpretationResultSchema,
  rawAiResponse: z.string().nullable(),
  parsedJson: interpretationResultSchema.nullable(),
  error: z.string().nullable(),
  provider: z.string().min(1),
  model: z.string().nullable(),
  usedFallback: z.boolean(),
});

export type InterpretationAttempt = z.infer<typeof interpretationAttemptSchema>;

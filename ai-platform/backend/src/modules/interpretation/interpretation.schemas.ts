import { z } from 'zod';

export const canonicalIntentValues = [
  'GENERAL_CONVERSATION',
  'CLARIFICATION',
  'GET_PRODUCT',
  'CREATE_BOOKING',
  'CREATE_QUOTE',
] as const;

export const canonicalIntentSchema = z.enum(canonicalIntentValues);

export const interpretationResultSchema = z.object({
  intent: z.string().min(1),
  entities: z.record(z.unknown()),
  language: z.string().min(2),
  confidence: z.number().min(0).max(1),
});

export type InterpretationResult = z.infer<typeof interpretationResultSchema>;

export const canonicalInterpretationSchema = z.object({
  intent: canonicalIntentSchema,
  entities: z.record(z.unknown()),
  language: z.string().min(2),
  confidence: z.number().min(0).max(1),
});

export type CanonicalIntent = z.infer<typeof canonicalIntentSchema>;
export type CanonicalInterpretation = z.infer<
  typeof canonicalInterpretationSchema
>;

export const interpretationAttemptSchema = z.object({
  interpretation: canonicalInterpretationSchema,
  rawAiResponse: z.string().nullable(),
  parsedJson: canonicalInterpretationSchema.nullable(),
  error: z.string().nullable(),
  provider: z.string().min(1),
  model: z.string().nullable(),
  usedFallback: z.boolean(),
});

export type InterpretationAttempt = z.infer<typeof interpretationAttemptSchema>;

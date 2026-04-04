import { z } from 'zod';

export const canonicalIntentValues = [
  'GENERAL_CONVERSATION',
  'CLARIFICATION',
  'GET_PRODUCT',
  'CREATE_BOOKING',
  'CREATE_QUOTE',
] as const;

export const canonicalIntentSchema = z.enum(canonicalIntentValues);

export const interpretationEntitiesSchema = z.object({
  rawMessage: z.string().min(1).max(4000).optional(),
  dateCandidates: z.array(z.string().min(1).max(200)).max(10).optional(),
  measurementCandidates: z.array(z.string().min(1).max(100)).max(10).optional(),
  dimensionCandidates: z.array(z.string().min(1).max(100)).max(10).optional(),
  attendees: z.number().int().positive().max(100).optional(),
  price: z.string().min(1).max(120).optional(),
  location: z.string().min(1).max(200).optional(),
  sku: z.string().min(1).max(120).optional(),
  productQuery: z.string().min(1).max(500).optional(),
  requestSummary: z.string().min(1).max(1000).optional(),
});

export type InterpretationEntities = z.infer<typeof interpretationEntitiesSchema>;

export const interpretationResultSchema = z.object({
  intent: z.string().min(1),
  entities: interpretationEntitiesSchema,
  language: z.string().min(2),
  confidence: z.number().min(0).max(1),
});

export type InterpretationResult = z.infer<typeof interpretationResultSchema>;

export const canonicalInterpretationSchema = z.object({
  intent: canonicalIntentSchema,
  entities: interpretationEntitiesSchema,
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

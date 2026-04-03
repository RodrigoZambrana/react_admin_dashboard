import { z } from 'zod';

export const interpretationResultSchema = z.object({
  intent: z.string().min(1),
  entities: z.record(z.unknown()),
  language: z.string().min(2),
  confidence: z.number().min(0).max(1),
});

export type InterpretationResult = z.infer<typeof interpretationResultSchema>;

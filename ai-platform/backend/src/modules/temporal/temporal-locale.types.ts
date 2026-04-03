import { z } from 'zod';

export const temporalLocaleResourceSchema = z.object({
  locale: z.string().min(2),
  datePhrases: z.array(z.string().min(1)).min(1),
  timeJoiners: z.array(z.string().min(1)),
});

export type TemporalLocaleResource = z.infer<typeof temporalLocaleResourceSchema>;

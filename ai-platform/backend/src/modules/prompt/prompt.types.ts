import { z } from 'zod';

export const promptTemplateKeySchema = z.enum(['interpretation', 'response']);

export type PromptTemplateKey = z.infer<typeof promptTemplateKeySchema>;

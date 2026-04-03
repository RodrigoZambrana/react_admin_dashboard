import { z } from 'zod';

import { NormalizedInterpretation } from '../parsing/parsing.service';

export type ToolExecutionContext = {
  interpretation: NormalizedInterpretation;
};

export type ToolExecutionResult = {
  toolName: string;
  payload: Record<string, unknown>;
};

export interface ToolDefinition<TSchema extends z.ZodTypeAny> {
  readonly name: string;
  readonly schema: TSchema;
  buildInput(context: ToolExecutionContext): z.infer<TSchema>;
  execute(input: z.infer<TSchema>): Promise<Record<string, unknown>>;
}

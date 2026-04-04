import { z } from 'zod';

import { DecisionResult } from '../decision/decision.types';
import { ParsedInterpretation } from '../parsing/parsing.service';

export type ToolExecutionContext = {
  interpretation: ParsedInterpretation;
  tenantId: string;
  traceId: string;
  abortSignal?: AbortSignal;
};

export type ToolExecutionSuccess = {
  ok: true;
  toolName: string;
  validatedInput: Record<string, unknown>;
  payload: Record<string, unknown>;
  durationMs: number;
};

export type ToolExecutionFailureCode =
  | 'unknown_tool'
  | 'validation_failed'
  | 'execution_failed';

export type ToolExecutionFailure = {
  ok: false;
  toolName: string;
  validatedInput: Record<string, unknown> | null;
  errorCode: ToolExecutionFailureCode;
  errorMessage: string;
  errorDetails?: Record<string, unknown>;
  durationMs: number | null;
};

export type ToolExecutionAttempt = ToolExecutionSuccess | ToolExecutionFailure;

export type ApprovedToolExecutionRequest = {
  decision: DecisionResult;
  interpretation: ParsedInterpretation;
  abortSignal?: AbortSignal;
};

export interface ToolDefinition<TSchema extends z.ZodTypeAny> {
  readonly name: string;
  readonly schema: TSchema;
  buildInput(context: ToolExecutionContext): z.infer<TSchema>;
  execute(
    input: z.infer<TSchema>,
    context: ToolExecutionContext,
  ): Promise<Record<string, unknown>>;
}

export function isAbortSignalActive(signal?: AbortSignal | null) {
  return Boolean(signal?.aborted);
}

import { Injectable } from '@nestjs/common';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { isAbortError, throwIfAborted } from '../shared/abort.utils';
import { CreateBookingTool } from './create-booking.tool';
import { CreateQuoteTool } from './create-quote.tool';
import { GetProductTool } from './get-product.tool';
import {
  ToolDefinition,
  ToolExecutionAttempt,
  ToolExecutionContext,
  ToolExecutionFailureCode,
} from './tool.types';

@Injectable()
export class ToolEngineService {
  private readonly tools: Map<string, ToolDefinition<any>>;

  constructor(
    private readonly logger: PipelineLoggerService,
    createBookingTool: CreateBookingTool,
    getProductTool: GetProductTool,
    createQuoteTool: CreateQuoteTool,
  ) {
    this.tools = new Map<string, ToolDefinition<any>>();
    this.tools.set(createBookingTool.name, createBookingTool);
    this.tools.set(getProductTool.name, getProductTool);
    this.tools.set(createQuoteTool.name, createQuoteTool);
  }

  async execute(
    toolName: string,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionAttempt> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return this.buildFailure(
        toolName,
        'unknown_tool',
        `Unknown tool "${toolName}"`,
      );
    }

    const validation = tool.schema.safeParse(tool.buildInput(context));

    if (!validation.success) {
      return this.buildFailure(
        toolName,
        'validation_failed',
        'Tool input validation failed.',
        {
          issues: validation.error.flatten(),
        },
      );
    }

    const validatedInput = validation.data;
    const startedAt = Date.now();

    try {
      throwIfAborted(context.abortSignal);
      const payload = await tool.execute(validatedInput, context);
      throwIfAborted(context.abortSignal);
      const result = {
        ok: true as const,
        toolName,
        validatedInput,
        payload,
        durationMs: Date.now() - startedAt,
      };

      this.logger.log(
        JSON.stringify({
          stage: 'execution',
          status: 'completed',
          toolName,
          tenantId: context.tenantId,
          traceId: context.traceId,
          durationMs: result.durationMs,
          input: validatedInput,
          output: payload,
        }),
      );

      return result;
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      return this.buildFailure(
        toolName,
        'execution_failed',
        error instanceof Error ? error.message : String(error),
        undefined,
        Date.now() - startedAt,
        validatedInput,
      );
    }
  }

  private buildFailure(
    toolName: string,
    errorCode: ToolExecutionFailureCode,
    errorMessage: string,
    errorDetails?: Record<string, unknown>,
    durationMs: number | null = null,
    validatedInput: Record<string, unknown> | null = null,
  ): ToolExecutionAttempt {
    const failure = {
      ok: false as const,
      toolName,
      validatedInput,
      errorCode,
      errorMessage,
      errorDetails,
      durationMs,
    };

    this.logger.error(
      JSON.stringify({
        stage: 'execution',
        status: 'failed',
        toolName,
        errorCode,
        errorMessage,
        errorDetails,
        durationMs,
      }),
    );

    return failure;
  }
}

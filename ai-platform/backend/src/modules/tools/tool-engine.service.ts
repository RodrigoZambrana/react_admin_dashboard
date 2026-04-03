import { BadRequestException, Injectable } from '@nestjs/common';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { CreateBookingTool } from './create-booking.tool';
import { CreateQuoteTool } from './create-quote.tool';
import { GetProductTool } from './get-product.tool';
import {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
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
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new BadRequestException(`Unknown tool "${toolName}"`);
    }

    const validatedInput = tool.schema.parse(tool.buildInput(context));
    const startedAt = Date.now();
    const payload = await tool.execute(validatedInput);

    this.logger.log(
      JSON.stringify({
        stage: 'execution',
        toolName,
        durationMs: Date.now() - startedAt,
        input: validatedInput,
        output: payload,
      }),
    );

    return {
      toolName,
      payload,
    };
  }
}

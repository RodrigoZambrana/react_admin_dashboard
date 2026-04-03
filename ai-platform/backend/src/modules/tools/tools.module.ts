import { Module } from '@nestjs/common';

import { CreateBookingTool } from './create-booking.tool';
import { CreateQuoteTool } from './create-quote.tool';
import { GetProductTool } from './get-product.tool';
import { ToolExecutionService } from './tool-execution.service';
import { ToolEngineService } from './tool-engine.service';

@Module({
  providers: [
    ToolEngineService,
    ToolExecutionService,
    CreateBookingTool,
    GetProductTool,
    CreateQuoteTool,
  ],
  exports: [ToolEngineService, ToolExecutionService],
})
export class ToolsModule {}

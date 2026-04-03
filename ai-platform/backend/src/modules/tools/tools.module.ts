import { Module } from '@nestjs/common';

import { CreateBookingTool } from './create-booking.tool';
import { CreateQuoteTool } from './create-quote.tool';
import { GetProductTool } from './get-product.tool';
import { ToolEngineService } from './tool-engine.service';

@Module({
  providers: [
    ToolEngineService,
    CreateBookingTool,
    GetProductTool,
    CreateQuoteTool,
  ],
  exports: [ToolEngineService],
})
export class ToolsModule {}

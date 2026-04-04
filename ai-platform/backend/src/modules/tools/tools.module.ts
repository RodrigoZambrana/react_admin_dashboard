import { Module } from '@nestjs/common';

import { CreateBookingTool } from './create-booking.tool';
import { CreateQuoteTool } from './create-quote.tool';
import { GetProductTool } from './get-product.tool';
import { ProductCatalogService } from './product-catalog.service';
import { ToolExecutionService } from './tool-execution.service';
import { ToolEngineService } from './tool-engine.service';

@Module({
  providers: [
    ProductCatalogService,
    ToolEngineService,
    ToolExecutionService,
    CreateBookingTool,
    GetProductTool,
    CreateQuoteTool,
  ],
  exports: [ProductCatalogService, ToolEngineService, ToolExecutionService],
})
export class ToolsModule {}

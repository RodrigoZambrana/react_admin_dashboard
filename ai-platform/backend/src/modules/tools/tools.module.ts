import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { CreateBookingTool } from './create-booking.tool';
import { CreateQuoteTool } from './create-quote.tool';
import { GetProductTool } from './get-product.tool';
import { ProductCatalogService } from './product-catalog.service';
import { ToolExecutionService } from './tool-execution.service';
import { ToolEngineService } from './tool-engine.service';

@Module({
  imports: [CatalogModule],
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

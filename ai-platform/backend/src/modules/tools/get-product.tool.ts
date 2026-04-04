import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { ToolDefinition, ToolExecutionContext } from './tool.types';
import {
  ProductCatalogNoMatchError,
  ProductCatalogService,
} from './product-catalog.service';

const productInputSchema = z.object({
  sku: z.string().optional(),
  query: z.string().min(1),
});

@Injectable()
export class GetProductTool implements ToolDefinition<typeof productInputSchema> {
  readonly name = 'get_product';
  readonly schema = productInputSchema;

  constructor(private readonly productCatalogService: ProductCatalogService) {}

  buildInput(context: ToolExecutionContext) {
    return {
      sku:
        typeof context.interpretation.entities.sku === 'string'
          ? context.interpretation.entities.sku
          : undefined,
      query:
        typeof context.interpretation.entities.productQuery === 'string'
          ? context.interpretation.entities.productQuery
          : typeof context.interpretation.entities.rawMessage === 'string'
            ? context.interpretation.entities.rawMessage
          : 'Product lookup requested',
    };
  }

  async execute(
    input: z.infer<typeof productInputSchema>,
    _context: ToolExecutionContext,
  ) {
    const match = this.productCatalogService.findMatch(input);

    if (!match.matched || !match.product) {
      throw new ProductCatalogNoMatchError(input.query);
    }

    return {
      ...match.product,
      matchedBy: match.matchedBy,
    };
  }
}

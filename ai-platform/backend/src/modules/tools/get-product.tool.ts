import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { ToolDefinition, ToolExecutionContext } from './tool.types';

const catalog = [
  {
    sku: 'A-19',
    name: 'Atlas Carry Case',
    price: 129,
    currency: 'USD',
    availability: 'in_stock',
  },
  {
    sku: 'B-77',
    name: 'Beacon Desk Lamp',
    price: 89,
    currency: 'USD',
    availability: 'backorder',
  },
];

const productInputSchema = z.object({
  sku: z.string().optional(),
  query: z.string().min(1),
});

@Injectable()
export class GetProductTool implements ToolDefinition<typeof productInputSchema> {
  readonly name = 'get_product';
  readonly schema = productInputSchema;

  buildInput(context: ToolExecutionContext) {
    return {
      sku:
        typeof context.interpretation.entities.sku === 'string'
          ? context.interpretation.entities.sku
          : undefined,
      query:
        typeof context.interpretation.entities.rawMessage === 'string'
          ? context.interpretation.entities.rawMessage
          : 'Product lookup requested',
    };
  }

  async execute(input: z.infer<typeof productInputSchema>) {
    const bySku = input.sku
      ? catalog.find(
          (product) => product.sku.toLowerCase() === input.sku?.toLowerCase(),
        )
      : undefined;

    const byQuery =
      bySku ??
      catalog.find((product) =>
        input.query.toLowerCase().includes(product.name.toLowerCase()),
      ) ??
      catalog[0];

    return {
      ...byQuery,
      matchedBy: bySku ? 'sku' : 'query',
    };
  }
}

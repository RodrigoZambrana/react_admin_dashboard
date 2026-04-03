import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { ToolDefinition, ToolExecutionContext } from './tool.types';

const quoteInputSchema = z.object({
  requestSummary: z.string().min(1),
  attendees: z.number().int().positive().optional(),
  measurements: z
    .array(
      z.object({
        source: z.string(),
        normalizedValue: z.number(),
        normalizedUnit: z.string(),
        kind: z.enum(['length', 'mass', 'volume']),
      }),
    )
    .default([]),
});

@Injectable()
export class CreateQuoteTool implements ToolDefinition<typeof quoteInputSchema> {
  readonly name = 'create_quote';
  readonly schema = quoteInputSchema;

  buildInput(context: ToolExecutionContext) {
    return {
      requestSummary:
        typeof context.interpretation.entities.rawMessage === 'string'
          ? context.interpretation.entities.rawMessage
          : 'Quote requested',
      attendees:
        typeof context.interpretation.entities.attendees === 'number'
          ? context.interpretation.entities.attendees
          : undefined,
      measurements: context.interpretation.normalizedEntities.measurements.map(
        ({ source, normalizedValue, normalizedUnit, kind }) => ({
          source,
          normalizedValue,
          normalizedUnit,
          kind,
        }),
      ),
    };
  }

  async execute(input: z.infer<typeof quoteInputSchema>) {
    const attendeeCost = (input.attendees ?? 1) * 45;
    const materialCost = input.measurements.reduce(
      (total, measurement) => total + measurement.normalizedValue * 12,
      0,
    );

    return {
      quoteId: `qt_${randomUUID().slice(0, 8)}`,
      status: 'drafted',
      estimatedTotal: Number((attendeeCost + materialCost).toFixed(2)),
      currency: 'USD',
      requestSummary: input.requestSummary,
    };
  }
}

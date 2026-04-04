import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { ToolDefinition, ToolExecutionContext } from './tool.types';

const bookingInputSchema = z.object({
  requestedDateIso: z.string().min(1),
  attendees: z.number().int().positive().optional(),
  notes: z.string().min(1),
});

@Injectable()
export class CreateBookingTool
  implements ToolDefinition<typeof bookingInputSchema>
{
  readonly name = 'create_booking';
  readonly schema = bookingInputSchema;

  buildInput(context: ToolExecutionContext) {
    return {
      requestedDateIso:
        context.interpretation.normalizedEntities.dates[0]?.iso ?? '',
      attendees:
        typeof context.interpretation.entities.attendees === 'number'
          ? context.interpretation.entities.attendees
          : undefined,
      notes:
        typeof context.interpretation.entities.requestSummary === 'string'
          ? context.interpretation.entities.requestSummary
          : typeof context.interpretation.entities.rawMessage === 'string'
            ? context.interpretation.entities.rawMessage
          : 'Booking requested',
    };
  }

  async execute(
    input: z.infer<typeof bookingInputSchema>,
    _context: ToolExecutionContext,
  ) {
    return {
      bookingId: `bk_${randomUUID().slice(0, 8)}`,
      scheduledFor: input.requestedDateIso,
      attendees: input.attendees ?? 1,
      status: 'confirmed',
      notes: input.notes,
    };
  }
}

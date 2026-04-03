import { PipelineLoggerService } from '../src/modules/logging/pipeline-logger.service';
import { CreateBookingTool } from '../src/modules/tools/create-booking.tool';
import { CreateQuoteTool } from '../src/modules/tools/create-quote.tool';
import { GetProductTool } from '../src/modules/tools/get-product.tool';
import { ToolEngineService } from '../src/modules/tools/tool-engine.service';

describe('ToolEngineService', () => {
  it('validates and executes the booking tool', async () => {
    const service = new ToolEngineService(
      new PipelineLoggerService(),
      new CreateBookingTool(),
      new GetProductTool(),
      new CreateQuoteTool(),
    );

    const result = await service.execute('create_booking', {
      interpretation: {
        intent: 'tenant.create_booking',
        language: 'es',
        confidence: 0.93,
        entities: {
          rawMessage: 'Reservar para 2 personas mañana',
          attendees: 2,
        },
        normalizedEntities: {
          dates: [
            {
              source: 'mañana',
              iso: '2026-04-04T12:00:00.000Z',
              precision: 'date',
            },
          ],
          measurements: [],
        },
      },
    });

    expect(result.toolName).toBe('create_booking');
    expect(result.payload).toEqual(
      expect.objectContaining({
        status: 'confirmed',
        attendees: 2,
      }),
    );
  });
});

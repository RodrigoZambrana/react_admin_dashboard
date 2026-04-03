import { PipelineLoggerService } from '../src/modules/logging/pipeline-logger.service';
import { DecisionService } from '../src/modules/decision/decision.service';

describe('DecisionService', () => {
  it('routes valid booking requests to the booking tool', () => {
    const service = new DecisionService(new PipelineLoggerService());

    const decision = service.decide({
      intent: 'tenant.create_booking',
      language: 'es',
      confidence: 0.9,
      entities: {
        rawMessage: 'Reservar mañana',
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
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'invoke_tool',
        toolName: 'create_booking',
      }),
    );
  });

  it('forces clarification when booking date is missing', () => {
    const service = new DecisionService(new PipelineLoggerService());

    const decision = service.decide({
      intent: 'tenant.create_booking',
      language: 'en',
      confidence: 0.9,
      entities: {
        rawMessage: 'I need a booking',
      },
      normalizedEntities: {
        dates: [],
        measurements: [],
      },
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'clarify',
        missingFields: ['requested_date'],
      }),
    );
  });
});

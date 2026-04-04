import { PipelineLoggerService } from '../src/modules/logging/pipeline-logger.service';
import { DecisionService } from '../src/modules/decision/decision.service';

describe('DecisionService', () => {
  it('routes valid booking requests to the booking tool', () => {
    const service = new DecisionService(new PipelineLoggerService());

    const decision = service.decide({
      intent: 'CREATE_BOOKING',
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
        dimensions: [],
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
      intent: 'CREATE_BOOKING',
      language: 'en',
      confidence: 0.9,
      entities: {
        rawMessage: 'I need a booking',
      },
      normalizedEntities: {
        dates: [],
        measurements: [],
        dimensions: [],
      },
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'clarify',
        missingFields: ['requested_date'],
      }),
    );
  });

  it('continues continuity-prepared booking follow-ups without falling back to low-confidence clarification', () => {
    const service = new DecisionService(new PipelineLoggerService());

    const decision = service.decide({
      intent: 'CREATE_BOOKING',
      language: 'es',
      confidence: 0.41,
      entities: {
        rawMessage: 'para 3 personas',
        attendees: 3,
      },
      normalizedEntities: {
        dates: [
          {
            source: 'continuity',
            iso: '2026-04-04T12:00:00.000Z',
            precision: 'date',
          },
        ],
        measurements: [],
        dimensions: [],
      },
      continuity: {
        applied: true,
        activeLane: 'booking',
        carriedFactKeys: ['requestedDate'],
        invalidatedFactKeys: [],
        missingFields: [],
        previousStateSummary: {
          lane: 'booking',
          missingFields: [],
          lastApprovedAction: 'invoke_tool',
        },
      },
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'invoke_tool',
        toolName: 'create_booking',
      }),
    );
  });

  it('uses continuity missing fields for low-confidence follow-up clarifications when the active lane remains open', () => {
    const service = new DecisionService(new PipelineLoggerService());

    const decision = service.decide({
      intent: 'CLARIFICATION',
      language: 'es',
      confidence: 0.32,
      entities: {
        rawMessage: 'todavia no se',
      },
      normalizedEntities: {
        dates: [],
        measurements: [],
        dimensions: [],
      },
      continuity: {
        applied: false,
        activeLane: 'booking',
        carriedFactKeys: [],
        invalidatedFactKeys: [],
        missingFields: ['requested_date'],
        nextUsefulField: 'requested_date',
        previousStateSummary: {
          lane: 'booking',
          missingFields: ['requested_date'],
          nextUsefulField: 'requested_date',
          lastApprovedAction: 'clarify',
        },
      },
    });

    expect(decision).toEqual(
      expect.objectContaining({
        action: 'clarify',
        reasonCode: 'continuity_missing_fields',
        missingFields: ['requested_date'],
      }),
    );
  });
});

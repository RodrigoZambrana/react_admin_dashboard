import { PipelineLoggerService } from '../src/modules/logging/pipeline-logger.service';
import { ParsingService } from '../src/modules/parsing/parsing.service';
import { DateParser } from '../src/modules/parsing/date.parser';
import { MeasurementParser } from '../src/modules/parsing/measurement.parser';

describe('ParsingService', () => {
  it('normalizes measurement and date candidates extracted by AI', () => {
    const service = new ParsingService(
      new DateParser(),
      new MeasurementParser(),
      new PipelineLoggerService(),
    );

    const normalized = service.normalize(
      {
        intent: 'tenant.create_booking',
        language: 'es',
        confidence: 0.88,
        entities: {
          rawMessage: 'Reservar mañana y traer 2500 g de material',
          dateCandidates: ['mañana'],
          measurementCandidates: ['2500 g'],
        },
      },
      new Date('2026-04-03T12:00:00.000Z'),
    );

    expect(normalized.normalizedEntities.dates[0]?.iso).toContain('2026-04-04');
    expect(normalized.normalizedEntities.measurements[0]).toEqual(
      expect.objectContaining({
        normalizedUnit: 'kg',
        normalizedValue: 2.5,
      }),
    );
  });
});

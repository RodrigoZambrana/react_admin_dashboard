import { PipelineLoggerService } from '../src/modules/logging/pipeline-logger.service';
import { DimensionParser } from '../src/modules/parsing/dimension.parser';
import { ParsingService } from '../src/modules/parsing/parsing.service';
import { DateParser } from '../src/modules/parsing/date.parser';
import { MeasurementParser } from '../src/modules/parsing/measurement.parser';
import { TemporalExpressionService } from '../src/modules/temporal/temporal-expression.service';
import { TemporalLocaleRegistryService } from '../src/modules/temporal/temporal-locale-registry.service';

describe('ParsingService', () => {
  it('normalizes measurement, date, and dimension candidates extracted by AI', () => {
    const temporalRegistry = new TemporalLocaleRegistryService();
    const temporalExpressionService = new TemporalExpressionService(
      temporalRegistry,
    );
    const service = new ParsingService(
      new DateParser(temporalExpressionService),
      new MeasurementParser(),
      new DimensionParser(),
      new PipelineLoggerService(),
    );

    const normalized = service.normalize(
      {
        intent: 'CREATE_BOOKING',
        language: 'es',
        confidence: 0.88,
        entities: {
          rawMessage: 'Reservar mañana y traer 2500 g de material con puerta 1,38 x 0,90',
          dateCandidates: ['mañana'],
          measurementCandidates: ['2500 g'],
          dimensionCandidates: ['1,38 x 0,90'],
        },
      },
      new Date('2026-04-03T12:00:00.000Z'),
    );

    expect(normalized.normalizedEntities.dates).toHaveLength(1);
    expect(normalized.normalizedEntities.dates[0]?.source).toBe('mañana');
    expect(normalized.normalizedEntities.dates[0]?.iso).toContain('2026-04-04');
    expect(normalized.normalizedEntities.measurements[0]).toEqual(
      expect.objectContaining({
        normalizedUnit: 'kg',
        normalizedValue: 2.5,
      }),
    );
    expect(normalized.normalizedEntities.dimensions[0]).toEqual(
      expect.objectContaining({
        source: '1,38 x 0,90',
        unitSource: 'inferred',
      }),
    );
    expect(normalized.normalizedEntities.dimensions[0]?.values[0]).toEqual(
      expect.objectContaining({
        normalizedUnit: 'mm',
        normalizedValue: 1380,
      }),
    );
  });
});

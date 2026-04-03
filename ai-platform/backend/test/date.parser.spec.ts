import { DateParser } from '../src/modules/parsing/date.parser';
import { TemporalExpressionService } from '../src/modules/temporal/temporal-expression.service';
import { TemporalLocaleRegistryService } from '../src/modules/temporal/temporal-locale-registry.service';

describe('DateParser', () => {
  it('keeps valid bounded temporal expressions from the message text', () => {
    const parser = buildDateParser();

    const result = parser.parseCandidates(
      'Necesito reservar mañana a las 3',
      [],
      new Date('2026-04-03T12:00:00.000Z'),
      'es',
    );

    expect(result).toEqual([
      expect.objectContaining({
        source: 'mañana a las 3',
        precision: 'datetime',
      }),
    ]);
  });

  it('rejects noisy message fragments that are not bounded date expressions', () => {
    const parser = buildDateParser();

    const result = parser.parseCandidates(
      'Quiero puerta 1,38 x 0,90 y 2500 g de material',
      [],
      new Date('2026-04-03T12:00:00.000Z'),
      'es',
    );

    expect(result).toEqual([]);
  });

  it('rejects noisy AI candidates that do not contain bounded date evidence', () => {
    const parser = buildDateParser();

    const result = parser.parseCandidates(
      'Quiero puerta 1,38 x 0,90',
      ['a 1'],
      new Date('2026-04-03T12:00:00.000Z'),
      'es',
    );

    expect(result).toEqual([]);
  });

  it('keeps english relative expressions already supported by the system', () => {
    const parser = buildDateParser();

    const result = parser.parseCandidates(
      'Book it for tomorrow',
      [],
      new Date('2026-04-03T12:00:00.000Z'),
      'en',
    );

    expect(result).toEqual([
      expect.objectContaining({
        source: 'tomorrow',
        precision: 'date',
      }),
    ]);
  });

  it('resolves regional locale codes through backend locale resources', () => {
    const parser = buildDateParser();

    const result = parser.parseCandidates(
      'Necesito reservar mañana',
      [],
      new Date('2026-04-03T12:00:00.000Z'),
      'es-UY',
    );

    expect(result).toEqual([
      expect.objectContaining({
        source: 'mañana',
        precision: 'date',
      }),
    ]);
  });
});

function buildDateParser() {
  const registry = new TemporalLocaleRegistryService();
  const expressionService = new TemporalExpressionService(registry);

  return new DateParser(expressionService);
}

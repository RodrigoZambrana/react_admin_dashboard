import { DateParser } from '../src/modules/parsing/date.parser';
import { TemporalExpressionService } from '../src/modules/temporal/temporal-expression.service';
import { TemporalLocaleProvider } from '../src/modules/temporal/temporal-locale.provider';
import { FileSystemTemporalLocaleProvider } from '../src/modules/temporal/filesystem-temporal-locale.provider';
import { TemporalLocaleResource } from '../src/modules/temporal/temporal-locale.types';

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

  it('supports a new locale through provider data without parser logic changes', () => {
    const parser = buildDateParser([
      {
        locale: 'custom',
        datePhrases: ['tomorrow'],
        timeJoiners: ['at'],
      },
    ]);

    const result = parser.parseCandidates(
      'Need tomorrow at 4',
      [],
      new Date('2026-04-03T12:00:00.000Z'),
      'custom',
    );

    expect(result).toEqual([
      expect.objectContaining({
        source: 'tomorrow at 4',
        precision: 'datetime',
      }),
    ]);
  });
});

function buildDateParser(resources?: TemporalLocaleResource[]) {
  const provider = resources
    ? new FakeTemporalLocaleProvider(resources)
    : new FileSystemTemporalLocaleProvider();
  const expressionService = new TemporalExpressionService(provider);

  return new DateParser(expressionService);
}

class FakeTemporalLocaleProvider extends TemporalLocaleProvider {
  constructor(private readonly resources: TemporalLocaleResource[]) {
    super();
  }

  listResources(): TemporalLocaleResource[] {
    return this.resources;
  }

  getSupportedLocales(): string[] {
    return this.resources.map((resource) => resource.locale);
  }

  resolveResource(locale?: string | null): TemporalLocaleResource | undefined {
    const normalizedLocale = locale?.trim().toLowerCase();

    if (!normalizedLocale) {
      return undefined;
    }

    return this.resources.find((resource) => resource.locale === normalizedLocale);
  }

  resolveResources(locale?: string | null): TemporalLocaleResource[] {
    const normalizedLocale = locale?.trim().toLowerCase();

    if (!normalizedLocale) {
      return this.resources;
    }

    return this.resources.filter(
      (resource) => resource.locale === normalizedLocale,
    );
  }
}

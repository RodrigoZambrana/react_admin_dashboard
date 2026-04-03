import { TemporalExpressionService } from '../src/modules/temporal/temporal-expression.service';
import { TemporalLocaleProvider } from '../src/modules/temporal/temporal-locale.provider';
import { TemporalLocaleResource } from '../src/modules/temporal/temporal-locale.types';

describe('TemporalExpressionService', () => {
  it('extracts lexical temporal expressions from injected locale resources without code changes', () => {
    const service = buildService([
      {
        locale: 'custom',
        datePhrases: ['shiftday'],
        timeJoiners: ['slot'],
      },
    ]);

    expect(service.extractExpressions('Need shiftday slot 4', 'custom')).toEqual([
      'shiftday slot 4',
    ]);
  });

  it('changes lexical support by changing only locale resources', () => {
    const service = buildService([
      {
        locale: 'custom',
        datePhrases: ['otherday'],
        timeJoiners: ['slot'],
      },
    ]);

    expect(service.extractExpressions('Need shiftday slot 4', 'custom')).toEqual([]);
  });

  it('keeps deterministic structural date extraction independent of locale lexicon', () => {
    const service = buildService([
      {
        locale: 'custom',
        datePhrases: ['otherday'],
        timeJoiners: ['slot'],
      },
    ]);

    expect(service.extractExpressions('Window 2026-04-03', 'custom')).toEqual([
      '2026-04-03',
    ]);
  });
});

function buildService(resources: TemporalLocaleResource[]) {
  return new TemporalExpressionService(new FakeTemporalLocaleProvider(resources));
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

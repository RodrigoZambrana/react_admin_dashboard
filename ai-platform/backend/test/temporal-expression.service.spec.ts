import { TemporalExpressionService } from '../src/modules/temporal/temporal-expression.service';
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
  return new TemporalExpressionService({
    listResources: () => resources,
    resolveResources: (locale?: string | null) => {
      const normalizedLocale = locale?.trim().toLowerCase();

      if (!normalizedLocale) {
        return resources;
      }

      return resources.filter(
        (resource) => resource.locale === normalizedLocale,
      );
    },
  } as any);
}

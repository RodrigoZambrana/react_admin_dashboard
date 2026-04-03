import { TemporalExpressionService } from '../src/modules/temporal/temporal-expression.service';
import { TemporalLocaleProvider } from '../src/modules/temporal/temporal-locale.provider';
import { TemporalLocaleResource } from '../src/modules/temporal/temporal-locale.types';

describe('TemporalExpressionService', () => {
  it('extracts lexical temporal expressions from injected locale resources without code changes', async () => {
    const service = buildService([
      {
        locale: 'custom',
        datePhrases: ['shiftday'],
        timeJoiners: ['slot'],
      },
    ]);

    await expect(
      service.extractExpressions('Need shiftday slot 4', 'custom'),
    ).resolves.toEqual(['shiftday slot 4']);
  });

  it('changes lexical support by changing only locale resources', async () => {
    const service = buildService([
      {
        locale: 'custom',
        datePhrases: ['otherday'],
        timeJoiners: ['slot'],
      },
    ]);

    await expect(
      service.extractExpressions('Need shiftday slot 4', 'custom'),
    ).resolves.toEqual([]);
  });

  it('keeps deterministic structural date extraction independent of locale lexicon', async () => {
    const service = buildService([
      {
        locale: 'custom',
        datePhrases: ['otherday'],
        timeJoiners: ['slot'],
      },
    ]);

    await expect(
      service.extractExpressions('Window 2026-04-03', 'custom'),
    ).resolves.toEqual(['2026-04-03']);
  });
});

function buildService(resources: TemporalLocaleResource[]) {
  return new TemporalExpressionService(new FakeTemporalLocaleProvider(resources));
}

class FakeTemporalLocaleProvider extends TemporalLocaleProvider {
  constructor(private readonly resources: TemporalLocaleResource[]) {
    super();
  }

  async getActive(key: string) {
    const resource = await this.resolveResource(key);

    return resource
      ? {
          id: `fake-${key}`,
          key,
          value: resource,
          version: 1,
          status: 'ACTIVE' as const,
          metadata: null,
          createdAt: new Date(),
          createdBy: 'test',
        }
      : null;
  }

  async listActive() {
    return this.resources.map((resource) => ({
      id: `fake-${resource.locale}`,
      key: resource.locale,
      value: resource,
      version: 1,
      status: 'ACTIVE' as const,
      metadata: null,
      createdAt: new Date(),
      createdBy: 'test',
    }));
  }

  async listResources(): Promise<TemporalLocaleResource[]> {
    return this.resources;
  }

  async getSupportedLocales(): Promise<string[]> {
    return this.resources.map((resource) => resource.locale);
  }

  async resolveResource(
    locale?: string | null,
  ): Promise<TemporalLocaleResource | undefined> {
    const normalizedLocale = locale?.trim().toLowerCase();

    if (!normalizedLocale) {
      return undefined;
    }

    return this.resources.find((resource) => resource.locale === normalizedLocale);
  }

  async resolveResources(locale?: string | null): Promise<TemporalLocaleResource[]> {
    const normalizedLocale = locale?.trim().toLowerCase();

    if (!normalizedLocale) {
      return this.resources;
    }

    return this.resources.filter(
      (resource) => resource.locale === normalizedLocale,
    );
  }
}

import { TemporalLocaleProvider } from '../src/modules/temporal/temporal-locale.provider';
import { TemporalLocaleResource } from '../src/modules/temporal/temporal-locale.types';
import { MockLanguageModelProvider } from '../src/modules/ai-gateway/providers/mock-language-model.provider';
import { TemporalExpressionService } from '../src/modules/temporal/temporal-expression.service';
import { buildManagedTemporalLocaleProviderStub } from './support/managed-temporal-provider.stub';

describe('MockLanguageModelProvider', () => {
  it('returns strict JSON interpretation output', async () => {
    const provider = new MockLanguageModelProvider(
      new TemporalExpressionService(
        buildManagedTemporalLocaleProviderStub().provider,
      ),
    );

    const response = await provider.interpret(
      {
        message: 'Necesito una cotización para 4 personas mañana con SKU A-19',
        systemPrompt: 'Return JSON only.',
        previousMessages: [],
      },
      {
        model: 'mock',
        timeoutMs: 1000,
        credentials: {
          strategy: 'none',
          envKey: null,
          value: null,
        },
        providerOptions: {},
      },
    );
    const payload = JSON.parse(response.rawResponse);

    expect(payload).toEqual(
      expect.objectContaining({
        intent: 'CREATE_QUOTE',
        language: 'es',
      }),
    );
    expect(payload.entities).toEqual(
      expect.objectContaining({
        attendees: 4,
        sku: 'A-19',
      }),
    );
  });

  it('uses provider-backed temporal resources to infer locale and date candidates', async () => {
    const provider = new MockLanguageModelProvider(
      new TemporalExpressionService(
        new FakeTemporalLocaleProvider([
          {
            locale: 'custom',
            datePhrases: ['shiftday'],
            timeJoiners: ['slot'],
          },
        ]),
      ),
    );

    const response = await provider.interpret(
      {
        message: 'Need shiftday slot 4',
        systemPrompt: 'Return JSON only.',
        previousMessages: [],
      },
      {
        model: 'mock',
        timeoutMs: 1000,
        credentials: {
          strategy: 'none',
          envKey: null,
          value: null,
        },
        providerOptions: {},
      },
    );
    const payload = JSON.parse(response.rawResponse);

    expect(payload).toEqual(
      expect.objectContaining({
        language: 'custom',
      }),
    );
    expect(payload.entities).toEqual(
      expect.objectContaining({
        dateCandidates: ['shiftday slot 4'],
      }),
    );
  });
});

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

import { MockLanguageModelProvider } from '../src/modules/ai-gateway/providers/mock-language-model.provider';
import { TemporalExpressionService } from '../src/modules/temporal/temporal-expression.service';
import { TemporalLocaleRegistryService } from '../src/modules/temporal/temporal-locale-registry.service';

describe('MockLanguageModelProvider', () => {
  it('returns strict JSON interpretation output', async () => {
    const provider = new MockLanguageModelProvider(
      new TemporalExpressionService(new TemporalLocaleRegistryService()),
    );

    const response = await provider.interpret(
      {
        message: 'Necesito una cotización para 4 personas mañana con SKU A-19',
        systemPrompt: 'Return JSON only.',
        previousMessages: [],
      },
      {
        apiKey: '',
        model: 'mock',
        timeoutMs: 1000,
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
});

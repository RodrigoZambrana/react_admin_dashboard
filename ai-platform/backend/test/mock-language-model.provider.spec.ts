import { MockLanguageModelProvider } from '../src/modules/ai-gateway/providers/mock-language-model.provider';

describe('MockLanguageModelProvider', () => {
  it('returns strict JSON interpretation output', async () => {
    const provider = new MockLanguageModelProvider();

    const payload = JSON.parse(
      await provider.interpret({
        message: 'Necesito una cotización para 4 personas mañana con SKU A-19',
      }),
    );

    expect(payload).toEqual(
      expect.objectContaining({
        intent: 'tenant.create_quote',
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

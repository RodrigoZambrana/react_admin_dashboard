import { LanguageModelProviderRegistry } from '../src/modules/ai-gateway/providers/language-model-provider.registry';

describe('LanguageModelProviderRegistry', () => {
  it('resolves registered providers by provider name', () => {
    const mockProvider = {
      providerName: 'mock',
      interpret: jest.fn(),
      generateResponse: jest.fn(),
    };
    const openAiProvider = {
      providerName: 'openai',
      interpret: jest.fn(),
      generateResponse: jest.fn(),
    };

    const registry = new LanguageModelProviderRegistry([
      mockProvider as any,
      openAiProvider as any,
    ]);

    expect(registry.resolve('mock')).toBe(mockProvider);
    expect(registry.resolve('openai')).toBe(openAiProvider);
    expect(registry.resolve('anthropic')).toBeNull();
    expect(registry.listProviderNames()).toEqual(['mock', 'openai']);
  });
});

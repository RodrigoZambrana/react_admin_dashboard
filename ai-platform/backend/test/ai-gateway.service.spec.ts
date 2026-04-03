import { AiGatewayService } from '../src/modules/ai-gateway/ai-gateway.service';

describe('AiGatewayService', () => {
  it('parses valid interpretation JSON from the selected provider', async () => {
    const service = new AiGatewayService(
      {
        getAiGatewayConfig: () => ({
          provider: 'mock',
          apiKey: null,
          model: 'mock-rule-engine',
          timeoutMs: 1000,
          source: 'env',
        }),
        getPromptTemplate: () => ({
          key: 'interpretation',
          template: 'Return JSON only.',
          source: 'code',
        }),
      } as any,
      {
        debug: jest.fn(),
        error: jest.fn(),
      } as any,
      {
        interpret: jest.fn(async () => ({
          rawResponse:
            '{"intent":"GENERAL_CONVERSATION","entities":{},"language":"es","confidence":0.91}',
          model: 'mock-rule-engine',
        })),
        generateResponse: jest.fn(),
      } as any,
      {
        interpret: jest.fn(),
        generateResponse: jest.fn(),
      } as any,
    );

    await expect(service.interpret({ message: 'hola' })).resolves.toEqual({
      ok: true,
      rawResponse:
        '{"intent":"GENERAL_CONVERSATION","entities":{},"language":"es","confidence":0.91}',
      parsedResponse: {
        intent: 'GENERAL_CONVERSATION',
        entities: {},
        language: 'es',
        confidence: 0.91,
      },
      error: null,
      provider: 'mock',
      model: 'mock-rule-engine',
    });
  });

  it('returns a recoverable error payload when JSON validation fails', async () => {
    const service = new AiGatewayService(
      {
        getAiGatewayConfig: () => ({
          provider: 'mock',
          apiKey: null,
          model: 'mock-rule-engine',
          timeoutMs: 1000,
          source: 'env',
        }),
        getPromptTemplate: () => ({
          key: 'interpretation',
          template: 'Return JSON only.',
          source: 'code',
        }),
      } as any,
      {
        debug: jest.fn(),
        error: jest.fn(),
      } as any,
      {
        interpret: jest.fn(async () => ({
          rawResponse: 'not-json',
          model: 'mock-rule-engine',
        })),
        generateResponse: jest.fn(),
      } as any,
      {
        interpret: jest.fn(),
        generateResponse: jest.fn(),
      } as any,
    );

    await expect(service.interpret({ message: 'hola' })).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        rawResponse: 'not-json',
        parsedResponse: null,
        provider: 'mock',
        model: 'mock-rule-engine',
      }),
    );
  });
});

import { AiGatewayService } from '../src/modules/ai-gateway/ai-gateway.service';

describe('AiGatewayService', () => {
  it('parses valid interpretation JSON from the selected provider', async () => {
    const promptService = {
      getActivePrompt: jest.fn(async () => ({
        value: 'Return JSON only.',
      })),
    };
    const service = new AiGatewayService(
      {
        getAiGatewayConfig: () => ({
          provider: 'mock',
          apiKey: null,
          model: 'mock-rule-engine',
          timeoutMs: 1000,
          source: 'env',
        }),
      } as any,
      promptService as any,
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
    expect(promptService.getActivePrompt).toHaveBeenCalledWith('interpretation');
  });

  it('returns a recoverable error payload when JSON validation fails', async () => {
    const promptService = {
      getActivePrompt: jest.fn(async () => ({
        value: 'Return JSON only.',
      })),
    };
    const service = new AiGatewayService(
      {
        getAiGatewayConfig: () => ({
          provider: 'mock',
          apiKey: null,
          model: 'mock-rule-engine',
          timeoutMs: 1000,
          source: 'env',
        }),
      } as any,
      promptService as any,
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
    expect(promptService.getActivePrompt).toHaveBeenCalledWith('interpretation');
  });

  it('skips managed prompt retrieval when the caller supplies a prompt template', async () => {
    const promptService = {
      getActivePrompt: jest.fn(),
    };
    const service = new AiGatewayService(
      {
        getAiGatewayConfig: () => ({
          provider: 'mock',
          apiKey: null,
          model: 'mock-rule-engine',
          timeoutMs: 1000,
          source: 'env',
        }),
      } as any,
      promptService as any,
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

    await service.interpret({
      message: 'hola',
      promptTemplate: 'Caller-supplied prompt',
    });

    expect(promptService.getActivePrompt).not.toHaveBeenCalled();
  });

  it('loads the managed response prompt when generating a response without an explicit template', async () => {
    const promptService = {
      getActivePrompt: jest.fn(async (key: string) => ({
        value:
          key === 'response' ? 'Use approved backend context.' : 'Return JSON only.',
      })),
    };
    const mockProvider = {
      interpret: jest.fn(),
      generateResponse: jest.fn(async () => 'ok'),
    };
    const service = new AiGatewayService(
      {
        getAiGatewayConfig: () => ({
          provider: 'mock',
          apiKey: null,
          model: 'mock-rule-engine',
          timeoutMs: 1000,
          source: 'env',
        }),
      } as any,
      promptService as any,
      {
        debug: jest.fn(),
        error: jest.fn(),
      } as any,
      mockProvider as any,
      {
        interpret: jest.fn(),
        generateResponse: jest.fn(),
      } as any,
    );

    await expect(
      service.generateResponse({
        message: 'hola',
        intent: 'GENERAL_CONVERSATION',
        language: 'es',
      }),
    ).resolves.toBe('ok');
    expect(promptService.getActivePrompt).toHaveBeenCalledWith('response');
    expect(mockProvider.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        promptTemplate: 'Use approved backend context.',
      }),
    );
  });
});

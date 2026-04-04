import { AiPromptAssemblyService } from '../src/modules/ai-gateway/ai-prompt-assembly.service';
import { AiGatewayService } from '../src/modules/ai-gateway/ai-gateway.service';
import { LanguageModelProviderRegistry } from '../src/modules/ai-gateway/providers/language-model-provider.registry';

describe('AiGatewayService', () => {
  it('parses valid interpretation JSON from the selected provider', async () => {
    const promptService = {
      getActivePrompt: jest.fn(async () => ({
        value: 'Return JSON only.',
      })),
    };
    const service = new AiGatewayService(
      {
        getAiGatewayConfig: () => buildGatewayConfig(),
      } as any,
      new AiPromptAssemblyService(promptService as any),
      {
        debug: jest.fn(),
        error: jest.fn(),
      } as any,
      buildProviderRegistry({
        mock: {
          interpret: jest.fn(async () => ({
            rawResponse:
              '{"intent":"GENERAL_CONVERSATION","entities":{},"language":"es","confidence":0.91}',
            model: 'mock-rule-engine',
          })),
          generateResponse: jest.fn(),
        },
      }),
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
        getAiGatewayConfig: () => buildGatewayConfig(),
      } as any,
      new AiPromptAssemblyService(promptService as any),
      {
        debug: jest.fn(),
        error: jest.fn(),
      } as any,
      buildProviderRegistry({
        mock: {
          interpret: jest.fn(async () => ({
            rawResponse: 'not-json',
            model: 'mock-rule-engine',
          })),
          generateResponse: jest.fn(),
        },
      }),
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
        getAiGatewayConfig: () => buildGatewayConfig(),
      } as any,
      new AiPromptAssemblyService(promptService as any),
      {
        debug: jest.fn(),
        error: jest.fn(),
      } as any,
      buildProviderRegistry({
        mock: {
          interpret: jest.fn(async () => ({
            rawResponse:
              '{"intent":"GENERAL_CONVERSATION","entities":{},"language":"es","confidence":0.91}',
            model: 'mock-rule-engine',
          })),
          generateResponse: jest.fn(),
        },
      }),
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
      generateResponse: jest.fn(async () => ({
        rawResponse:
          '{"message":"ok","assertedOutcome":"respond","assertedExecutionStatus":"not_applicable","mentionedMissingFields":[],"mentionedApprovedFactKeys":[],"mentionedApprovedResultKeys":[]}',
        model: 'mock-rule-engine',
      })),
    };
    const service = new AiGatewayService(
      {
        getAiGatewayConfig: () => buildGatewayConfig(),
      } as any,
      new AiPromptAssemblyService(promptService as any),
      {
        debug: jest.fn(),
        error: jest.fn(),
      } as any,
      buildProviderRegistry({
        mock: mockProvider,
      }),
    );

    await expect(
      service.generateResponse({
        approvedContext: {
          locale: 'es',
          userMessage: 'hola',
          intent: 'GENERAL_CONVERSATION',
          outcome: 'respond',
          decision: {
            domain: 'core',
            action: 'respond',
            reasonCode: 'general_conversation',
            missingFields: [],
            responseTemplateKey: 'core.general_response',
          },
          interpretation: {
            language: 'es',
            confidence: 0.92,
            entities: {},
            normalizedEntities: {
              dates: [],
              measurements: [],
              dimensions: [],
            },
          },
          execution: {
            status: 'not_applicable',
            toolName: null,
            validatedInputSummary: null,
            resultSummary: null,
            failure: null,
          },
          approvedFactKeys: [],
          approvedResultKeys: [],
        },
        approvedDraft: 'Hello, how can I help you?',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        parsedResponse: expect.objectContaining({
          message: 'ok',
        }),
        promptVersion: null,
      }),
    );
    expect(promptService.getActivePrompt).toHaveBeenCalledWith('response');
    expect(mockProvider.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Use approved backend context.'),
        approvedDraft: 'Hello, how can I help you?',
      }),
      expect.any(Object),
    );
  });

  it('fails closed when the selected provider requires credentials but none are resolved', async () => {
    const promptService = {
      getActivePrompt: jest.fn(async () => ({
        value: 'Return JSON only.',
      })),
    };
    const openAiProvider = {
      interpret: jest.fn(),
      generateResponse: jest.fn(),
    };
    const service = new AiGatewayService(
      {
        getAiGatewayConfig: () =>
          buildGatewayConfig({
            provider: 'openai',
            credentials: {
              strategy: 'env',
              envKey: 'AI_PROVIDER_API_KEY',
              value: null,
            },
          }),
      } as any,
      new AiPromptAssemblyService(promptService as any),
      {
        debug: jest.fn(),
        error: jest.fn(),
      } as any,
      buildProviderRegistry({
        mock: {
          interpret: jest.fn(),
          generateResponse: jest.fn(),
        },
        openai: openAiProvider,
      }),
    );

    await expect(service.interpret({ message: 'hola' })).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error:
          'AI provider credentials are not configured for provider "openai".',
        provider: 'openai',
        model: 'mock-rule-engine',
      }),
    );
    expect(openAiProvider.interpret).not.toHaveBeenCalled();
  });

  it('fails closed when managed config points to an unregistered provider', async () => {
    const promptService = {
      getActivePrompt: jest.fn(async () => ({
        value: 'Return JSON only.',
      })),
    };
    const service = new AiGatewayService(
      {
        getAiGatewayConfig: () =>
          buildGatewayConfig({
            provider: 'anthropic',
            credentials: {
              strategy: 'env',
              envKey: 'AI_PROVIDER_API_KEY',
              value: 'secret-token',
            },
          }),
      } as any,
      new AiPromptAssemblyService(promptService as any),
      {
        debug: jest.fn(),
        error: jest.fn(),
      } as any,
      buildProviderRegistry({
        mock: {
          interpret: jest.fn(),
          generateResponse: jest.fn(),
        },
        openai: {
          interpret: jest.fn(),
          generateResponse: jest.fn(),
        },
      }),
    );

    await expect(service.interpret({ message: 'hola' })).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: 'AI provider "anthropic" is not registered in the gateway.',
        provider: 'anthropic',
      }),
    );
  });
});

function buildGatewayConfig(
  overrides: Partial<{
    provider: string;
    model: string;
    timeoutMs: number;
    credentials:
      | {
          strategy: 'none';
          envKey: null;
          value: null;
        }
      | {
          strategy: 'env';
          envKey: string | null;
          value: string | null;
        };
    providerOptions: Record<string, unknown>;
    source:
      | {
          type: 'managed';
          key: 'ai_runtime';
          version: number | null;
        }
      | {
          type: 'fallback';
          reason: 'missing_managed_resource';
        };
  }> = {},
) {
  return {
    provider: overrides.provider ?? 'mock',
    model: overrides.model ?? 'mock-rule-engine',
    timeoutMs: overrides.timeoutMs ?? 1000,
    credentials:
      overrides.credentials ?? {
        strategy: 'none',
        envKey: null,
        value: null,
      },
    providerOptions: overrides.providerOptions ?? {},
    source:
      overrides.source ?? {
        type: 'managed',
        key: 'ai_runtime',
        version: 1,
      },
  };
}

function buildProviderRegistry(
  providers: Record<
    string,
    {
      interpret: jest.Mock;
      generateResponse: jest.Mock;
    }
  >,
) {
  return new LanguageModelProviderRegistry(
    Object.entries(providers).map(([providerName, provider]) => ({
      providerName,
      ...provider,
    })) as any,
  );
}

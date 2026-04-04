import { AiRuntimeResource } from '../critical-config/critical-config.types';
import { AiGatewayConfig } from './runtime-config.types';

const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_OPENAI_TIMEOUT_MS = 7000;
const DEFAULT_MOCK_MODEL = 'mock-rule-engine';
const DEFAULT_MOCK_TIMEOUT_MS = 1000;

type EnvReader = (key: string) => string | null;

export type AiRuntimeBootstrapResolution = {
  resource: AiRuntimeResource;
  source: AiGatewayConfig['source'];
};

export function resolveAiRuntimeBootstrap(
  readEnv: EnvReader,
): AiRuntimeBootstrapResolution {
  const explicitProvider = readEnv('AI_PROVIDER')?.toLowerCase() ?? null;
  const hasOpenAiKey = Boolean(readEnv('OPENAI_API_KEY'));
  const provider = explicitProvider ?? (hasOpenAiKey ? 'openai' : 'mock');
  const providerEnvKey =
    readEnv('AI_PROVIDER_API_KEY_ENV') ??
    (readEnv('AI_PROVIDER_API_KEY')
      ? 'AI_PROVIDER_API_KEY'
      : provider === 'openai' && hasOpenAiKey
        ? 'OPENAI_API_KEY'
        : null);
  const baseUrl =
    readEnv('AI_PROVIDER_BASE_URL') ??
    (provider === 'openai' ? readEnv('OPENAI_BASE_URL') : null);

  return {
    resource: {
      provider,
      model:
        readEnv('AI_MODEL') ??
        (provider === 'openai' ? readEnv('OPENAI_MODEL') : null) ??
        (provider === 'mock' ? DEFAULT_MOCK_MODEL : DEFAULT_OPENAI_MODEL),
      timeoutMs: readPositiveNumber(
        readEnv('AI_TIMEOUT_MS'),
        provider === 'mock' ? DEFAULT_MOCK_TIMEOUT_MS : DEFAULT_OPENAI_TIMEOUT_MS,
      ),
      credentials:
        provider === 'mock'
          ? {
              strategy: 'none',
              envKey: null,
            }
          : {
              strategy: 'env',
              envKey: providerEnvKey,
            },
      providerOptions: baseUrl ? { baseUrl } : {},
    },
    source: explicitProvider
      ? {
          type: 'bootstrap',
          reason: 'env_provider_override',
        }
      : hasOpenAiKey
        ? {
            type: 'bootstrap',
            reason: 'env_openai_exploratory_default',
          }
        : {
            type: 'fallback',
            reason: 'missing_managed_resource',
          },
  };
}

function readPositiveNumber(value: string | null, fallback: number) {
  const parsedValue = value ? Number(value) : Number.NaN;

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return fallback;
}

import { AiRuntimeResource } from '../critical-config/critical-config.types';
import { AiGatewayConfig } from './runtime-config.types';

const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_OPENAI_TIMEOUT_MS = 7000;

type EnvReader = (key: string) => string | null;

export type AiRuntimeBootstrapResolution = {
  resource: AiRuntimeResource;
  source: AiGatewayConfig['source'];
};

export function resolveAiRuntimeBootstrap(
  readEnv: EnvReader,
): AiRuntimeBootstrapResolution {
  const explicitProvider = readEnv('AI_PROVIDER')?.toLowerCase() ?? null;
  const provider =
    explicitProvider && explicitProvider !== 'mock'
      ? explicitProvider
      : 'openai';
  const providerEnvKey =
    readEnv('AI_PROVIDER_API_KEY_ENV') ??
    (readEnv('AI_PROVIDER_API_KEY')
      ? 'AI_PROVIDER_API_KEY'
      : 'OPENAI_API_KEY');
  const baseUrl =
    readEnv('AI_PROVIDER_BASE_URL') ??
    (provider === 'openai' ? readEnv('OPENAI_BASE_URL') : null);

  return {
    resource: {
      provider,
      model:
        readEnv('AI_MODEL') ??
        (provider === 'openai' ? readEnv('OPENAI_MODEL') : null) ??
        DEFAULT_OPENAI_MODEL,
      timeoutMs: readPositiveNumber(readEnv('AI_TIMEOUT_MS'), DEFAULT_OPENAI_TIMEOUT_MS),
      credentials: {
        strategy: 'env',
        envKey: providerEnvKey,
      },
      providerOptions: baseUrl ? { baseUrl } : {},
    },
    source:
      explicitProvider && explicitProvider !== 'mock'
        ? {
            type: 'bootstrap',
            reason: 'env_provider_override',
          }
        : explicitProvider === 'mock'
          ? {
              type: 'bootstrap',
              reason: 'legacy_mock_resource_ignored',
            }
          : hasAnyOpenAiCredential(readEnv)
            ? {
                type: 'bootstrap',
                reason: 'env_openai_exploratory_default',
              }
            : {
                type: 'bootstrap',
                reason: 'missing_openai_credentials',
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

function hasAnyOpenAiCredential(readEnv: EnvReader) {
  return Boolean(
    readEnv('OPENAI_API_KEY')?.trim() ||
      readEnv('AI_PROVIDER_API_KEY')?.trim(),
  );
}

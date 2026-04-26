import { Injectable } from '@nestjs/common';

import { LanguageModelProviderRegistry } from '../ai-gateway/providers/language-model-provider.registry';
import {
  AiRuntimeDiagnosticIssue,
  AiRuntimeDiagnostics,
} from './runtime-config.types';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable()
export class AiRuntimeDiagnosticsService {
  constructor(
    private readonly runtimeConfigService: RuntimeConfigService,
    private readonly providerRegistry: LanguageModelProviderRegistry,
  ) {}

  async getDiagnostics(): Promise<AiRuntimeDiagnostics> {
    const config = await this.runtimeConfigService.getAiGatewayConfig();
    const supportedProviders = this.providerRegistry.listProviderNames();
    const providerRegistered = this.providerRegistry.resolve(config.provider) !== null;
    const issues: AiRuntimeDiagnosticIssue[] = [];

    if (config.source.type === 'bootstrap') {
      issues.push({
        code:
          config.source.reason === 'env_provider_override'
            ? 'using_env_override'
            : config.source.reason === 'legacy_mock_resource_ignored'
              ? 'legacy_mock_resource_ignored'
              : config.source.reason === 'missing_openai_credentials'
                ? 'missing_openai_credentials'
                : 'using_bootstrap_default',
        severity: 'warning',
        message:
          config.source.reason === 'env_provider_override'
            ? 'No governed ai_runtime resource is active. The platform is using env bootstrap overrides for provider resolution.'
            : config.source.reason === 'legacy_mock_resource_ignored'
              ? 'The active ai_runtime resource still points at the legacy mock provider. The bootstrap OpenAI runtime is taking precedence.'
              : config.source.reason === 'missing_openai_credentials'
                ? 'No governed ai_runtime resource is active and no OpenAI credential is currently available in secure storage or env.'
                : 'No governed ai_runtime resource is active. The platform is using exploratory OpenAI defaults from OPENAI_API_KEY.',
      });
    }

    if (!providerRegistered) {
      issues.push({
        code: 'provider_not_registered',
        severity: 'error',
        message: `Provider "${config.provider}" is not registered in the runtime provider registry.`,
      });
    }

    if (config.timeoutMs <= 0) {
      issues.push({
        code: 'invalid_timeout',
        severity: 'error',
        message: 'The active AI runtime timeout must be greater than zero.',
      });
    }

    if (config.credentials.strategy === 'env' && !config.credentials.envKey) {
      issues.push({
        code: 'missing_env_key',
        severity: 'error',
        message:
          'The active AI runtime requires env credentials, but no env key is configured.',
      });
    }

    if (config.credentials.strategy === 'env' && !config.credentials.value) {
      issues.push({
        code: 'missing_credentials',
        severity: 'error',
        message: `The configured AI credential key "${config.credentials.envKey ?? 'unknown'}" is not currently resolved in secure storage or env.`,
      });
    }

    const hasErrors = issues.some((issue) => issue.severity === 'error');
    const canUseRuntime =
      providerRegistered && !hasErrors && Boolean(config.credentials.value);
    const exploratoryReady = canUseRuntime;
    const status = hasErrors ? 'invalid' : 'ready';

    return {
      provider: config.provider,
      model: config.model ?? null,
      timeoutMs: config.timeoutMs ?? null,
      source: config.source,
      status,
      canUseRuntime,
      exploratoryReady,
      providerRegistered,
      supportedProviders,
      credentials: {
        strategy: config.credentials.strategy,
        envKey: config.credentials.envKey,
        resolved:
          config.credentials.strategy === 'none'
            ? true
            : Boolean(config.credentials.value),
      },
      issues,
    };
  }
}

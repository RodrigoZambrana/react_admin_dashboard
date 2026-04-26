import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CriticalConfigService } from '../critical-config/critical-config.service';
import { SecureConfigService } from '../security/secure-config.service';
import { resolveAiRuntimeBootstrap } from './ai-runtime-bootstrap';
import { AI_RUNTIME_OPENAI_SECRET_KEY } from './ai-runtime-secrets';
import {
  AiGatewayConfig,
  SecurityPreparationConfig,
  TenantRuntimeConfig,
} from './runtime-config.types';

@Injectable()
export class RuntimeConfigService {
  constructor(
    private readonly configService: ConfigService,
    private readonly criticalConfigService: CriticalConfigService,
    private readonly secureConfigService: SecureConfigService,
  ) {}

  async getAiGatewayConfig(): Promise<AiGatewayConfig> {
    const managedConfig = await this.criticalConfigService.getActiveConfig(
      'ai_runtime',
    );
    const value = managedConfig?.value;

    if (!value || value.provider === 'mock') {
      const bootstrap = resolveAiRuntimeBootstrap((key) =>
        this.readOptionalString(key),
      );

      return {
        provider: bootstrap.resource.provider,
        model: bootstrap.resource.model,
        timeoutMs: bootstrap.resource.timeoutMs,
        credentials: await this.resolveCredentials(bootstrap.resource.credentials),
        providerOptions: bootstrap.resource.providerOptions ?? {},
        source:
          value?.provider === 'mock'
            ? {
                type: 'bootstrap',
                reason: 'legacy_mock_resource_ignored',
              }
            : bootstrap.source,
      };
    }

    return {
      provider: value.provider,
      model: value.model,
      timeoutMs: value.timeoutMs,
      credentials: await this.resolveCredentials(value.credentials),
      providerOptions: value.providerOptions ?? {},
      source: {
        type: 'managed',
        key: 'ai_runtime',
        version: managedConfig.version,
      },
    };
  }

  getTenantRuntimeConfig(tenantId?: string | null): TenantRuntimeConfig {
    return {
      tenantId: tenantId ?? null,
      source: 'env',
      authMode: 'open',
    };
  }

  getSecurityPreparationConfig(): SecurityPreparationConfig {
    return {
      apiAuthMode: 'open',
      futureApiAuthMode: 'bearer',
      futureAdminGuard: 'AdminOnlyGuard',
      adminOnlyEndpoints: [
        '/prompts',
        '/logs',
        '/conversations',
        '/admin/runtime-resources/prompts',
        '/admin/runtime-resources/temporal-locales',
        '/admin/runtime-resources/critical-configs',
        '/admin/runtime-resources/knowledge-metadata',
        '/admin/runtime-resources/response-fallbacks',
      ],
      apiKeyStorage: {
        current: 'env',
        future: 'database',
      },
    };
  }

  private async resolveCredentials(input: {
    strategy: 'none' | 'env';
    envKey?: string | null;
  }): Promise<AiGatewayConfig['credentials']> {
    if (input.strategy === 'none') {
      return {
        strategy: 'none',
        envKey: null,
        value: null,
      };
    }

    const envKey = input.envKey?.trim() ? input.envKey.trim() : null;
    const value = await this.resolveSecretValue(envKey);

    return {
      strategy: 'env',
      envKey,
      value,
    };
  }

  private async resolveSecretValue(envKey: string | null) {
    const stored = await this.secureConfigService.getString(
      AI_RUNTIME_OPENAI_SECRET_KEY,
    );

    if (stored?.value) {
      return stored.value.trim();
    }

    const envValue = envKey ? this.readOptionalString(envKey) : null;

    if (envValue) {
      await this.secureConfigService.setString(
        AI_RUNTIME_OPENAI_SECRET_KEY,
        envValue,
      );
      return envValue;
    }

    return null;
  }

  private readOptionalString(key: string) {
    const value = this.configService.get<string>(key);
    return value?.trim() ? value.trim() : null;
  }
}

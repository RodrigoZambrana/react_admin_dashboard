import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CriticalConfigService } from '../critical-config/critical-config.service';
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
  ) {}

  async getAiGatewayConfig(): Promise<AiGatewayConfig> {
    const managedConfig = await this.criticalConfigService.getActiveConfig(
      'ai_runtime',
    );
    const value = managedConfig?.value;

    if (!value) {
      return {
        provider: 'mock',
        model: 'mock-rule-engine',
        timeoutMs: 1000,
        credentials: {
          strategy: 'none',
          envKey: null,
          value: null,
        },
        providerOptions: {},
        source: {
          type: 'fallback',
          reason: 'missing_managed_resource',
        },
      };
    }

    return {
      provider: value.provider,
      model: value.model,
      timeoutMs: value.timeoutMs,
      credentials: this.resolveCredentials(value.credentials),
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
      ],
      apiKeyStorage: {
        current: 'env',
        future: 'database',
      },
    };
  }

  private resolveCredentials(input: {
    strategy: 'none' | 'env';
    envKey?: string | null;
  }): AiGatewayConfig['credentials'] {
    if (input.strategy === 'none') {
      return {
        strategy: 'none',
        envKey: null,
        value: null,
      };
    }

    const envKey = input.envKey?.trim() ? input.envKey.trim() : null;

    return {
      strategy: 'env',
      envKey,
      value: envKey ? this.readOptionalString(envKey) : null,
    };
  }

  private readOptionalString(key: string) {
    const value = this.configService.get<string>(key);
    return value?.trim() ? value.trim() : null;
  }
}

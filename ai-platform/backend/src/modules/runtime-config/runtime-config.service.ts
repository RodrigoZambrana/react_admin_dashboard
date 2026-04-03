import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AiGatewayConfig,
  AiProvider,
  SecurityPreparationConfig,
  TenantRuntimeConfig,
} from './runtime-config.types';

@Injectable()
export class RuntimeConfigService {
  constructor(private readonly configService: ConfigService) {}

  getAiGatewayConfig(): AiGatewayConfig {
    return {
      provider: this.getAiProvider(),
      apiKey: this.readOptionalString('OPENAI_API_KEY'),
      model:
        this.readOptionalString('OPENAI_MODEL') ??
        this.readOptionalString('AI_MODEL') ??
        'gpt-4o-mini',
      timeoutMs: this.readPositiveNumber('AI_TIMEOUT_MS', 10000),
      source: 'env',
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

  private getAiProvider(): AiProvider {
    const configuredProvider = this.readOptionalString('AI_PROVIDER')?.toLowerCase();

    if (configuredProvider === 'openai') {
      return 'openai';
    }

    return 'mock';
  }

  private readOptionalString(key: string) {
    const value = this.configService.get<string>(key);
    return value?.trim() ? value.trim() : null;
  }

  private readPositiveNumber(key: string, fallback: number) {
    const rawValue = this.configService.get<string>(key);
    const parsedValue = rawValue ? Number(rawValue) : Number.NaN;

    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }

    return fallback;
  }
}

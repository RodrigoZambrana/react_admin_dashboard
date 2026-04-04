import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RuntimeManagedResourceSeedSource } from '../runtime-resources/runtime-managed-resource.seed-source';
import { RuntimeManagedResourceSeed } from '../runtime-resources/runtime-managed-resource.types';
import { resolveAiRuntimeBootstrap } from '../runtime-config/ai-runtime-bootstrap';
import {
  AiRuntimeResource,
  AsyncIntakeRuntimeResource,
  buildDefaultAsyncIntakeRuntimeResource,
  buildDefaultTenantCapabilityRuntimeResource,
  CriticalConfigKey,
  CriticalConfigValue,
  LearningRuntimeResource,
  TenantCapabilityRuntimeResource,
} from './critical-config.types';

@Injectable()
export class EnvCriticalConfigSeedSource extends RuntimeManagedResourceSeedSource<
  CriticalConfigKey,
  CriticalConfigValue
> {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async getSeed(
    key: CriticalConfigKey,
  ): Promise<RuntimeManagedResourceSeed<CriticalConfigKey, CriticalConfigValue> | null> {
    const seeds = await this.listSeeds();
    return seeds.find((seed) => seed.key === key) ?? null;
  }

  async listSeeds(): Promise<
    Array<RuntimeManagedResourceSeed<CriticalConfigKey, CriticalConfigValue>>
  > {
    return [
      {
        key: 'ai_runtime',
        value: this.buildAiRuntimeSeed(),
        createdBy: 'system:critical-config-seed',
        metadata: {
          origin: 'system',
          source: 'env-seed',
        },
      },
      {
        key: 'learning',
        value: this.buildLearningSeed(),
        createdBy: 'system:critical-config-seed',
        metadata: {
          origin: 'system',
          source: 'env-seed',
        },
      },
      {
        key: 'async_intake',
        value: this.buildAsyncIntakeSeed(),
        createdBy: 'system:critical-config-seed',
        metadata: {
          origin: 'system',
          source: 'env-seed',
        },
      },
      {
        key: 'tenant_capabilities',
        value: this.buildTenantCapabilitiesSeed(),
        createdBy: 'system:critical-config-seed',
        metadata: {
          origin: 'system',
          source: 'env-seed',
        },
      },
    ];
  }

  private buildAiRuntimeSeed(): AiRuntimeResource {
    return resolveAiRuntimeBootstrap((key) => this.readOptionalString(key)).resource;
  }

  private buildLearningSeed(): LearningRuntimeResource {
    return {
      enabled: this.readBoolean('LEARNING_ENABLED', true),
      observedStages: this.readStringList(
        'LEARNING_OBSERVED_STAGES',
        ['execution', 'response'],
      ),
      minConfidence: this.readBoundedNumber('LEARNING_MIN_CONFIDENCE', 0.6),
      maxBodyLength: this.readPositiveNumber('LEARNING_MAX_BODY_LENGTH', 240),
      maxSummaryLength: this.readPositiveNumber(
        'LEARNING_MAX_SUMMARY_LENGTH',
        180,
      ),
      persistEmbeddings: this.readBoolean('LEARNING_PERSIST_EMBEDDINGS', true),
    };
  }

  private buildAsyncIntakeSeed(): AsyncIntakeRuntimeResource {
    const defaults = buildDefaultAsyncIntakeRuntimeResource();

    return {
      stabilization: {
        defaultDelayMs: this.readPositiveNumber(
          'ASYNC_INTAKE_DEFAULT_DELAY_MS',
          defaults.stabilization.defaultDelayMs,
        ),
        maxWindowMs: this.readPositiveNumber(
          'ASYNC_INTAKE_MAX_WINDOW_MS',
          defaults.stabilization.maxWindowMs,
        ),
        fragmentContinuationDelayMs: this.readPositiveNumber(
          'ASYNC_INTAKE_FRAGMENT_DELAY_MS',
          defaults.stabilization.fragmentContinuationDelayMs,
        ),
        trailingThoughtDelayMs: this.readPositiveNumber(
          'ASYNC_INTAKE_TRAILING_DELAY_MS',
          defaults.stabilization.trailingThoughtDelayMs,
        ),
        shortMessageDelayMs: this.readPositiveNumber(
          'ASYNC_INTAKE_SHORT_DELAY_MS',
          defaults.stabilization.shortMessageDelayMs,
        ),
        mediumIncompleteDelayMs: this.readPositiveNumber(
          'ASYNC_INTAKE_MEDIUM_INCOMPLETE_DELAY_MS',
          defaults.stabilization.mediumIncompleteDelayMs,
        ),
        longCompletedDelayMs: this.readNonNegativeNumber(
          'ASYNC_INTAKE_LONG_COMPLETED_DELAY_MS',
          defaults.stabilization.longCompletedDelayMs,
        ),
        shortMessageLengthThreshold: this.readPositiveNumber(
          'ASYNC_INTAKE_SHORT_LENGTH_THRESHOLD',
          defaults.stabilization.shortMessageLengthThreshold,
        ),
        mediumMessageLengthThreshold: this.readPositiveNumber(
          'ASYNC_INTAKE_MEDIUM_LENGTH_THRESHOLD',
          defaults.stabilization.mediumMessageLengthThreshold,
        ),
        longCompletedLengthThreshold: this.readPositiveNumber(
          'ASYNC_INTAKE_LONG_COMPLETED_LENGTH_THRESHOLD',
          defaults.stabilization.longCompletedLengthThreshold,
        ),
      },
      replyProjection: {
        minDelayMs: this.readNonNegativeNumber(
          'ASYNC_INTAKE_MIN_REPLY_DELAY_MS',
          defaults.replyProjection.minDelayMs,
        ),
        maxDelayMs: this.readPositiveNumber(
          'ASYNC_INTAKE_MAX_REPLY_DELAY_MS',
          defaults.replyProjection.maxDelayMs,
        ),
        charDelayMs: this.readNonNegativeNumber(
          'ASYNC_INTAKE_REPLY_CHAR_DELAY_MS',
          defaults.replyProjection.charDelayMs,
        ),
      },
      lexicons: defaults.lexicons,
    };
  }

  private buildTenantCapabilitiesSeed(): TenantCapabilityRuntimeResource {
    const defaults = buildDefaultTenantCapabilityRuntimeResource();
    const enabledKeys = new Set(
      this.readStringList(
        'TENANT_CAPABILITIES_ENABLED',
        defaults.capabilities.map((capability) => capability.key),
      ),
    );

    return {
      capabilities: defaults.capabilities.map((capability) => ({
        ...capability,
        enabled: enabledKeys.has(capability.key),
        intents: [...capability.intents],
        tools: [...capability.tools],
        config: { ...(capability.config ?? {}) },
      })),
    };
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

  private readNonNegativeNumber(key: string, fallback: number) {
    const rawValue = this.configService.get<string>(key);
    const parsedValue = rawValue ? Number(rawValue) : Number.NaN;

    if (Number.isFinite(parsedValue) && parsedValue >= 0) {
      return parsedValue;
    }

    return fallback;
  }

  private readBoundedNumber(key: string, fallback: number) {
    const parsedValue = Number(this.configService.get<string>(key));

    if (Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 1) {
      return parsedValue;
    }

    return fallback;
  }

  private readBoolean(key: string, fallback: boolean) {
    const rawValue = this.readOptionalString(key)?.toLowerCase();

    if (rawValue === 'true') {
      return true;
    }

    if (rawValue === 'false') {
      return false;
    }

    return fallback;
  }

  private readStringList(key: string, fallback: string[]) {
    const rawValue = this.readOptionalString(key);

    if (!rawValue) {
      return fallback;
    }

    const values = rawValue
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    return values.length > 0 ? values : fallback;
  }
}

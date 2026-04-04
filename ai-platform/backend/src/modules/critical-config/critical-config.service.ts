import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { CriticalConfigVersionRepository } from '../persistence/repositories/critical-config-version.repository';
import { RuntimeManagedResourceVersion } from '../runtime-resources/runtime-managed-resource.types';
import { CriticalConfigProvider } from './critical-config.provider';
import {
  AiRuntimeResource,
  CriticalConfigKey,
  criticalConfigKeySchema,
  CriticalConfigResourceMap,
  CriticalConfigValue,
  LearningRuntimeResource,
  parseCriticalConfigValue,
} from './critical-config.types';

@Injectable()
export class CriticalConfigService {
  constructor(
    @Inject(CriticalConfigProvider)
    private readonly criticalConfigProvider: CriticalConfigProvider,
    private readonly criticalConfigVersionRepository: CriticalConfigVersionRepository,
    private readonly logger: PipelineLoggerService,
  ) {}

  async getActiveConfig<TKey extends CriticalConfigKey>(
    key: TKey,
  ): Promise<
    RuntimeManagedResourceVersion<TKey, CriticalConfigResourceMap[TKey]> | null
  > {
    const config = await this.criticalConfigProvider.getActive(key);

    this.logger.debug(
      JSON.stringify({
        stage: 'critical_config.retrieve',
        key,
        version: config?.version ?? null,
      }),
    );

    return config as RuntimeManagedResourceVersion<
      TKey,
      CriticalConfigResourceMap[TKey]
    > | null;
  }

  async getAiRuntimeConfig(): Promise<AiRuntimeResource | null> {
    return (await this.getActiveConfig('ai_runtime'))?.value as
      | AiRuntimeResource
      | null;
  }

  async getLearningConfig(): Promise<LearningRuntimeResource | null> {
    return (await this.getActiveConfig('learning'))?.value as
      | LearningRuntimeResource
      | null;
  }

  async listConfigs(key?: CriticalConfigKey) {
    await this.criticalConfigProvider.listActive();
    return this.criticalConfigVersionRepository.list(key);
  }

  async listActiveConfigs() {
    const configs = await this.criticalConfigProvider.listActive();

    return configs.map((config) => ({
      id: config.id,
      key: config.key,
      value: config.value,
      version: config.version,
      status: config.status,
      metadata: config.metadata,
      createdAt: config.createdAt,
      createdBy: config.createdBy,
    }));
  }

  async createVersion(input: {
    key: CriticalConfigKey;
    value: CriticalConfigValue;
    createdBy?: string;
    activate?: boolean;
  }) {
    const key = criticalConfigKeySchema.parse(input.key);
    const value = parseCriticalConfigValue(key, input.value);
    const config = await this.criticalConfigVersionRepository.createVersion({
      key,
      value: value as Prisma.InputJsonValue,
      createdBy: input.createdBy,
      activate: input.activate,
    });

    this.logger.log(
      JSON.stringify({
        stage: 'critical_config.versioned',
        key: config.key,
        version: config.version,
        status: config.status,
      }),
    );

    return config;
  }
}

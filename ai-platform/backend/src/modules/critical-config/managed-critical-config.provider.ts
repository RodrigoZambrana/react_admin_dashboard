import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CriticalConfigVersionRepository } from '../persistence/repositories/critical-config-version.repository';
import { RuntimeManagedResourceVersion } from '../runtime-resources/runtime-managed-resource.types';
import {
  CriticalConfigKey,
  CriticalConfigValue,
  criticalConfigKeySchema,
  parseCriticalConfigValue,
} from './critical-config.types';
import { CriticalConfigProvider } from './critical-config.provider';
import { EnvCriticalConfigSeedSource } from './env-critical-config.seed-source';

@Injectable()
export class ManagedCriticalConfigProvider extends CriticalConfigProvider {
  constructor(
    private readonly criticalConfigVersionRepository: CriticalConfigVersionRepository,
    private readonly seedSource: EnvCriticalConfigSeedSource,
  ) {
    super();
  }

  async getActive(
    key: CriticalConfigKey,
  ): Promise<RuntimeManagedResourceVersion<CriticalConfigKey, CriticalConfigValue> | null> {
    await this.ensureBootstrapSeeded();
    const config = await this.criticalConfigVersionRepository.getActiveByKey(key);
    return config ? this.mapRecord(config) : null;
  }

  async listActive(): Promise<
    Array<RuntimeManagedResourceVersion<CriticalConfigKey, CriticalConfigValue>>
  > {
    await this.ensureBootstrapSeeded();
    const configs = await this.criticalConfigVersionRepository.listActive();
    return configs.map((config) => this.mapRecord(config));
  }

  private async ensureBootstrapSeeded() {
    const hasAnyVersions =
      await this.criticalConfigVersionRepository.hasAnyVersions();

    if (hasAnyVersions) {
      return;
    }

    const seeds = await this.seedSource.listSeeds();

    for (const seed of seeds) {
      await this.criticalConfigVersionRepository.createVersion({
        key: seed.key,
        value: seed.value as Prisma.InputJsonValue,
        metadata: seed.metadata as Prisma.InputJsonValue,
        createdBy: seed.createdBy,
        activate: true,
      });
    }
  }

  private mapRecord(record: {
    id: string;
    key: string;
    value: unknown;
    version: number;
    status: string;
    metadata: unknown;
    createdAt: Date;
    createdBy: string | null;
  }): RuntimeManagedResourceVersion<CriticalConfigKey, CriticalConfigValue> {
    const key = criticalConfigKeySchema.parse(record.key);
    return {
      id: record.id,
      key,
      value: this.parseValue(key, record.value),
      version: record.version,
      status: record.status as RuntimeManagedResourceVersion<
        CriticalConfigKey,
        CriticalConfigValue
      >['status'],
      metadata: record.metadata as RuntimeManagedResourceVersion<
        CriticalConfigKey,
        CriticalConfigValue
      >['metadata'],
      createdAt: record.createdAt,
      createdBy: record.createdBy,
    };
  }

  private parseValue(key: CriticalConfigKey, value: unknown): CriticalConfigValue {
    return parseCriticalConfigValue(key, value);
  }
}

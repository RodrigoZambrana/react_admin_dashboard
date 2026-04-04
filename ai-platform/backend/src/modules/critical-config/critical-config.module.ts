import { Module } from '@nestjs/common';

import { CriticalConfigVersionRepository } from '../persistence/repositories/critical-config-version.repository';
import { CriticalConfigProvider } from './critical-config.provider';
import { CriticalConfigService } from './critical-config.service';
import { EnvCriticalConfigSeedSource } from './env-critical-config.seed-source';
import { ManagedCriticalConfigProvider } from './managed-critical-config.provider';

@Module({
  providers: [
    EnvCriticalConfigSeedSource,
    ManagedCriticalConfigProvider,
    CriticalConfigVersionRepository,
    CriticalConfigService,
    {
      provide: CriticalConfigProvider,
      useExisting: ManagedCriticalConfigProvider,
    },
  ],
  exports: [CriticalConfigProvider, CriticalConfigService],
})
export class CriticalConfigModule {}

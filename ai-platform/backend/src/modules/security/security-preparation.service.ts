import { Injectable } from '@nestjs/common';

import { RuntimeConfigService } from '../runtime-config/runtime-config.service';
import { SecurityPreparationPlan } from './security.types';

@Injectable()
export class SecurityPreparationService {
  constructor(private readonly runtimeConfig: RuntimeConfigService) {}

  getPlan(): SecurityPreparationPlan {
    const config = this.runtimeConfig.getSecurityPreparationConfig();

    return {
      apiAuthMode: config.apiAuthMode,
      futureApiAuthMode: config.futureApiAuthMode,
      adminEndpoints: config.adminOnlyEndpoints.map((path) => ({
        path,
        futureGuard: config.futureAdminGuard,
      })),
      apiKeyStorage: config.apiKeyStorage,
    };
  }
}

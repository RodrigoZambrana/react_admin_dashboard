import { Module } from '@nestjs/common';

import { CriticalConfigModule } from '../critical-config/critical-config.module';
import { ManagedTenantCapabilityResolverService } from './managed-tenant-capability-resolver.service';
import { StaticTenantCapabilityResolverService } from './static-tenant-capability-resolver.service';
import { TenantCapabilityRegistryService } from './tenant-capability-registry.service';

@Module({
  imports: [CriticalConfigModule],
  providers: [
    ManagedTenantCapabilityResolverService,
    StaticTenantCapabilityResolverService,
    TenantCapabilityRegistryService,
  ],
  exports: [TenantCapabilityRegistryService],
})
export class TenantCapabilitiesModule {}

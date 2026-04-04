import { Module } from '@nestjs/common';

import { StaticTenantCapabilityResolverService } from './static-tenant-capability-resolver.service';
import { TenantCapabilityRegistryService } from './tenant-capability-registry.service';

@Module({
  providers: [
    StaticTenantCapabilityResolverService,
    TenantCapabilityRegistryService,
  ],
  exports: [TenantCapabilityRegistryService],
})
export class TenantCapabilitiesModule {}

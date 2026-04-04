import { TenantCapabilityRegistryService } from '../src/modules/tenant-capabilities/tenant-capability-registry.service';
import { StaticTenantCapabilityResolverService } from '../src/modules/tenant-capabilities/static-tenant-capability-resolver.service';

describe('TenantCapabilityRegistryService', () => {
  function createService() {
    return new TenantCapabilityRegistryService(
      {
        tryGetTenantId: () => 'tenant-alpha',
      } as any,
      new StaticTenantCapabilityResolverService(),
    );
  }

  it('resolves tenant capabilities through a dedicated registry boundary', () => {
    const service = createService();
    const resolution = service.resolveForCurrentTenant();

    expect(resolution.tenantId).toBe('tenant-alpha');
    expect(resolution.enabledKeys).toEqual(
      expect.arrayContaining(['booking', 'quote', 'product_catalog_lookup']),
    );
    expect(resolution.capabilities.booking.tools).toEqual(['create_booking']);
  });

  it('can answer capability availability for intents and tools without leaking tenant logic into decision service tests', () => {
    const service = createService();

    expect(service.isIntentEnabled('CREATE_BOOKING')).toBe(true);
    expect(service.isToolEnabled('create_quote')).toBe(true);
  });
});

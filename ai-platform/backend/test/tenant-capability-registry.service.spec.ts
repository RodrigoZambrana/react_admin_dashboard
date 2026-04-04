import { ManagedTenantCapabilityResolverService } from '../src/modules/tenant-capabilities/managed-tenant-capability-resolver.service';
import { TenantCapabilityRegistryService } from '../src/modules/tenant-capabilities/tenant-capability-registry.service';
import { StaticTenantCapabilityResolverService } from '../src/modules/tenant-capabilities/static-tenant-capability-resolver.service';

describe('TenantCapabilityRegistryService', () => {
  function createService(input?: { managedDefinitions?: any[] | null }) {
    return new TenantCapabilityRegistryService(
      {
        tryGetTenantId: () => 'tenant-alpha',
      } as any,
      {
        resolveForTenant: jest.fn(async () => input?.managedDefinitions ?? null),
      } as unknown as ManagedTenantCapabilityResolverService,
      new StaticTenantCapabilityResolverService(),
    );
  }

  it('resolves tenant capabilities through a dedicated registry boundary', async () => {
    const service = createService();
    const resolution = await service.resolveForCurrentTenant();

    expect(resolution.tenantId).toBe('tenant-alpha');
    expect(resolution.enabledKeys).toEqual(
      expect.arrayContaining(['booking', 'quote', 'product_catalog_lookup']),
    );
    expect(resolution.capabilities.booking.tools).toEqual(['create_booking']);
  });

  it('can answer capability availability for intents and tools without leaking tenant logic into decision service tests', async () => {
    const service = createService();

    await expect(service.isIntentEnabled('CREATE_BOOKING')).resolves.toBe(true);
    await expect(service.isToolEnabled('create_quote')).resolves.toBe(true);
  });

  it('prefers managed tenant capability configuration over static defaults when available', async () => {
    const service = createService({
      managedDefinitions: [
        {
          key: 'booking',
          enabled: false,
          description: 'Disabled in managed config',
          intents: ['CREATE_BOOKING'],
          tools: ['create_booking'],
          config: {},
        },
      ],
    });

    const resolution = await service.resolveForCurrentTenant();

    expect(resolution.capabilities.booking.enabled).toBe(false);
    expect(resolution.capabilities.quote.enabled).toBe(true);
  });
});

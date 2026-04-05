import { readBackendSource } from './support/project-paths';

describe('Tenant capability architecture', () => {
  it('keeps tenant workflow activation behind a dedicated registry boundary', () => {
    const decisionSource = readBackendSource(
      'modules',
      'decision',
      'decision.service.ts',
    );
    const registrySource = readBackendSource(
      'modules',
      'tenant-capabilities',
      'tenant-capability-registry.service.ts',
    );

    expect(decisionSource).toContain('TenantCapabilityRegistryService');
    expect(registrySource).toContain('resolveForCurrentTenant');
    expect(registrySource).toContain('ManagedTenantCapabilityResolverService');
    expect(registrySource).not.toContain('urucortinas');
  });
});

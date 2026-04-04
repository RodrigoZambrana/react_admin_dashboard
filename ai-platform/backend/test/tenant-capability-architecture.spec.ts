import { readFileSync } from 'node:fs';

describe('Tenant capability architecture', () => {
  it('keeps tenant workflow activation behind a dedicated registry boundary', () => {
    const decisionSource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/decision/decision.service.ts',
      'utf8',
    );
    const registrySource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/tenant-capabilities/tenant-capability-registry.service.ts',
      'utf8',
    );

    expect(decisionSource).toContain('TenantCapabilityRegistryService');
    expect(registrySource).toContain('resolveForCurrentTenant');
    expect(registrySource).not.toContain('urucortinas');
  });
});

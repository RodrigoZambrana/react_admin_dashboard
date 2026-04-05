import { TenantRuntimeContextService } from '../src/modules/persistence/tenant/tenant-runtime-context.service';

describe('TenantRuntimeContextService', () => {
  it('reports when the resolved tenant matches the backend default', () => {
    const service = new TenantRuntimeContextService(
      {
        getTenantId: () => 'demo-tenant',
      } as any,
      {
        get: () => 'demo-tenant',
      } as any,
    );

    expect(service.getRuntimeContext()).toEqual({
      tenantId: 'demo-tenant',
      defaultTenantId: 'demo-tenant',
      source: 'default_tenant',
      matchesDefault: true,
    });
  });

  it('reports header override mode when the resolved tenant differs from the backend default', () => {
    const service = new TenantRuntimeContextService(
      {
        getTenantId: () => 'tenant-alpha',
      } as any,
      {
        get: () => 'demo-tenant',
      } as any,
    );

    expect(service.getRuntimeContext()).toEqual({
      tenantId: 'tenant-alpha',
      defaultTenantId: 'demo-tenant',
      source: 'header_override',
      matchesDefault: false,
    });
  });
});

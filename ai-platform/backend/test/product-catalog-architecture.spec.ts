import { readBackendSource } from './support/project-paths';

describe('Product catalog architecture', () => {
  it('keeps product lookup behind real source adapters instead of inline demo catalog data', () => {
    const productCatalogSource = readBackendSource(
      'modules',
      'tools',
      'product-catalog.service.ts',
    );
    const catalogServiceSource = readBackendSource(
      'modules',
      'catalog',
      'catalog.service.ts',
    );

    expect(productCatalogSource).toContain('CatalogService');
    expect(productCatalogSource).not.toContain('Atlas Carry Case');
    expect(productCatalogSource).not.toContain('Beacon Desk Lamp');
    expect(catalogServiceSource).toContain('CatalogSourceKind.REST');
    expect(catalogServiceSource).toContain('CatalogSourceKind.UPLOADED_STRUCTURED');
  });
});

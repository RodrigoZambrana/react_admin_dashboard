import { readFileSync } from 'node:fs';

describe('Product catalog architecture', () => {
  it('keeps product lookup behind real source adapters instead of inline demo catalog data', () => {
    const productCatalogSource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/tools/product-catalog.service.ts',
      'utf8',
    );
    const catalogServiceSource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/catalog/catalog.service.ts',
      'utf8',
    );

    expect(productCatalogSource).toContain('CatalogService');
    expect(productCatalogSource).not.toContain('Atlas Carry Case');
    expect(productCatalogSource).not.toContain('Beacon Desk Lamp');
    expect(catalogServiceSource).toContain('CatalogSourceKind.REST');
    expect(catalogServiceSource).toContain('CatalogSourceKind.UPLOADED_STRUCTURED');
  });
});

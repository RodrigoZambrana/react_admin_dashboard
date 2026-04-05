import { readFileSync } from 'node:fs';

describe('Document knowledge extraction architecture', () => {
  it('keeps the base extractor neutral and routes product/catalog semantics through a dedicated profile boundary', () => {
    const serviceSource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/documents/document-knowledge-extraction.service.ts',
      'utf8',
    );
    const orchestratorSource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/documents/document-knowledge-extraction.orchestrator.ts',
      'utf8',
    );
    const baseCatalogSource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/documents/document-knowledge-extraction.catalogs.ts',
      'utf8',
    );
    const profileSource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/documents/profiles/product-catalog-document.profile.ts',
      'utf8',
    );
    const profileRegistrySource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/documents/document-extraction-profile-registry.service.ts',
      'utf8',
    );
    const profileResolverSource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/documents/document-extraction-profile-resolver.service.ts',
      'utf8',
    );

    expect(serviceSource).toContain('DocumentKnowledgeExtractionOrchestrator');
    expect(serviceSource).not.toContain("'materials'");
    expect(serviceSource).not.toContain("'product_types'");
    expect(serviceSource).not.toContain("'color_options'");
    expect(serviceSource).not.toContain("'operation_modes'");
    expect(serviceSource).not.toContain("'suitability'");
    expect(orchestratorSource).not.toContain("'materials'");
    expect(orchestratorSource).not.toContain("'product_types'");
    expect(baseCatalogSource).not.toContain('productTypes');
    expect(baseCatalogSource).not.toContain('materialListLeads');
    expect(baseCatalogSource).not.toContain('colorVarietySignals');
    expect(baseCatalogSource).not.toContain('suitability');
    expect(profileRegistrySource).toContain('ProductCatalogDocumentProfile');
    expect(profileResolverSource).toContain('resolveProfiles');
    expect(profileSource).toContain("axis: 'materials'");
    expect(profileSource).toContain("axis: 'product_types'");
    expect(profileSource).not.toContain("'PVC'");
    expect(profileSource).not.toContain("'aluminio'");
    expect(profileSource).not.toContain('Trabajamos con');
    expect(profileSource).not.toContain('Tenemos variedad de colores.');
  });
});

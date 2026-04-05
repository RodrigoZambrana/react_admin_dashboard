import { readAppFile, readBackendSource } from './support/project-paths';

describe('Document knowledge extraction architecture', () => {
  it('keeps the base extractor neutral and routes product/catalog semantics through a dedicated profile boundary', () => {
    const serviceSource = readBackendSource(
      'modules',
      'documents',
      'document-knowledge-extraction.service.ts',
    );
    const orchestratorSource = readBackendSource(
      'modules',
      'documents',
      'document-knowledge-extraction.orchestrator.ts',
    );
    const baseCatalogSource = readBackendSource(
      'modules',
      'documents',
      'document-knowledge-extraction.catalogs.ts',
    );
    const profileSource = readBackendSource(
      'modules',
      'documents',
      'profiles',
      'product-catalog-document.profile.ts',
    );
    const profileConfigSource = readBackendSource(
      'modules',
      'documents',
      'document-extraction-profile-config.service.ts',
    );
    const profileResourceSource = readAppFile(
      'backend',
      'src',
      'resources',
      'document-extraction-profiles',
      'product_catalog',
      'es.json',
    );
    const profileRegistrySource = readBackendSource(
      'modules',
      'documents',
      'document-extraction-profile-registry.service.ts',
    );
    const profileResolverSource = readBackendSource(
      'modules',
      'documents',
      'document-extraction-profile-resolver.service.ts',
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
    expect(profileConfigSource).toContain('document-extraction-profiles');
    expect(profileResourceSource).toContain('"product_types"');
    expect(profileResourceSource).not.toContain('"PVC"');
    expect(profileResourceSource).not.toContain('"aluminio"');
    expect(profileSource).toContain("axis: 'materials'");
    expect(profileSource).toContain("axis: 'product_types'");
    expect(profileSource).toContain('resolveCompiledConfig');
    expect(profileSource).not.toContain("'PVC'");
    expect(profileSource).not.toContain("'aluminio'");
    expect(profileSource).not.toContain('listLeadTerms');
    expect(profileSource).not.toContain('const productCatalogExtractionCatalog');
    expect(profileSource).not.toContain('variedad de colores');
    expect(profileSource).not.toContain('different colours');
    expect(profileSource).not.toContain('Trabajamos con');
    expect(profileSource).not.toContain('Tenemos variedad de colores.');
  });
});

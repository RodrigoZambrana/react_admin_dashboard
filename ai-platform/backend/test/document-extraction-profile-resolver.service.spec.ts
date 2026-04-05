import { DocumentExtractionProfileResolverService } from '../src/modules/documents/document-extraction-profile-resolver.service';
import { DocumentExtractionProfileRegistryService } from '../src/modules/documents/document-extraction-profile-registry.service';
import { ProductCatalogDocumentProfile } from '../src/modules/documents/profiles/product-catalog-document.profile';

describe('DocumentExtractionProfileResolverService', () => {
  it('does not activate product/catalog extraction by default for unrelated document contexts', () => {
    const resolver = new DocumentExtractionProfileResolverService(
      new DocumentExtractionProfileRegistryService(
        new ProductCatalogDocumentProfile(),
      ),
    );

    const profiles = resolver.resolveProfiles({
      originKind: 'TEXT',
      locale: 'es',
      activeCapabilities: ['booking'],
      sourceMetadata: {
        sourceName: 'general-doc.txt',
      },
    });

    expect(profiles).toHaveLength(0);
  });

  it('activates the product/catalog profile when capability context supports it', () => {
    const resolver = new DocumentExtractionProfileResolverService(
      new DocumentExtractionProfileRegistryService(
        new ProductCatalogDocumentProfile(),
      ),
    );

    const profiles = resolver.resolveProfiles({
      originKind: 'TEXT',
      locale: 'es',
      activeCapabilities: ['product_catalog_lookup'],
      sourceMetadata: {
        sourceName: 'catalogo.txt',
      },
    });

    expect(profiles.map((profile) => profile.id)).toEqual(['product_catalog']);
  });
});

import { DocumentExtractionProfileConfigService } from '../src/modules/documents/document-extraction-profile-config.service';

describe('DocumentExtractionProfileConfigService', () => {
  it('loads product/catalog extraction config from profile + locale resources', () => {
    const service = new DocumentExtractionProfileConfigService();

    const config = service.resolveCompiledConfig({
      profileId: 'product_catalog',
      locale: 'es-UY',
    });

    expect(config.locale).toBe('es');
    expect(config.productTypes?.listPattern).toBeInstanceOf(RegExp);
    expect(config.materials?.listPatterns.length).toBeGreaterThanOrEqual(2);
    expect(config.operationModes?.normalizedTerms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedValue: 'manuales',
        }),
        expect.objectContaining({
          normalizedValue: 'motorizadas',
        }),
      ]),
    );
    expect(config.colorOptions?.unspecifiedAxes).toEqual([
      'exact_color_options',
    ]);
    expect(config.matchingHints.conjunctionTerms).toEqual(['y']);
  });

  it('falls back to the english profile resource when locale family is en', () => {
    const service = new DocumentExtractionProfileConfigService();

    const config = service.resolveCompiledConfig({
      profileId: 'product_catalog',
      locale: 'en-US',
    });

    expect(config.locale).toBe('en');
    expect(config.matchingHints.conjunctionTerms).toEqual(['and']);
    expect(config.colorOptions?.varietySignals).toContain('different colours');
  });

  it('merges platform defaults with persisted tenant-derived hints outside repo storage', async () => {
    const repository = {
      listActiveByProfilesAndLocale: jest.fn(async () => [
        {
          documentId: 'doc-1',
          profileId: 'product_catalog',
          locale: 'es',
          hints: {
            observedAxes: ['materials'],
            observedValuesByAxis: {
              materials: ['PVC', 'aluminio'],
            },
          },
          updatedAt: new Date('2026-04-05T10:00:00.000Z'),
          document: {
            title: 'Catálogo activo',
          },
        },
      ]),
      listByDocumentAndProfiles: jest.fn(async () => []),
      upsertForDocument: jest.fn(),
    };
    const service = new DocumentExtractionProfileConfigService(repository as any);

    const configs = await service.resolveEffectiveConfigs({
      profileIds: ['product_catalog'],
      locale: 'es-UY',
    });

    expect(configs.product_catalog?.resolution.tenantDerivedApplied).toBe(true);
    expect(configs.product_catalog?.resolution.derivedFromDocuments).toEqual([
      expect.objectContaining({
        documentId: 'doc-1',
        title: 'Catálogo activo',
      }),
    ]);
    expect(configs.product_catalog?.derivedHints).toEqual(
      expect.objectContaining({
        observedAxes: ['materials'],
        observedValuesByAxis: {
          materials: ['PVC', 'aluminio'],
        },
      }),
    );
    expect(configs.product_catalog?.resolution.sources.derivedHints).toBe(
      'tenant_derived',
    );
  });

  it('persists tenant-derived hints per document/profile/locale through the repository boundary', async () => {
    const repository = {
      listActiveByProfilesAndLocale: jest.fn(async () => []),
      listByDocumentAndProfiles: jest.fn(async () => []),
      upsertForDocument: jest.fn(async () => null),
    };
    const service = new DocumentExtractionProfileConfigService(repository as any);

    await service.persistTenantDerivedHints({
      documentId: 'doc-1',
      locale: 'es-UY',
      profiles: [
        {
          profileId: 'product_catalog',
          hints: {
            observedAxes: ['materials'],
          },
        },
      ],
      metadata: {
        approvalMode: 'uploaded_document',
      },
    });

    expect(repository.upsertForDocument).toHaveBeenCalledWith({
      documentId: 'doc-1',
      profileId: 'product_catalog',
      locale: 'es',
      hints: {
        observedAxes: ['materials'],
      },
      metadata: {
        approvalMode: 'uploaded_document',
      },
    });
  });
});

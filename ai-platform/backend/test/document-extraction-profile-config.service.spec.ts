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
    expect(config.paymentMethods?.headingTerms).toEqual(['pago', 'pagos']);
    expect(config.prudence?.exactHoursCautionTerms).toEqual(
      expect.arrayContaining(['exact', 'confirm']),
    );
    expect(config.workflow?.quoteFieldsHeadingTerms).toEqual(
      expect.arrayContaining(['presupuesto', 'cotizacion']),
    );
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
            sectionAliasesByAxis: {
              payment_methods: ['Opciones de cobro'],
            },
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
        sectionAliasesByAxis: {
          payment_methods: ['Opciones de cobro'],
        },
        observedValuesByAxis: {
          materials: ['PVC', 'aluminio'],
        },
      }),
    );
    expect(configs.product_catalog?.paymentMethods?.headingTerms).toEqual(
      expect.arrayContaining(['pago', 'pagos', 'Opciones de cobro']),
    );
    expect(configs.product_catalog?.resolution.sources.axes.payment_methods).toBe(
      'mixed',
    );
    expect(configs.product_catalog?.resolution.sources.derivedHints).toBe(
      'tenant_derived',
    );
  });

  it('uses tenant-derived section aliases as a bounded runtime extraction lever within the selected profile', () => {
    const service = new DocumentExtractionProfileConfigService();

    const config = service.resolveCompiledConfig({
      profileId: 'product_catalog',
      locale: 'es-UY',
      derivedHints: {
        sectionAliasesByAxis: {
          payment_methods: ['Opciones de cobro'],
          exact_hours: ['Horario de showroom'],
          quote_fields: ['Datos para cotizar'],
        },
      },
    });

    expect(config.paymentMethods?.headingTerms).toEqual(
      expect.arrayContaining(['Opciones de cobro']),
    );
    expect(config.prudence?.exactHoursHeadingTerms).toEqual(
      expect.arrayContaining(['Horario de showroom']),
    );
    expect(config.workflow?.quoteFieldsHeadingTerms).toEqual(
      expect.arrayContaining(['Datos para cotizar']),
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

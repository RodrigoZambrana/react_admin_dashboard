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
    expect(config.materials?.listPatterns.length).toBeGreaterThanOrEqual(3);
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
});

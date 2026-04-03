import { TemporalLocaleRegistryService } from '../src/modules/temporal/temporal-locale-registry.service';

describe('TemporalLocaleRegistryService', () => {
  it('loads supported temporal locale catalogs from backend-managed resources', () => {
    const registry = new TemporalLocaleRegistryService();

    expect(registry.getSupportedLocales()).toEqual(
      expect.arrayContaining(['en', 'es']),
    );
    expect(registry.resolveResource('es-UY')).toEqual(
      expect.objectContaining({
        locale: 'es',
        datePhrases: expect.arrayContaining(['mañana']),
      }),
    );
  });
});

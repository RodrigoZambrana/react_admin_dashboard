import { FileSystemTemporalLocaleProvider } from '../src/modules/temporal/filesystem-temporal-locale.provider';

describe('FileSystemTemporalLocaleProvider', () => {
  it('loads supported temporal locale catalogs from backend-managed resources', () => {
    const registry = new FileSystemTemporalLocaleProvider();

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

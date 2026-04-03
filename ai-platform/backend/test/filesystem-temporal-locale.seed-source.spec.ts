import { FileSystemTemporalLocaleSeedSource } from '../src/modules/temporal/filesystem-temporal-locale.seed-source';

describe('FileSystemTemporalLocaleSeedSource', () => {
  it('loads supported temporal locale catalogs from backend-managed resources', async () => {
    const provider = new FileSystemTemporalLocaleSeedSource();

    await expect(provider.listSeeds()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'en' }),
        expect.objectContaining({ key: 'es' }),
      ]),
    );
    await expect(provider.getSeed('es-UY')).resolves.toEqual(
      expect.objectContaining({
        key: 'es',
        value: expect.objectContaining({
          locale: 'es',
          datePhrases: expect.arrayContaining(['mañana']),
        }),
      }),
    );
  });
});

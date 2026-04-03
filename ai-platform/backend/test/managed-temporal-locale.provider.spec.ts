import { ManagedTemporalLocaleProvider } from '../src/modules/temporal/managed-temporal-locale.provider';
import { TemporalLocaleResource } from '../src/modules/temporal/temporal-locale.types';
import { buildManagedTemporalLocaleProviderStub } from './support/managed-temporal-provider.stub';

describe('ManagedTemporalLocaleProvider', () => {
  it('hydrates active temporal resources from managed persistence after bootstrap seeding', async () => {
    const seed = buildSeed('es', {
      locale: 'es',
      datePhrases: ['mañana'],
      timeJoiners: ['a las'],
    });
    const { provider, repository } = buildManagedTemporalLocaleProviderStub({
      seedSource: {
        listSeeds: async () => [seed],
      },
    });

    await expect(provider.resolveResource('es-UY')).resolves.toEqual(seed.value);
    expect(repository.createVersion).toHaveBeenCalledTimes(1);
    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'es',
        activate: true,
      }),
    );
    await expect(provider.listResources()).resolves.toEqual([seed.value]);
  });

  it('does not consult bootstrap seeds when managed versions already exist', async () => {
    const existing = {
      id: 'db-es',
      locale: 'es',
      resource: {
        locale: 'es',
        datePhrases: ['mañana'],
        timeJoiners: ['a las'],
      },
      version: 3,
      status: 'ACTIVE',
      metadata: {
        origin: 'admin',
      },
      createdAt: new Date(),
      createdBy: 'admin',
    };
    const seedSource = {
      listSeeds: jest.fn(async () => []),
    };
    const { provider, repository } = buildManagedTemporalLocaleProviderStub({
      initialRecords: [existing],
      seedSource,
    });

    await expect(provider.resolveResource('es')).resolves.toEqual(existing.resource);
    expect(seedSource.listSeeds).not.toHaveBeenCalled();
    expect(repository.createVersion).not.toHaveBeenCalled();
  });
});

function buildSeed(key: string, value: TemporalLocaleResource) {
  return {
    key,
    value,
    createdBy: 'system:temporal-seed',
    metadata: {
      origin: 'seed' as const,
      source: 'filesystem',
    },
  };
}
